import "server-only";
// Close → Supabase. Inkrementell über Cursor in sync_state; beim ersten Lauf komplett.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { adminClient, upsert } from "../supabase/admin";
import { mergeSettings } from "../data";
import { CloseClient } from "./client";
import { LEAD_FELDER, OPP_FELDER, PIPELINE_STATUS, meetingOutcome, meetingTyp, quelleAus } from "./felder";

type FeldIds = Record<string, string | undefined>;

async function feldIds(cl: CloseClient) {
  const [lead, opp] = await Promise.all([cl.alle("custom_field/lead/"), cl.alle("custom_field/opportunity/")]);
  const map = (defs: Record<string, { name: string }>, liste: any[]): FeldIds =>
    Object.fromEntries(Object.entries(defs).map(([k, d]) => [k, liste.find((f) => f.name.toLowerCase() === d.name.toLowerCase())?.id]));
  return { lead: map(LEAD_FELDER, lead), opp: map(OPP_FELDER, opp) };
}

const cf = (obj: any, id?: string) => (id ? obj[`custom.${id}`] ?? null : null);
const num = (v: any) => (v == null || v === "" ? null : Number(v));
const isoOrNull = (v: any) => (v ? new Date(v).toISOString() : null);

async function getState(key: string) {
  const { data } = await adminClient().from("sync_state").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}
async function setState(key: string, value: string) {
  await adminClient().from("sync_state").upsert({ key, value, updated_at: new Date().toISOString() });
}

export interface SyncErgebnis { leads: number; opps: number; meetings: number; calls: number; statusChanges: number; tasks: number; reps: number; dauerMs: number }

