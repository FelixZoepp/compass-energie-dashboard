import "server-only";
// Close-Webhook: Signatur prüfen und das betroffene Objekt gezielt nachladen.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createHmac, timingSafeEqual } from "node:crypto";
import { adminClient, upsert } from "../supabase/admin";
import { mergeSettings } from "../data";
import { CloseClient } from "./client";
import { LEAD_FELDER, OPP_FELDER, meetingOutcome, meetingTyp } from "./felder";
import { leadZeile, oppZeile, syncClose } from "./sync";

/** Close signiert: HMAC-SHA256(hex-dekodierter Schlüssel, timestamp + rawBody) → close-sig-hash (hex). */
export function signaturGueltig(rawBody: string, timestamp: string | null, hash: string | null, secret = process.env.CLOSE_WEBHOOK_SECRET ?? ""): boolean {
  if (!secret || !timestamp || !hash) return false;
  // Replay-Schutz: max. 10 Minuten alt
  const ts = Number(timestamp);
  if (Number.isFinite(ts) && Math.abs(Date.now() / 1000 - ts) > 600) return false;
  const erwartet = createHmac("sha256", Buffer.from(secret, "hex")).update(timestamp + rawBody).digest("hex");
  const a = Buffer.from(erwartet, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Einfache Sperre über sync_state (Ablaufzeit), damit Syncs nicht parallel laufen. Gibt null zurück, wenn belegt. */
export async function mitSperre<T>(key: string, sekunden: number, fn: () => Promise<T>): Promise<T | null> {
  const sb = adminClient();
  const { data } = await sb.from("sync_state").select("value").eq("key", key).maybeSingle();
  if (data?.value && new Date(data.value).getTime() > Date.now()) return null;
  await sb.from("sync_state").upsert({ key, value: new Date(Date.now() + sekunden * 1000).toISOString(), updated_at: new Date().toISOString() });
  try {
    return await fn();
  } finally {
    await sb.from("sync_state").upsert({ key, value: new Date(0).toISOString(), updated_at: new Date().toISOString() });
  }
}

let feldCache: { at: number; lead: Record<string, string | undefined>; opp: Record<string, string | undefined> } | null = null;
async function feldIds(cl: CloseClient) {
  if (feldCache && Date.now() - feldCache.at < 10 * 60000) return feldCache;
  const [lead, opp] = await Promise.all([cl.alle("custom_field/lead/"), cl.alle("custom_field/opportunity/")]);
  const map = (defs: Record<string, { name: string }>, liste: any[]) =>
    Object.fromEntries(Object.entries(defs).map(([k, d]) => [k, liste.find((f) => f.name.toLowerCase() === d.name.toLowerCase())?.id as string | undefined]));
  feldCache = { at: Date.now(), lead: map(LEAD_FELDER, lead), opp: map(OPP_FELDER, opp) };
  return feldCache;
}

async function icpMinTeam() {
  const { data } = await adminClient().from("settings").select("data").eq("id", 1).maybeSingle();
  return mergeSettings(data?.data).icpMinTeam;
}

async function leadSicherstellen(cl: CloseClient, leadId: string) {
  const { data } = await adminClient().from("leads").select("id").eq("id", leadId).maybeSingle();
  if (data) return;
  const ids = await feldIds(cl);
  await upsert("leads", [leadZeile(await cl.get(`lead/${leadId}/`), ids.lead, await icpMinTeam())]);
}

export interface WebhookEvent { object_type?: string; action?: string; object_id?: string; lead_id?: string; data?: any }

/** Verarbeitet ein Close-Event. Gibt eine kurze Beschreibung zurück. */
export async function verarbeiteEvent(ev: WebhookEvent): Promise<string> {
  const sb = adminClient();
  const cl = new CloseClient();
  const typ = ev.object_type ?? "";
  const id = ev.object_id ?? ev.data?.id;
  if (!id) return "ohne object_id ignoriert";

  if (ev.action === "deleted") {
    if (typ === "activity.custom_activity") { await sb.from("close_protokolle").delete().eq("id", id); return `Protokoll ${id} gelöscht`; }
    const tabelle = typ === "lead" ? "leads" : typ === "opportunity" ? "opportunities" : typ === "activity.meeting" ? "meetings" : typ === "activity.call" ? "calls" : typ.startsWith("task") ? "tasks" : null;
    if (tabelle) await sb.from(tabelle).delete().eq("id", id);
    return `${typ} ${id} gelöscht`;
  }

  switch (typ) {
    case "lead": {
      const ids = await feldIds(cl);
      await upsert("leads", [leadZeile(await cl.get(`lead/${id}/`), ids.lead, await icpMinTeam())]);
      if (ev.action === "created") {
        const { verarbeiteNeuenLead } = await import("./automatik");
        return `lead ${id} · ${await verarbeiteNeuenLead(id)}`;
      }
      return `lead ${id}`;
    }
    case "opportunity":
    case "activity.opportunity_status_change": {
      const oppId = typ === "opportunity" ? id : ev.data?.opportunity_id;
      if (!oppId) return "Status-Change ohne Opp";
      if (typ === "activity.opportunity_status_change") {
        const c = ev.data ?? (await cl.get(`activity/status_change/opportunity/${id}/`));
        await upsert("opp_status_changes", [{ id, opp_id: c.opportunity_id, lead_id: c.lead_id, von: c.old_status_label, nach: c.new_status_label, at: c.date_created, user_id: c.user_id }]);
      }
      const o = await cl.get(`opportunity/${oppId}/`);
      await leadSicherstellen(cl, o.lead_id);
      const ids = await feldIds(cl);
      const [{ data: hist }, offeneTasks] = await Promise.all([
        sb.from("opp_status_changes").select("nach,at").eq("opp_id", oppId),
        cl.get(`task/?lead_id=${o.lead_id}&is_complete=false&_limit=1`),
      ]);
      const mitAufgabe = new Set<string>((offeneTasks.data ?? []).length ? [o.lead_id] : []);
      await upsert("opportunities", [oppZeile(o, ids.opp, hist ?? [], mitAufgabe)]);
      return `opportunity ${oppId}`;
    }
    case "activity.meeting": {
      const m = await cl.get(`activity/meeting/${id}/`);
      if (!m.lead_id || !m.starts_at) return "Meeting ohne Lead/Start";
      await leadSicherstellen(cl, m.lead_id);
      const outcomes = m.outcome_id ? new Map((await cl.alle("outcome/")).map((x: any) => [x.id, x.name])) : new Map();
      await upsert("meetings", [{
        id: m.id, lead_id: m.lead_id, typ: meetingTyp(m.title), titel: m.title, booked_at: m.date_created, starts_at: m.starts_at,
        outcome: meetingOutcome(outcomes.get(m.outcome_id), m.status), user_id: m.user_id, updated_at: new Date().toISOString(),
      }]);
      return `meeting ${id}`;
    }
    case "activity.call": {
      const c = await cl.get(`activity/call/${id}/`);
      if (!c.lead_id) return "Call ohne Lead";
      await leadSicherstellen(cl, c.lead_id);
      await upsert("calls", [{
        id: c.id, lead_id: c.lead_id, user_id: c.user_id, at: c.date_created, direction: c.direction, duration_sec: c.duration ?? 0,
        answered: c.disposition === "answered" && (c.duration ?? 0) >= 20, disposition: c.disposition,
      }]);
      return `call ${id}`;
    }
    case "task.lead": {
      const t = await cl.get(`task/${id}/`);
      if (t.is_complete) await sb.from("tasks").delete().eq("id", id);
      else if (t.lead_id) {
        await leadSicherstellen(cl, t.lead_id);
        await upsert("tasks", [{ id: t.id, lead_id: t.lead_id, user_id: t.assigned_to, due: t.date ?? t.due_date ?? null, done: false, text: t.text }]);
      }
      // „Nächste Aufgabe“ an offenen Opps des Leads aktualisieren
      if (t.lead_id) {
        const offen = await cl.get(`task/?lead_id=${t.lead_id}&is_complete=false&_limit=1`);
        await sb.from("opportunities").update({ hat_naechste_aufgabe: (offen.data ?? []).length > 0 }).eq("lead_id", t.lead_id).not("stage", "in", "(won,lost)");
      }
      return `task ${id}`;
    }
    case "activity.custom_activity": {
      // Gesprächsprotokolle → Automatik (standardmäßig aus = nur protokollieren)
      if (ev.action !== "created" && ev.action !== "updated") return `custom_activity ${ev.action} ignoriert`;
      const { verarbeiteProtokoll } = await import("./automatik");
      const leadId = ev.lead_id ?? ev.data?.lead_id;
      if (leadId) await leadSicherstellen(cl, leadId);
      return await verarbeiteProtokoll(id);
    }
    default: {
      // Unbekannter Typ → inkrementeller Abgleich als Sicherheitsnetz
      const r = await mitSperre("close_sync_lock", 600, () => syncClose());
      return r ? `unbekannter Typ ${typ} → Sync` : `unbekannter Typ ${typ}, Sync läuft bereits`;
    }
  }
}
