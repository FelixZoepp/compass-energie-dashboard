import "server-only";
import { DEFAULT_SETTINGS } from "../kpi/katalog";
import { adminClient, alleZeilen } from "../supabase/admin";
import { supabaseKonfiguriert } from "../supabase/env";
import type { Dataset, Settings } from "../types";
import { demoDataset } from "./demo";

/* eslint-disable @typescript-eslint/no-explicit-any */

let memo: { at: number; ds: Dataset } | null = null;
const TTL = 60_000;

/** Lädt das komplette Dataset (Supabase, sonst Demo). 60 s im Speicher gecacht. */
export async function ladeDataset(opts: { frisch?: boolean } = {}): Promise<Dataset> {
  if (!opts.frisch && memo && Date.now() - memo.at < TTL) return memo.ds;
  const ds = await laden();
  memo = { at: Date.now(), ds };
  return ds;
}

export function cacheLeeren() {
  memo = null;
}

async function laden(): Promise<Dataset> {
  if (process.env.DEMO_DATEN === "1" || !supabaseKonfiguriert()) return demoDataset();
  try {
    const ds = await ausSupabase();
    // Solange weder Leads noch Ads da sind, Demo zeigen (mit Banner) – außer DEMO_DATEN=0
    if (!ds.leads.length && !ds.insights.length && process.env.DEMO_DATEN !== "0") {
      const demo = demoDataset();
      return { ...demo, settings: { ...demo.settings, ...ds.settings, monatsziel: { ...demo.settings.monatsziel, ...ds.settings.monatsziel } } };
    }
    return ds;
  } catch (e) {
    const demo = demoDataset();
    return { ...demo, syncFehler: `Datenbank nicht erreichbar: ${(e as Error).message}` };
  }
}

export async function ladeSettings(): Promise<Settings> {
  if (!supabaseKonfiguriert()) return demoDataset().settings;
  const { data } = await adminClient().from("settings").select("data").eq("id", 1).maybeSingle();
  return mergeSettings(data?.data);
}

export function mergeSettings(raw: any): Settings {
  const d = (raw ?? {}) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...d,
    arbeitszeit: { ...DEFAULT_SETTINGS.arbeitszeit, ...(d.arbeitszeit ?? {}) },
    stageWahrscheinlichkeit: { ...DEFAULT_SETTINGS.stageWahrscheinlichkeit, ...(d.stageWahrscheinlichkeit ?? {}) },
    listenpreise: { ...DEFAULT_SETTINGS.listenpreise, ...(d.listenpreise ?? {}) },
    schwellen: { ...(d.schwellen ?? {}) },
    monatsziel: { ...(d.monatsziel ?? {}) },
    repZiele: { ...(d.repZiele ?? {}) },
  };
}