export async function syncClose(opts: { voll?: boolean } = {}): Promise<SyncErgebnis> {
  const t0 = Date.now();
  const sb = adminClient();
  const run = await sb.from("sync_runs").insert({ quelle: "close" }).select("id").single();
  try {
    const cl = new CloseClient();
    const start = new Date(Date.now() - 5 * 60000).toISOString(); // Überlappung gegen Uhrenversatz
    const seit = opts.voll ? null : await getState("close_cursor");
    const ids = await feldIds(cl);
    const settingsRow = await sb.from("settings").select("data").eq("id", 1).maybeSingle();
    const settings = mergeSettings(settingsRow.data?.data);

    // Reps (Rolle aus dem Dashboard bleibt erhalten)
    const users = await cl.alle("user/");
    const vorhandeneReps = new Map(((await sb.from("reps").select("id,rolle,aktiv")).data ?? []).map((r: any) => [r.id, r]));
    await upsert("reps", users.map((u: any) => ({
      id: u.id, name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email, email: u.email,
      rolle: vorhandeneReps.get(u.id)?.rolle ?? "beides", aktiv: vorhandeneReps.get(u.id)?.aktiv ?? true, updated_at: new Date().toISOString(),
    })));

    // Leads
    const leadParams: Record<string, string> = { _fields: "id,display_name,date_created,date_updated,status_label,contacts,custom" + Object.values(ids.lead).filter(Boolean).map((i) => `,custom.${i}`).join("") };
    if (seit) leadParams.query = `date_updated >= "${seit}"`;
    const leads = await cl.alle("lead/", leadParams);
    await upsert("leads", leads.map((l) => leadZeile(l, ids.lead, settings.icpMinTeam)));

    // Opportunities
    const oppParams: Record<string, string> = {};
    if (seit) oppParams.date_updated__gte = seit;
    const opps = await cl.alle("opportunity/", oppParams);

    // Status-Wechsel (für Angebot-Datum, Verweildauer, Funnel-Historie)
    const scParams: Record<string, string> = {};
    if (seit) scParams.date_created__gte = seit;
    const changes = await cl.alle("activity/status_change/opportunity/", scParams);
    await upsert("opp_status_changes", changes.map((c: any) => ({
      id: c.id, opp_id: c.opportunity_id, lead_id: c.lead_id, von: c.old_status_label, nach: c.new_status_label, at: c.date_created, user_id: c.user_id,
    })));

    // Meetings + Calls
    const mParams: Record<string, string> = {};
    if (seit) mParams.date_updated__gte = seit;
    const meetings = await cl.alle("activity/meeting/", mParams);
    const outcomes = new Map((await cl.alle("outcome/").catch(() => [])).map((o: any) => [o.id, o.name]));
    const cParams: Record<string, string> = {};
    if (seit) cParams.date_created__gte = seit;
    const calls = await cl.alle("activity/call/", cParams);

    // Fehlende Leads nachladen (FK)
    const bekannt = new Set(leads.map((l) => l.id));
    const referenziert = new Set([...opps, ...meetings, ...calls].map((x: any) => x.lead_id).filter(Boolean));
    const vorhanden = new Set<string>();
    const fehlendKandidaten = [...referenziert].filter((id) => !bekannt.has(id));
    for (let i = 0; i < fehlendKandidaten.length; i += 200) {
      const { data } = await sb.from("leads").select("id").in("id", fehlendKandidaten.slice(i, i + 200));
      for (const r of data ?? []) vorhanden.add(r.id);
    }
    const nachladen = fehlendKandidaten.filter((id) => !vorhanden.has(id));
    for (const id of nachladen) {
      try { await upsert("leads", [leadZeile(await cl.get(`lead/${id}/`), ids.lead, settings.icpMinTeam)]); } catch { /* gelöscht */ }
    }

    // Offene Aufgaben (komplett ersetzen)
    const tasks = await cl.alle("task/", { is_complete: "false", _type: "lead" });
    await sb.from("tasks").delete().neq("id", "");
    await upsert("tasks", tasks.filter((x: any) => x.lead_id).map((x: any) => ({ id: x.id, lead_id: x.lead_id, user_id: x.assigned_to, due: x.date ?? x.due_date ?? null, done: false, text: x.text })));
    const leadsMitAufgabe = new Set(tasks.map((x: any) => x.lead_id));

    // Opps schreiben (braucht Status-Historie)
    const oppIds = opps.map((o: any) => o.id);
    const historie = new Map<string, any[]>();
    for (let i = 0; i < oppIds.length; i += 200) {
      const { data } = await sb.from("opp_status_changes").select("opp_id,nach,at").in("opp_id", oppIds.slice(i, i + 200));
      for (const c of data ?? []) (historie.get(c.opp_id) ?? historie.set(c.opp_id, []).get(c.opp_id)!).push(c);
    }
    await upsert("opportunities", opps.map((o: any) => oppZeile(o, ids.opp, historie.get(o.id) ?? [], leadsMitAufgabe)));
    // „Nächste Aufgabe“ auch für nicht geänderte Opps aktualisieren
    const { data: offene } = await sb.from("opportunities").select("id,lead_id,hat_naechste_aufgabe").not("stage", "in", "(won,lost)");
    const korrigieren = (offene ?? []).filter((o: any) => o.hat_naechste_aufgabe !== leadsMitAufgabe.has(o.lead_id));
    for (const o of korrigieren) await sb.from("opportunities").update({ hat_naechste_aufgabe: leadsMitAufgabe.has(o.lead_id) }).eq("id", o.id);

    await upsert("meetings", meetings.filter((m: any) => m.lead_id && m.starts_at).map((m: any) => ({
      id: m.id, lead_id: m.lead_id, typ: meetingTyp(m.title), titel: m.title, booked_at: m.date_created, starts_at: m.starts_at,
      outcome: meetingOutcome(outcomes.get(m.outcome_id), m.status), user_id: m.user_id, updated_at: new Date().toISOString(),
    })));
    await upsert("calls", calls.filter((c: any) => c.lead_id).map((c: any) => ({
      id: c.id, lead_id: c.lead_id, user_id: c.user_id, at: c.date_created, direction: c.direction, duration_sec: c.duration ?? 0,
      answered: c.disposition === "answered" && (c.duration ?? 0) >= 20, disposition: c.disposition,
    })));

    await setState("close_cursor", start);
    const erg: SyncErgebnis = { leads: leads.length + nachladen.length, opps: opps.length, meetings: meetings.length, calls: calls.length, statusChanges: changes.length, tasks: tasks.length, reps: users.length, dauerMs: Date.now() - t0 };
    await sb.from("sync_runs").update({ finished_at: new Date().toISOString(), ok: true, details: erg }).eq("id", run.data?.id);
    return erg;
  } catch (e) {
    await sb.from("sync_runs").update({ finished_at: new Date().toISOString(), ok: false, fehler: (e as Error).message.slice(0, 500) }).eq("id", run.data?.id);
    throw e;
  }
}

