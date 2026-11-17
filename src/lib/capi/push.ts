import "server-only";
// Close-Ereignisse → Meta Conversions API, damit Meta auf Käufer optimiert statt auf Formularausfüller.
// Lead = qualifizierter Lead, Schedule = Erstgespräch stattgefunden, Purchase = Gewonnen (mit Wert).
// Standardmäßig AUS (CAPI_AKTIV=1 schaltet ein). Jedes Ereignis wird genau einmal gesendet (capi_events).

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createHash } from "node:crypto";
import { adminClient } from "../supabase/admin";

const VERSION = process.env.META_API_VERSION || "v23.0";
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const normEmail = (e?: string | null) => (e ? e.trim().toLowerCase() : null);
const normTel = (t?: string | null) => {
  if (!t) return null;
  let d = t.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "49" + d.slice(1);
  return d || null;
};

interface Ereignis { event_id: string; event: "Lead" | "Schedule" | "Purchase"; lead: any; zeit: string; wert?: number }

export async function sammleEreignisse(tage = 7): Promise<Ereignis[]> {
  const sb = adminClient();
  const seit = new Date(Date.now() - tage * 86400000).toISOString();
  const [leads, meetings, opps] = await Promise.all([
    sb.from("leads").select("id,created_at,email,telefon,fbc,fbp,qualifiziert,quelle").gte("created_at", seit).eq("qualifiziert", true),
    sb.from("meetings").select("id,lead_id,starts_at,outcome,typ").eq("typ", "erstgespraech").eq("outcome", "stattgefunden").gte("starts_at", seit),
    sb.from("opportunities").select("id,lead_id,won_at,value,stage").eq("stage", "won").gte("won_at", seit),
  ]);
  const leadIds = new Set<string>([...(meetings.data ?? []).map((m: any) => m.lead_id), ...(opps.data ?? []).map((o: any) => o.lead_id)]);
  const extra = leadIds.size
    ? (await sb.from("leads").select("id,email,telefon,fbc,fbp,quelle").in("id", [...leadIds])).data ?? []
    : [];
  const leadMap = new Map<string, any>([...extra, ...(leads.data ?? [])].map((l: any) => [l.id, l]));
  const ev: Ereignis[] = [];
  for (const l of leads.data ?? []) ev.push({ event_id: `Lead:${l.id}`, event: "Lead", lead: l, zeit: l.created_at });
  // Erstes stattgefundenes Erstgespräch pro Lead
  const ersteShow = new Map<string, any>();
  for (const m of meetings.data ?? []) if (!ersteShow.has(m.lead_id) || m.starts_at < ersteShow.get(m.lead_id).starts_at) ersteShow.set(m.lead_id, m);
  for (const m of ersteShow.values()) if (leadMap.get(m.lead_id)) ev.push({ event_id: `Schedule:${m.lead_id}`, event: "Schedule", lead: leadMap.get(m.lead_id), zeit: m.starts_at });
  for (const o of opps.data ?? []) if (leadMap.get(o.lead_id)) ev.push({ event_id: `Purchase:${o.id}`, event: "Purchase", lead: leadMap.get(o.lead_id), zeit: o.won_at, wert: Number(o.value) });
  // Nur Leads mit Zuordnungsmerkmal
  return ev.filter((e) => e.lead.email || e.lead.telefon || e.lead.fbc || e.lead.fbp);
}

export async function pushCapi(opts: { testEventCode?: string | null; trocken?: boolean } = {}) {
  const pixel = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN || process.env.META_ACCESS_TOKEN;
  if (!pixel || !token) throw new Error("META_PIXEL_ID oder META_CAPI_TOKEN fehlt");
  const sb = adminClient();
  const alle = await sammleEreignisse();
  const { data: gesendet } = alle.length
    ? await sb.from("capi_events").select("event_id").in("event_id", alle.map((e) => e.event_id)).not("sent_at", "is", null)
    : { data: [] };
  const schon = new Set((gesendet ?? []).map((g: any) => g.event_id));
  const offen = alle.filter((e) => !schon.has(e.event_id));
  if (opts.trocken || !offen.length) return { offen: offen.length, gesendet: 0, ereignisse: offen.map((e) => e.event_id) };

  const data = offen.map((e) => {
    const em = normEmail(e.lead.email), ph = normTel(e.lead.telefon);
    return {
      event_name: e.event,
      event_time: Math.floor(new Date(e.zeit).getTime() / 1000),
      event_id: e.event_id,
      action_source: "system_generated",
      user_data: {
        ...(em ? { em: [sha(em)] } : {}),
        ...(ph ? { ph: [sha(ph)] } : {}),
        ...(e.lead.fbc ? { fbc: e.lead.fbc } : {}),
        ...(e.lead.fbp ? { fbp: e.lead.fbp } : {}),
        external_id: [sha(e.lead.id)],
      },
      custom_data: e.wert != null ? { value: e.wert, currency: "EUR" } : { lead_event_source: "Close CRM" },
    };
  });
  let gesendetAnz = 0;
  for (let i = 0; i < data.length; i += 500) {
    const teil = data.slice(i, i + 500);
    const res = await fetch(`https://graph.facebook.com/${VERSION}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: teil, ...(opts.testEventCode ? { test_event_code: opts.testEventCode } : {}) }),
    });
    const json = await res.json();
    const ok = res.ok && !json.error;
    await sb.from("capi_events").upsert(teil.map((t) => {
      const e = offen.find((x) => x.event_id === t.event_id)!;
      return {
        event_id: t.event_id, lead_id: e.lead.id, event: t.event_name, value: e.wert ?? null,
        // Test-Events nicht als „gesendet“ markieren, damit der echte Versand später erfolgt
        sent_at: ok && !opts.testEventCode ? new Date().toISOString() : null, antwort: json, fehler: ok ? null : json.error?.message ?? `HTTP ${res.status}`,
      };
    }));
    if (!ok) throw new Error(`CAPI: ${json.error?.message ?? res.status}`);
    gesendetAnz += teil.length;
  }
  return { offen: offen.length, gesendet: gesendetAnz };
}