async function ausSupabase(): Promise<Dataset> {
  const seit = new Date(Date.now() - 400 * 86400000).toISOString();
  const [reps, leads, meetings, calls, opps, tasks, payments, ads, insights, breakdowns, settings, letzterSync] = await Promise.all([
    alleZeilen<any>("reps"),
    alleZeilen<any>("leads", "id,name,created_at,quelle,utm_source,utm_medium,utm_campaign,utm_term,utm_content,kundentyp,rolle,teamgroesse,qualifiziert,setter_id,closer_id,status_label"),
    alleZeilen<any>("meetings"),
    alleZeilen<any>("calls", "id,lead_id,user_id,at,direction,duration_sec,answered", (q) => q.gte("at", seit)),
    alleZeilen<any>("opportunities"),
    alleZeilen<any>("tasks", "id,lead_id,user_id,due,done", (q) => q.eq("done", false)),
    alleZeilen<any>("payments"),
    alleZeilen<any>("meta_ads"),
    alleZeilen<any>("meta_insights", "*", (q) => q.gte("date", seit.slice(0, 10))),
    alleZeilen<any>("meta_breakdowns", "*", (q) => q.gte("date", new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10))),
    adminClient().from("settings").select("data").eq("id", 1).maybeSingle(),
    adminClient().from("sync_runs").select("quelle,finished_at,ok,fehler").order("started_at", { ascending: false }).limit(20),
  ]);

  const runs = (letzterSync.data ?? []) as { quelle: string; finished_at: string | null; ok: boolean | null; fehler: string | null }[];
  const ok = runs.filter((r) => r.ok && r.finished_at);
  const fehler = ["close", "meta"].map((q) => runs.find((r) => r.quelle === q)).filter((r) => r && r.ok === false);

  // Breakdowns über Tage aufsummieren
  const bd = new Map<string, any>();
  for (const b of breakdowns) {
    const k = `${b.dimension}|${b.key}`;
    const x = bd.get(k) ?? { dimension: b.dimension, key: b.key, spend: 0, impressions: 0, linkClicks: 0, metaLeads: 0 };
    x.spend += Number(b.spend); x.impressions += b.impressions; x.linkClicks += b.link_clicks; x.metaLeads += b.meta_leads;
    bd.set(k, x);
  }

  return {
    quelle: "supabase",
    stand: ok[0]?.finished_at ?? new Date(0).toISOString(),
    syncFehler: fehler.length ? fehler.map((f) => `${f!.quelle}: ${f!.fehler}`).join(" · ") : null,
    reps: reps.map((r) => ({ id: r.id, name: r.name, rolle: r.rolle, aktiv: r.aktiv })),
    leads: leads.map((l) => ({
      id: l.id, name: l.name, createdAt: l.created_at, quelle: l.quelle,
      utmSource: l.utm_source, utmMedium: l.utm_medium, utmCampaign: l.utm_campaign, utmTerm: l.utm_term, utmContent: l.utm_content,
      kundentyp: l.kundentyp, rolle: l.rolle, teamgroesse: l.teamgroesse, qualifiziert: l.qualifiziert,
      setterId: l.setter_id, closerId: l.closer_id, statusLabel: l.status_label,
    })),
    meetings: meetings.map((m) => ({ id: m.id, leadId: m.lead_id, typ: m.typ, bookedAt: m.booked_at, startsAt: m.starts_at, outcome: m.outcome, userId: m.user_id })),
    calls: calls.map((c) => ({ id: c.id, leadId: c.lead_id, userId: c.user_id, at: c.at, direction: c.direction, durationSec: c.duration_sec, answered: c.answered })),
    opps: opps.map((o) => ({
      id: o.id, leadId: o.lead_id, stage: o.stage, statusLabel: o.status_label, value: Number(o.value), listenpreis: o.listenpreis != null ? Number(o.listenpreis) : null,
      paket: o.paket, plaetze: o.plaetze, zahlungsart: o.zahlungsart, verlustgrund: o.verlustgrund, createdAt: o.created_at,
      wonAt: o.won_at, lostAt: o.lost_at, angebotAm: o.angebot_am, stageSince: o.stage_since, closeDate: o.close_date, userId: o.user_id,
      hatNaechsteAufgabe: o.hat_naechste_aufgabe, cashCollected: o.cash_collected != null ? Number(o.cash_collected) : null,
    })),
    tasks: tasks.map((x) => ({ id: x.id, leadId: x.lead_id, userId: x.user_id, due: x.due, done: x.done })),
    payments: [
      ...payments.map((p) => ({ id: p.id, leadId: p.lead_id, oppId: p.opp_id, at: p.at, amount: Number(p.amount) })),
      // Übergangslösung: Feld „Cash collected“ an der Opp, solange kein Zahlungstool angebunden ist
      ...(payments.length ? [] : opps.filter((o) => Number(o.cash_collected) > 0).map((o) => ({ id: `cf_${o.id}`, leadId: o.lead_id, oppId: o.id, at: o.won_at ?? o.updated_at, amount: Number(o.cash_collected) }))),
    ],
    ads: ads.map((a) => ({
      adId: a.ad_id, adName: a.ad_name, adsetId: a.adset_id, adsetName: a.adset_name, campaignId: a.campaign_id, campaignName: a.campaign_name,
      status: a.status, tagesbudget: a.tagesbudget != null ? Number(a.tagesbudget) : null, thumbnailUrl: a.thumbnail_url, body: a.body, title: a.title, isVideo: a.is_video,
    })),
    insights: insights.map((i) => ({
      date: i.date, adId: i.ad_id, spend: Number(i.spend), impressions: i.impressions, reach: i.reach, linkClicks: i.link_clicks, lpViews: i.lp_views,
      videoViews3s: i.video_views_3s, thruplays: i.thruplays, p25: i.p25, p50: i.p50, p75: i.p75, p100: i.p100,
      metaLeads: i.meta_leads, metaSchedules: i.meta_schedules, metaPurchases: i.meta_purchases,
    })),
    breakdowns: [...bd.values()],
    settings: mergeSettings(settings.data?.data),
  };
}
