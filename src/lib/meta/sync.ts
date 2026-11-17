import "server-only";
// Meta Marketing API → Supabase. Insights auf Anzeigenebene, täglich.
// Meta korrigiert rückwirkend (Attribution) → jeder Lauf zieht die letzten N Tage neu und überschreibt.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { adminClient, upsert } from "../supabase/admin";

const VERSION = process.env.META_API_VERSION || "v23.0";
const token = () => {
  const t = process.env.META_ACCESS_TOKEN;
  if (!t) throw new Error("META_ACCESS_TOKEN fehlt");
  return t;
};
const konto = () => {
  const a = process.env.META_AD_ACCOUNT_ID;
  if (!a) throw new Error("META_AD_ACCOUNT_ID fehlt");
  return a.startsWith("act_") ? a : `act_${a}`;
};

async function graph(pfad: string, params: Record<string, string> = {}): Promise<any> {
  const url = pfad.startsWith("http") ? new URL(pfad) : new URL(`https://graph.facebook.com/${VERSION}/${pfad}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (!url.searchParams.has("access_token")) url.searchParams.set("access_token", token());
  for (let versuch = 0; ; versuch++) {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (json.error) {
      const code = json.error.code;
      if ((code === 4 || code === 17 || code === 80004 || code === 613) && versuch < 4) { await new Promise((r) => setTimeout(r, 15000 * (versuch + 1))); continue; }
      throw new Error(`Meta ${pfad.split("?")[0]}: ${json.error.message}`);
    }
    return json;
  }
}

async function alleSeiten(pfad: string, params: Record<string, string>) {
  const res: any[] = [];
  let json = await graph(pfad, { limit: "500", ...params });
  for (;;) {
    res.push(...(json.data ?? []));
    if (!json.paging?.next) break;
    json = await graph(json.paging.next);
  }
  return res;
}

const act = (arr: any[] | undefined, ...typen: string[]) => {
  if (!arr) return 0;
  for (const t of typen) { const x = arr.find((a) => a.action_type === t); if (x) return Number(x.value) || 0; }
  return 0;
};
const tag = (d: Date) => d.toISOString().slice(0, 10);

const INSIGHT_FELDER = [
  "ad_id", "spend", "impressions", "reach", "inline_link_clicks", "actions",
  "video_thruplay_watched_actions", "video_p25_watched_actions", "video_p50_watched_actions", "video_p75_watched_actions", "video_p100_watched_actions",
].join(",");

export async function syncMeta(opts: { tage?: number } = {}) {
  const sb = adminClient();
  const run = await sb.from("sync_runs").insert({ quelle: "meta" }).select("id").single();
  const t0 = Date.now();
  try {
    const tage = opts.tage ?? 28;
    const bis = new Date();
    const von = new Date(Date.now() - (tage - 1) * 86400000);
    const time_range = JSON.stringify({ since: tag(von), until: tag(bis) });

    const zeilen = await alleSeiten(`${konto()}/insights`, { level: "ad", time_increment: "1", fields: INSIGHT_FELDER, time_range, action_attribution_windows: '["7d_click","1d_view"]' });
    await upsert("meta_insights", zeilen.map((z) => ({
      date: z.date_start, ad_id: z.ad_id, spend: Number(z.spend ?? 0), impressions: Number(z.impressions ?? 0), reach: Number(z.reach ?? 0),
      link_clicks: Number(z.inline_link_clicks ?? 0), lp_views: act(z.actions, "landing_page_view", "omni_landing_page_view"),
      video_views_3s: act(z.actions, "video_view"), thruplays: act(z.video_thruplay_watched_actions, "video_view"),
      p25: act(z.video_p25_watched_actions, "video_view"), p50: act(z.video_p50_watched_actions, "video_view"),
      p75: act(z.video_p75_watched_actions, "video_view"), p100: act(z.video_p100_watched_actions, "video_view"),
      meta_leads: act(z.actions, "lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped"),
      meta_schedules: act(z.actions, "schedule", "offsite_conversion.fb_pixel_custom", "onsite_web_schedule"),
      meta_purchases: act(z.actions, "purchase", "offsite_conversion.fb_pixel_purchase"),
      updated_at: new Date().toISOString(),
    })), "date,ad_id");

    // Breakdowns (Summe je Tag) – kürzerer Zeitraum reicht
    const bdRange = JSON.stringify({ since: tag(new Date(Date.now() - Math.min(tage, 14) * 86400000)), until: tag(bis) });
    const bdZeilen: any[] = [];
    for (const [dimension, breakdowns] of [["age_gender", "age,gender"], ["platform_position", "publisher_platform,platform_position"], ["device", "device_platform"]] as const) {
      const r = await alleSeiten(`${konto()}/insights`, { level: "account", time_increment: "1", breakdowns, fields: "spend,impressions,inline_link_clicks,actions", time_range: bdRange });
      for (const z of r) {
        const key = dimension === "age_gender" ? `${z.age}|${z.gender}` : dimension === "platform_position" ? `${z.publisher_platform}|${z.platform_position}` : z.device_platform;
        bdZeilen.push({ date: z.date_start, dimension, key, spend: Number(z.spend ?? 0), impressions: Number(z.impressions ?? 0), link_clicks: Number(z.inline_link_clicks ?? 0), meta_leads: act(z.actions, "lead", "offsite_conversion.fb_pixel_lead") });
      }
    }
    await upsert("meta_breakdowns", bdZeilen, "date,dimension,key");

    const erg = { insights: zeilen.length, breakdowns: bdZeilen.length, tage, dauerMs: Date.now() - t0 };
    await sb.from("sync_runs").update({ finished_at: new Date().toISOString(), ok: true, details: erg }).eq("id", run.data?.id);
    return erg;
  } catch (e) {
    await sb.from("sync_runs").update({ finished_at: new Date().toISOString(), ok: false, fehler: (e as Error).message.slice(0, 500) }).eq("id", run.data?.id);
    throw e;
  }
}

/** Anzeigen-Struktur + Creatives (Name, Status, Budget, Thumbnail, Text). */
export async function syncMetaCreatives() {
  const sb = adminClient();
  const run = await sb.from("sync_runs").insert({ quelle: "meta-creatives" }).select("id").single();
  try {
    const [ads, kampagnen] = await Promise.all([
      alleSeiten(`${konto()}/ads`, { fields: "id,name,effective_status,adset{id,name,daily_budget,optimization_goal},campaign{id,name,daily_budget},creative{thumbnail_url,body,title,video_id,call_to_action_type,object_type}" }),
      alleSeiten(`${konto()}/campaigns`, { fields: "id,daily_budget" }),
    ]);
    const kBudget = new Map(kampagnen.map((k: any) => [k.id, k.daily_budget]));
    await upsert("meta_ads", ads.map((a: any) => {
      const budget = a.campaign?.daily_budget ?? kBudget.get(a.campaign?.id) ?? a.adset?.daily_budget;
      return {
        ad_id: a.id, ad_name: a.name, adset_id: a.adset?.id ?? "", adset_name: a.adset?.name ?? null,
        campaign_id: a.campaign?.id ?? "", campaign_name: a.campaign?.name ?? null,
        status: a.effective_status === "ACTIVE" ? "ACTIVE" : a.effective_status === "ARCHIVED" || a.effective_status === "DELETED" ? "ARCHIVED" : "PAUSED",
        tagesbudget: budget ? Number(budget) / 100 : null, optimierungsziel: a.adset?.optimization_goal ?? null,
        thumbnail_url: a.creative?.thumbnail_url ?? null, body: a.creative?.body ?? null, title: a.creative?.title ?? null,
        video_id: a.creative?.video_id ?? null, cta: a.creative?.call_to_action_type ?? null,
        is_video: !!a.creative?.video_id || a.creative?.object_type === "VIDEO", updated_at: new Date().toISOString(),
      };
    }), "ad_id");
    await sb.from("sync_runs").update({ finished_at: new Date().toISOString(), ok: true, details: { ads: ads.length } }).eq("id", run.data?.id);
    return { ads: ads.length };
  } catch (e) {
    await sb.from("sync_runs").update({ finished_at: new Date().toISOString(), ok: false, fehler: (e as Error).message.slice(0, 500) }).eq("id", run.data?.id);
    throw e;
  }
}