export function leadZeile(l: any, ids: FeldIds, icpMinTeam: number) {
  const kontakt = (l.contacts ?? [])[0] ?? {};
  const kundentyp = cf(l, ids.kundentyp);
  const team = num(cf(l, ids.teamgroesse));
  const utmSource = cf(l, ids.utmSource);
  return {
    id: l.id,
    name: l.display_name || kontakt.name || l.id,
    created_at: l.date_created,
    quelle: quelleAus(cf(l, ids.quelle), utmSource),
    utm_source: utmSource, utm_medium: cf(l, ids.utmMedium), utm_campaign: cf(l, ids.utmCampaign), utm_term: cf(l, ids.utmTerm), utm_content: cf(l, ids.utmContent),
    fbclid: cf(l, ids.fbclid), fbc: cf(l, ids.fbc), fbp: cf(l, ids.fbp),
    email: kontakt.emails?.[0]?.email ?? null, telefon: kontakt.phones?.[0]?.phone ?? null,
    kundentyp: kundentyp === "B2B" || kundentyp === "B2C" ? kundentyp : null,
    rolle: cf(l, ids.rolle), teamgroesse: team,
    qualifiziert: kundentyp === "B2C" || (kundentyp === "B2B" && (team ?? 0) >= icpMinTeam),
    setter_id: cf(l, ids.setter), closer_id: cf(l, ids.closer),
    status_label: l.status_label,
    raw: { date_updated: l.date_updated },
    updated_at: new Date().toISOString(),
  };
}

const STAGE_BY_LABEL = new Map(PIPELINE_STATUS.map((s) => [s.label.toLowerCase(), s.stage]));

export function oppZeile(o: any, ids: FeldIds, hist: { nach: string; at: string }[], leadsMitAufgabe: Set<string>) {
  const label: string = o.status_label ?? "";
  const stage = o.status_type === "won" ? "won" : o.status_type === "lost" ? "lost"
    : STAGE_BY_LABEL.get(label.toLowerCase()) ?? (/angebot|proposal|contract/i.test(label) ? "angebot" : /closing|demo/i.test(label) ? "closing_terminiert" : "setting");
  const sortiert = [...hist].sort((a, b) => a.at.localeCompare(b.at));
  const letzte = sortiert.filter((h) => h.nach === label).pop();
  const angebotHist = sortiert.find((h) => /angebot/i.test(h.nach ?? ""));
  const wert = o.value != null ? Number(o.value) / 100 : 0; // Close: Cent
  return {
    id: o.id, lead_id: o.lead_id, stage, status_label: label, value: wert,
    listenpreis: num(cf(o, ids.listenpreis)), paket: cf(o, ids.paket), plaetze: num(cf(o, ids.plaetze)), zahlungsart: cf(o, ids.zahlungsart),
    verlustgrund: cf(o, ids.verlustgrund), created_at: o.date_created,
    won_at: stage === "won" ? isoOrNull(o.date_won ?? letzte?.at ?? o.date_updated) : null,
    lost_at: stage === "lost" ? isoOrNull(letzte?.at ?? o.date_updated) : null,
    angebot_am: isoOrNull(cf(o, ids.angebotAm) ?? angebotHist?.at),
    stage_since: letzte?.at ?? o.date_updated ?? o.date_created,
    close_date: stage !== "won" && stage !== "lost" ? o.date_won ?? null : null, // Close: date_won = erwartetes Abschlussdatum
    user_id: o.user_id, hat_naechste_aufgabe: leadsMitAufgabe.has(o.lead_id),
    cash_collected: num(cf(o, ids.cashCollected)), updated_at: new Date().toISOString(),
  };
}
