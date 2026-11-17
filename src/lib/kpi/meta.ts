// Zusatzberechnungen für die Meta-Ads-Seite (5.2).
import type { Dataset } from "../types";
import { addDays, tagKey } from "./zeit";
import { berechne, index, type Filter } from "./engine";

const t = (s: string | null | undefined) => (s ? new Date(s).getTime() : NaN);
const div = (a: number, b: number) => (b > 0 ? a / b : null);

export interface LeadKurz { id: string; name: string; createdAt: string; status: string; termin: boolean; show: boolean; gewonnen: boolean }

/** Leads je Anzeige, Anzeigengruppe und Kampagne (für die Lead-Liste in der Tabelle). */
export function leadsProEbene(ds: Dataset, f: Filter): Record<string, LeadKurz[]> {
  const ix = index(ds);
  const von = f.zeitraum.von.getTime(), bis = f.zeitraum.bis.getTime();
  const res: Record<string, LeadKurz[]> = {};
  for (const l of ds.leads) {
    if (!l.utmContent || l.quelle !== "meta") continue;
    const c = t(l.createdAt);
    if (c < von || c >= bis) continue;
    if (f.kundentyp && l.kundentyp !== f.kundentyp) continue;
    if (f.rep && l.setterId !== f.rep && l.closerId !== f.rep) continue;
    const ad = ix.adById.get(l.utmContent);
    if (f.kampagne && ad?.campaignId !== f.kampagne) continue;
    const ms = ix.meetingsByLead.get(l.id) ?? [];
    const os = ix.oppsByLead.get(l.id) ?? [];
    const offen = os.find((o) => o.stage !== "lost");
    const k: LeadKurz = {
      id: l.id, name: l.name, createdAt: l.createdAt,
      status: offen?.statusLabel ?? os[0]?.statusLabel ?? l.statusLabel ?? (ms.length ? "Termin" : "Neu"),
      termin: ms.some((m) => m.typ === "erstgespraech"),
      show: ms.some((m) => m.typ === "erstgespraech" && m.outcome === "stattgefunden"),
      gewonnen: os.some((o) => o.stage === "won"),
    };
    for (const key of [`ad:${l.utmContent}`, ad ? `adset:${ad.adsetId}` : null, ad ? `kampagne:${ad.campaignId}` : null]) {
      if (key) (res[key] ??= []).push(k);
    }
  }
  for (const k of Object.keys(res)) res[k].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res;
}

/** Video-Abbruchkurve je Anzeige (Anteil an Impressionen). */
export function videoKurven(ds: Dataset, f: Filter) {
  const von = f.zeitraum.von.getTime(), bis = f.zeitraum.bis.getTime();
  const agg = new Map<string, { imp: number; v3: number; p25: number; p50: number; p75: number; p100: number }>();
  for (const i of ds.insights) {
    const d = t(i.date + "T12:00:00");
    if (d < von || d >= bis) continue;
    const a = agg.get(i.adId) ?? { imp: 0, v3: 0, p25: 0, p50: 0, p75: 0, p100: 0 };
    a.imp += i.impressions; a.v3 += i.videoViews3s; a.p25 += i.p25; a.p50 += i.p50; a.p75 += i.p75; a.p100 += i.p100;
    agg.set(i.adId, a);
  }
  const res: Record<string, { stufe: string; anteil: number | null; anzahl: number }[]> = {};
  for (const [adId, a] of agg) {
    if (!a.v3) continue;
    res[adId] = [
      { stufe: "3 Sek.", anzahl: a.v3, anteil: div(a.v3, a.imp) },
      { stufe: "25 %", anzahl: a.p25, anteil: div(a.p25, a.imp) },
      { stufe: "50 %", anzahl: a.p50, anteil: div(a.p50, a.imp) },
      { stufe: "75 %", anzahl: a.p75, anteil: div(a.p75, a.imp) },
      { stufe: "100 %", anzahl: a.p100, anteil: div(a.p100, a.imp) },
    ];
  }
  return res;
}

const ALTER = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const PLATZ_LABEL: Record<string, string> = {
  "facebook|feed": "Facebook Feed", "instagram|feed": "Instagram Feed", "instagram|reels": "Instagram Reels", "instagram|stories": "Instagram Stories",
  "facebook|reels": "Facebook Reels", "facebook|story": "Facebook Stories", "audience_network|classic": "Audience Network", "messenger|messenger_inbox": "Messenger",
};
const GERAET_LABEL: Record<string, string> = { mobile_app: "Mobil (App)", desktop: "Desktop", mobile_web: "Mobil (Web)" };

export function breakdowns(ds: Dataset) {
  const ag = ds.breakdowns.filter((b) => b.dimension === "age_gender");
  const zelle = (alter: string, g: string) => {
    const b = ag.find((x) => x.key === `${alter}|${g}`);
    return { spend: b?.spend ?? 0, leads: b?.metaLeads ?? 0, cpl: b ? div(b.spend, b.metaLeads) : null };
  };
  const heatmap = ALTER.filter((a) => ag.some((b) => b.key.startsWith(a + "|"))).map((alter) => ({ alter, m: zelle(alter, "male"), w: zelle(alter, "female") }));
  const liste = (dim: "platform_position" | "device", labels: Record<string, string>) =>
    ds.breakdowns.filter((b) => b.dimension === dim).map((b) => ({
      name: labels[b.key] ?? b.key.replace("|", " · "), spend: b.spend, leads: b.metaLeads, cpl: div(b.spend, b.metaLeads), ctr: div(b.linkClicks, b.impressions),
    })).sort((a, b) => b.spend - a.spend);
  return { heatmap, platzierungen: liste("platform_position", PLATZ_LABEL), geraete: liste("device", GERAET_LABEL) };
}

/** Leads laut Meta vs. in Close pro Tag. */
export function abgleich(ds: Dataset, f: Filter) {
  const tage: { tag: string; label: string; meta: number; close: number; abw: number | null }[] = [];
  for (let d = new Date(f.zeitraum.von); d < f.zeitraum.bis; d = addDays(d, 1)) {
    const k = berechne(ds, { ...f, quelle: "meta", sicht: "ereignis", zeitraum: { key: "frei", von: d, bis: addDays(d, 1), label: "" } });
    tage.push({ tag: tagKey(d), label: d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }), meta: k.metaLeads, close: k.leadsMeta, abw: k.metaLeads ? (k.leadsMeta - k.metaLeads) / k.metaLeads : null });
  }
  const meta = tage.reduce((s, x) => s + x.meta, 0), close = tage.reduce((s, x) => s + x.close, 0);
  return { tage, meta, close, abw: meta ? (close - meta) / meta : null };
}

export interface BudgetZeile { id: string; name: string; tagesbudget: number | null; spendMtd: number; plan: number | null; quote: number | null; kostenShow: number | null; abschluesse: number; shows: number; aktion: string; ton: "gut" | "warn" | "neutral" }

/** Budget-Steuerung je Kampagne, Monat bis heute. */
export function budget(ds: Dataset, now = new Date(), zielKostenShow = 200): BudgetZeile[] {
  const von = new Date(now.getFullYear(), now.getMonth(), 1);
  const bis = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1);
  const tage = Math.round((bis.getTime() - von.getTime()) / 86400000);
  const kampagnen = [...new Map(ds.ads.map((a) => [a.campaignId, a])).values()];
  return kampagnen.map((a) => {
    const k = berechne(ds, { sicht: "ereignis", kampagne: a.campaignId, zeitraum: { key: "monat", von, bis, label: "" }, now });
    const plan = a.tagesbudget != null ? a.tagesbudget * tage : null;
    let aktion = "Beobachten", ton: BudgetZeile["ton"] = "neutral";
    if (k.kostenShow != null && k.kostenShow < zielKostenShow && k.abschluesse > 0) { aktion = "Budget +20 %"; ton = "gut"; }
    else if (k.spend > 300 && k.egShows === 0) { aktion = "Prüfen / pausieren"; ton = "warn"; }
    else if (k.kostenShow != null && k.kostenShow > zielKostenShow * 1.5) { aktion = "Creatives tauschen"; ton = "warn"; }
    return { id: a.campaignId, name: a.campaignName, tagesbudget: a.tagesbudget ?? null, spendMtd: k.spend, plan, quote: plan ? k.spend / plan : null, kostenShow: k.kostenShow, abschluesse: k.abschluesse, shows: k.egShows, aktion, ton };
  }).sort((a, b) => b.spendMtd - a.spendMtd);
}
