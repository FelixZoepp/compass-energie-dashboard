// KPI-Engine: rechnet alle Kennzahlen aus dem Dataset. Raten immer aus Summen.
// Ereignissicht: jedes Ereignis zählt an seinem Datum.
// Kohortensicht: alles wird dem Eintragungsdatum des Leads zugeordnet.

import type { AdEntity, AdInsight, Dataset, Lead, Meeting, Opportunity, OppStage, Quelle, Kundentyp } from "../types";
import { arbeitsMinuten, arbeitstage, isoWoche, tagKey, wochenStart, addDays, type Zeitraum } from "./zeit";

export type Sicht = "ereignis" | "kohorte";

export interface Filter {
  zeitraum: Zeitraum;
  sicht: Sicht;
  quelle?: Quelle | null;
  kampagne?: string | null;
  rep?: string | null;
  kundentyp?: Kundentyp | null;
  now?: Date;
}

const t = (s: string | null | undefined) => (s ? new Date(s).getTime() : NaN);
const div = (a: number, b: number) => (b > 0 ? a / b : null);
const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + (f(x) || 0), 0);
export function median(a: number[]): number | null {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Vorbereitete Indizes, einmal pro Dataset. */
export class Index {
  leadById = new Map<string, Lead>();
  adById = new Map<string, AdEntity>();
  meetingsByLead = new Map<string, Meeting[]>();
  oppsByLead = new Map<string, Opportunity[]>();
  firstCallByLead = new Map<string, number>();
  constructor(public ds: Dataset) {
    for (const l of ds.leads) this.leadById.set(l.id, l);
    for (const a of ds.ads) this.adById.set(a.adId, a);
    for (const m of ds.meetings) (this.meetingsByLead.get(m.leadId) ?? this.meetingsByLead.set(m.leadId, []).get(m.leadId)!).push(m);
    for (const o of ds.opps) (this.oppsByLead.get(o.leadId) ?? this.oppsByLead.set(o.leadId, []).get(o.leadId)!).push(o);
    for (const c of ds.calls) {
      if (c.direction !== "outbound") continue;
      const v = t(c.at);
      const alt = this.firstCallByLead.get(c.leadId);
      if (alt == null || v < alt) this.firstCallByLead.set(c.leadId, v);
    }
  }
}

const cache = new WeakMap<Dataset, Index>();
export function index(ds: Dataset) {
  let i = cache.get(ds);
  if (!i) { i = new Index(ds); cache.set(ds, i); }
  return i;
}

export interface Kennzahlen {
  // Meta
  spend: number; impressions: number; reach: number; linkClicks: number; lpViews: number; v3: number; thru: number; metaLeads: number;
  frequency: number | null; cpm: number | null; hookRate: number | null; holdRate: number | null; ctr: number | null; cpc: number | null; lpLoad: number | null; lpConv: number | null;
  // Leads/Termine
  leads: number; leadsMeta: number; leadsQuali: number; leadsOhneUtm: number;
  cpl: number | null; qualiQuote: number | null; kostenQualiLead: number | null;
  egGebucht: number; egFaellig: number; egShows: number; egNoShows: number;
  buchungsquote: number | null; kostenTermin: number | null; kostenShow: number | null;
  // Setting
  anwahlen: number; leadsAngerufen: number; leadsErreicht: number; gespraechsMin: number;
  speedToLead: number | null; unter5: number | null; speedBasis: number; anwahlenProLead: number | null; erreichbarkeit: number | null;
  showRateEG: number | null; qualifizierungsquote: number | null; noShowRecovery: number | null; noShowBasis: number;
  // Closing
  bgGebucht: number; bgFaellig: number; bgShows: number; angebote: number; abschluesse: number; abschluesseAusAngebot: number;
  showRateBG: number | null; closingRate: number | null; angebotsquote: number | null; angebotsAbschluss: number | null;
  umsatz: number; aov: number | null; plaetzeB2B: number | null; rabattquote: number | null; rabattBasis: number; salesCycle: number | null;
  verlustgruende: { grund: string; anzahl: number }[];
  // Unit Economics
  cash: number; cashQuote: number | null; abschluesseMeta: number; umsatzMeta: number; cashMeta: number;
  cac: number | null; cacVoll: number | null; roas: number | null; cashRoas: number | null; mer: number | null; deckungsbeitrag: number | null; ltvCac: number | null;
}

interface Scope {
  leads: Lead[];
  leadIds: Set<string>;
  kohorte: Set<string>; // Leads mit Eintragung im Zeitraum
  inRange: (iso: string | null | undefined) => boolean;
  zaehlt: (leadId: string, iso: string | null | undefined) => boolean;
  insights: AdInsight[];
  metaSpendErlaubt: boolean;
}

function scope(ds: Dataset, f: Filter): Scope {
  const ix = index(ds);
  const von = f.zeitraum.von.getTime(), bis = f.zeitraum.bis.getTime();
  const inRange = (iso: string | null | undefined) => { const v = t(iso); return v >= von && v < bis; };
  const leads = ds.leads.filter((l) =>
    (!f.quelle || l.quelle === f.quelle) &&
    (!f.kampagne || l.utmCampaign === f.kampagne) &&
    (!f.kundentyp || l.kundentyp === f.kundentyp) &&
    (!f.rep || l.setterId === f.rep || l.closerId === f.rep));
  const leadIds = new Set(leads.map((l) => l.id));
  const kohorte = new Set(leads.filter((l) => inRange(l.createdAt)).map((l) => l.id));
  const zaehlt = f.sicht === "kohorte"
    ? (leadId: string, iso: string | null | undefined) => kohorte.has(leadId) && !!iso
    : (leadId: string, iso: string | null | undefined) => leadIds.has(leadId) && inRange(iso);
  const metaSpendErlaubt = !f.quelle || f.quelle === "meta";
  const insights = metaSpendErlaubt
    ? ds.insights.filter((i) => {
        if (!inRange(i.date + "T12:00:00")) return false;
        if (f.kampagne) return ix.adById.get(i.adId)?.campaignId === f.kampagne;
        return true;
      })
    : [];
  return { leads, leadIds, kohorte, inRange, zaehlt, insights, metaSpendErlaubt };
}

const faellig = (m: Meeting, now: number) => t(m.startsAt) < now && m.outcome !== "verschoben" && m.outcome !== "abgesagt";

export function berechne(ds: Dataset, f: Filter): Kennzahlen {
  const now = (f.now ?? new Date()).getTime();
  const ix = index(ds);
  const s = scope(ds, f);
  const st = ds.settings;

  // Meta
  const spend = sum(s.insights, (i) => i.spend);
  const impressions = sum(s.insights, (i) => i.impressions);
  const reach = sum(s.insights, (i) => i.reach);
  const linkClicks = sum(s.insights, (i) => i.linkClicks);
  const lpViews = sum(s.insights, (i) => i.lpViews);
  const v3 = sum(s.insights, (i) => i.videoViews3s);
  const thru = sum(s.insights, (i) => i.thruplays);
  const metaLeads = sum(s.insights, (i) => i.metaLeads);

  // Leads (immer nach Eintragungsdatum)
  const leadsIm = s.leads.filter((l) => s.inRange(l.createdAt));
  const leadsMetaArr = leadsIm.filter((l) => l.quelle === "meta");
  const leadsQuali = leadsIm.filter((l) => l.qualifiziert).length;
  const leadsOhneUtm = leadsMetaArr.filter((l) => !l.utmContent).length;

  // Meetings
  const ms = ds.meetings.filter((m) => s.leadIds.has(m.leadId));
  const eg = ms.filter((m) => m.typ === "erstgespraech");
  const bg = ms.filter((m) => m.typ === "beratung" || m.typ === "cc2");
  const egGebucht = eg.filter((m) => s.zaehlt(m.leadId, m.bookedAt)).length;
  const egF = eg.filter((m) => s.zaehlt(m.leadId, m.startsAt) && faellig(m, now));
  const egShows = egF.filter((m) => m.outcome === "stattgefunden").length;
  const egNoShowsArr = egF.filter((m) => m.outcome === "no_show");
  const recovered = egNoShowsArr.filter((m) =>
    (ix.meetingsByLead.get(m.leadId) ?? []).some((x) => x.typ === "erstgespraech" && x.outcome === "stattgefunden" && t(x.startsAt) > t(m.startsAt))).length;
  const bgGebucht = bg.filter((m) => m.typ === "beratung" && s.zaehlt(m.leadId, m.bookedAt)).length;
  const bgF = bg.filter((m) => s.zaehlt(m.leadId, m.startsAt) && faellig(m, now));
  const bgShows = bgF.filter((m) => m.outcome === "stattgefunden").length;

  // Calls
  const calls = ds.calls.filter((c) => c.direction === "outbound" && s.zaehlt(c.leadId, c.at) && (!f.rep || c.userId === f.rep));
  const angerufen = new Set(calls.map((c) => c.leadId));
  const erreicht = new Set(calls.filter((c) => c.answered).map((c) => c.leadId));
  const gespraechsMin = sum(calls.filter((c) => c.answered), (c) => c.durationSec) / 60;
  const speeds: number[] = [];
  for (const l of leadsIm) {
    const fc = ix.firstCallByLead.get(l.id);
    if (fc == null) continue;
    speeds.push(arbeitsMinuten(new Date(l.createdAt), new Date(fc), st));
  }

  // Opps
  const opps = ds.opps.filter((o) => s.leadIds.has(o.leadId));
  const won = opps.filter((o) => o.stage === "won" && s.zaehlt(o.leadId, o.wonAt));
  const lost = opps.filter((o) => o.stage === "lost" && s.zaehlt(o.leadId, o.lostAt));
  const angebote = opps.filter((o) => s.zaehlt(o.leadId, o.angebotAm));
  const umsatz = sum(won, (o) => o.value);
  const mitListe = won.filter((o) => o.listenpreis);
  const listeSumme = sum(mitListe, (o) => o.listenpreis ?? 0);
  const b2bWon = won.filter((o) => ix.leadById.get(o.leadId)?.kundentyp === "B2B");
  const cycles = won.map((o) => (t(o.wonAt) - t(ix.leadById.get(o.leadId)?.createdAt)) / 86400000).filter((x) => x >= 0);
  const vg = new Map<string, number>();
  for (const o of lost) vg.set(o.verlustgrund || "ohne Angabe", (vg.get(o.verlustgrund || "ohne Angabe") ?? 0) + 1);

  // Cash
  const pays = ds.payments.filter((p) => (p.leadId ? s.zaehlt(p.leadId, p.at) : !f.rep && !f.quelle && !f.kampagne && !f.kundentyp && f.sicht === "ereignis" && s.inRange(p.at)));
  const cash = sum(pays, (p) => p.amount);

  // Meta-Zuordnung, ROAS immer kohortenbasiert
  const istMeta = (leadId: string) => ix.leadById.get(leadId)?.quelle === "meta";
  const wonMeta = won.filter((o) => istMeta(o.leadId));
  const kohMeta = new Set([...s.kohorte].filter(istMeta));
  const umsatzMetaKoh = sum(opps.filter((o) => o.stage === "won" && kohMeta.has(o.leadId)), (o) => o.value);
  const cashMetaKoh = sum(ds.payments.filter((p) => p.leadId && kohMeta.has(p.leadId)), (p) => p.amount);
  const aov = div(umsatz, won.length);
  const cac = div(spend, wonMeta.length);
  const provision = umsatz * st.provisionsquote;
  const tage = (f.zeitraum.bis.getTime() - f.zeitraum.von.getTime()) / 86400000;
  const tools = (st.toolkostenMonat * tage) / 30;
  const cacVoll = div(spend + provision + tools, won.length);
  const plaetze = sum(won, (o) => o.plaetze ?? 1);
  const plaetzeProDeal = div(plaetze, won.length) ?? 1;
  const deckungsbeitrag = aov != null ? aov - (cac ?? 0) - aov * st.provisionsquote - st.lieferkostenProTeilnehmer * plaetzeProDeal : null;

  return {
    spend, impressions, reach, linkClicks, lpViews, v3, thru, metaLeads,
    frequency: div(impressions, reach), cpm: div(spend * 1000, impressions), hookRate: div(v3, impressions), holdRate: div(thru, v3),
    ctr: div(linkClicks, impressions), cpc: div(spend, linkClicks), lpLoad: div(lpViews, linkClicks), lpConv: div(leadsMetaArr.length, lpViews),
    leads: leadsIm.length, leadsMeta: leadsMetaArr.length, leadsQuali, leadsOhneUtm,
    cpl: div(spend, leadsMetaArr.length), qualiQuote: div(leadsQuali, leadsIm.length), kostenQualiLead: div(spend, leadsMetaArr.filter((l) => l.qualifiziert).length),
    egGebucht, egFaellig: egF.length, egShows, egNoShows: egNoShowsArr.length,
    buchungsquote: div(egGebucht, leadsIm.length),
    kostenTermin: div(spend, eg.filter((m) => s.zaehlt(m.leadId, m.bookedAt) && istMeta(m.leadId)).length),
    kostenShow: div(spend, egF.filter((m) => m.outcome === "stattgefunden" && istMeta(m.leadId)).length),
    anwahlen: calls.length, leadsAngerufen: angerufen.size, leadsErreicht: erreicht.size, gespraechsMin,
    speedToLead: median(speeds), unter5: div(speeds.filter((x) => x < 5).length, speeds.length), speedBasis: speeds.length,
    anwahlenProLead: div(calls.length, angerufen.size), erreichbarkeit: div(erreicht.size, angerufen.size),
    showRateEG: div(egShows, egF.length), qualifizierungsquote: div(bgGebucht, egShows), noShowRecovery: div(recovered, egNoShowsArr.length), noShowBasis: egNoShowsArr.length,
    bgGebucht, bgFaellig: bgF.length, bgShows, angebote: angebote.length, abschluesse: won.length, abschluesseAusAngebot: won.filter((o) => o.angebotAm).length,
    showRateBG: div(bgShows, bgF.length), closingRate: div(won.length, bgShows), angebotsquote: div(angebote.length, bgShows),
    angebotsAbschluss: div(won.filter((o) => o.angebotAm).length, angebote.length),
    umsatz, aov, plaetzeB2B: div(sum(b2bWon, (o) => o.plaetze ?? 0), b2bWon.length),
    rabattquote: div(listeSumme - sum(mitListe, (o) => o.value), listeSumme), rabattBasis: mitListe.length, salesCycle: median(cycles),
    verlustgruende: [...vg].map(([grund, anzahl]) => ({ grund, anzahl })).sort((a, b) => b.anzahl - a.anzahl),
    cash, cashQuote: div(cash, umsatz), abschluesseMeta: wonMeta.length, umsatzMeta: umsatzMetaKoh, cashMeta: cashMetaKoh,
    cac, cacVoll, roas: div(umsatzMetaKoh, spend), cashRoas: div(cashMetaKoh, spend), mer: div(umsatz, spend), deckungsbeitrag,
    ltvCac: aov != null && cac ? aov / cac : null,
  };
}

// ---------------------------------------------------------------------------
// Funnel

export interface FunnelStufe { key: string; label: string; wert: number; conv: number | null; kosten: number | null; kpi?: string; ziel?: number }

export function funnel(k: Kennzahlen): FunnelStufe[] {
  const stufen: Omit<FunnelStufe, "conv">[] = [
    { key: "impressions", label: "Impressionen", wert: k.impressions, kosten: k.cpm != null ? k.cpm / 1000 : null },
    { key: "klicks", label: "Link-Klicks", wert: k.linkClicks, kosten: k.cpc, kpi: "ctr" },
    { key: "leads", label: "Leads", wert: k.leads, kosten: k.cpl, kpi: "lpConv" },
    { key: "eg", label: "Erstgespräche gebucht", wert: k.egGebucht, kosten: k.kostenTermin, kpi: "buchungsquote" },
    { key: "egShow", label: "Erstgespräche stattgefunden", wert: k.egShows, kosten: k.kostenShow, kpi: "showRateEG" },
    { key: "bg", label: "Beratungen gebucht", wert: k.bgGebucht, kosten: k.spend && k.bgGebucht ? k.spend / k.bgGebucht : null, kpi: "qualifizierungsquote" },
    { key: "bgShow", label: "Beratungen stattgefunden", wert: k.bgShows, kosten: k.spend && k.bgShows ? k.spend / k.bgShows : null, kpi: "showRateBG" },
    { key: "won", label: "Abschlüsse", wert: k.abschluesse, kosten: k.cac, kpi: "closingRate" },
  ];
  // Conversion-Raten der Stufen nach festen Definitionen (fällig statt gebucht bei Shows)
  const conv: Record<string, number | null> = {
    klicks: k.ctr, leads: k.linkClicks ? k.leadsMeta / k.linkClicks : null, eg: k.buchungsquote, egShow: k.showRateEG,
    bg: k.qualifizierungsquote, bgShow: k.showRateBG, won: k.closingRate,
  };
  return stufen.map((x) => ({ ...x, conv: conv[x.key] ?? null }));
}

// ---------------------------------------------------------------------------
// Tabellen: Anzeigen (Kampagne → Anzeigengruppe → Anzeige)

export interface AdZeile {
  ebene: "kampagne" | "adset" | "ad";
  id: string; name: string; parentId?: string; status?: string;
  spend: number; impressions: number; reach: number; v3: number; thru: number; linkClicks: number; lpViews: number; metaLeads: number;
  leads: number; termine: number; shows: number; abschluesse: number; umsatz: number;
  cpm: number | null; hook: number | null; hold: number | null; ctr: number | null; cpc: number | null; cpl: number | null;
  kostenTermin: number | null; kostenShow: number | null; roas: number | null; frequency: number | null;
  ad?: AdEntity;
}

export function adTabelle(ds: Dataset, f: Filter): AdZeile[] {
  const ix = index(ds);
  const now = (f.now ?? new Date()).getTime();
  const s = scope(ds, { ...f, quelle: "meta" });
  const leer = (): Omit<AdZeile, "ebene" | "id" | "name"> => ({
    spend: 0, impressions: 0, reach: 0, v3: 0, thru: 0, linkClicks: 0, lpViews: 0, metaLeads: 0, leads: 0, termine: 0, shows: 0, abschluesse: 0, umsatz: 0,
    cpm: null, hook: null, hold: null, ctr: null, cpc: null, cpl: null, kostenTermin: null, kostenShow: null, roas: null, frequency: null,
  });
  const zeilen = new Map<string, AdZeile>();
  const get = (ebene: AdZeile["ebene"], id: string, name: string, parentId?: string, status?: string, ad?: AdEntity) => {
    const key = `${ebene}:${id}`;
    let z = zeilen.get(key);
    if (!z) { z = { ebene, id, name, parentId, status, ad, ...leer() }; zeilen.set(key, z); }
    return z;
  };
  const kette = (adId: string) => {
    const a = ix.adById.get(adId);
    if (!a) return [get("ad", adId, adId)];
    return [
      get("kampagne", a.campaignId, a.campaignName),
      get("adset", a.adsetId, a.adsetName, a.campaignId),
      get("ad", a.adId, a.adName, a.adsetId, a.status, a),
    ];
  };
  for (const i of s.insights) for (const z of kette(i.adId)) {
    z.spend += i.spend; z.impressions += i.impressions; z.reach += i.reach; z.v3 += i.videoViews3s; z.thru += i.thruplays;
    z.linkClicks += i.linkClicks; z.lpViews += i.lpViews; z.metaLeads += i.metaLeads;
  }
  for (const l of s.leads) {
    if (!l.utmContent) continue;
    const kz = kette(l.utmContent);
    if (s.inRange(l.createdAt)) for (const z of kz) z.leads++;
    for (const m of ix.meetingsByLead.get(l.id) ?? []) {
      if (m.typ !== "erstgespraech") continue;
      if (s.zaehlt(l.id, m.bookedAt)) for (const z of kz) z.termine++;
      if (s.zaehlt(l.id, m.startsAt) && faellig(m, now) && m.outcome === "stattgefunden") for (const z of kz) z.shows++;
    }
    for (const o of ix.oppsByLead.get(l.id) ?? []) {
      if (o.stage === "won" && s.zaehlt(l.id, o.wonAt)) for (const z of kz) { z.abschluesse++; z.umsatz += o.value; }
    }
  }
  for (const z of zeilen.values()) {
    z.cpm = div(z.spend * 1000, z.impressions); z.hook = div(z.v3, z.impressions); z.hold = div(z.thru, z.v3);
    z.ctr = div(z.linkClicks, z.impressions); z.cpc = div(z.spend, z.linkClicks); z.cpl = div(z.spend, z.leads);
    z.kostenTermin = div(z.spend, z.termine); z.kostenShow = div(z.spend, z.shows); z.roas = div(z.umsatz, z.spend); z.frequency = div(z.impressions, z.reach);
  }
  return [...zeilen.values()].sort((a, b) => b.spend - a.spend);
}

// ---------------------------------------------------------------------------
// Creative-Ermüdung + Badges

export interface CreativeStatus { adId: string; badge: "top" | "skalieren" | "ausgebrannt" | "abschalten" | null; fatigue: boolean; grund?: string }

export function creativeStatus(ds: Dataset, zeilen: AdZeile[], now = new Date()): Map<string, CreativeStatus> {
  const res = new Map<string, CreativeStatus>();
  const ads = zeilen.filter((z) => z.ebene === "ad");
  const ziel = ds.settings.schwellen.kostenShow?.gruen ?? 200;
  const mitSpend = ads.filter((z) => z.spend >= 150);
  const top = mitSpend.filter((z) => z.abschluesse > 0).sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))[0];
  for (const z of ads) {
    const ins = ds.insights.filter((i) => i.adId === z.id).sort((a, b) => a.date.localeCompare(b.date));
    let fatigue = false, grund: string | undefined;
    if (ins.length >= 14) {
      const erste = ins.slice(0, 7), letzte = ins.filter((i) => new Date(i.date) >= addDays(now, -7));
      const agg = (a: AdInsight[]) => ({ imp: sum(a, (x) => x.impressions), reach: sum(a, (x) => x.reach), clicks: sum(a, (x) => x.linkClicks), spend: sum(a, (x) => x.spend), leads: sum(a, (x) => x.metaLeads) });
      const e = agg(erste), l = agg(letzte);
      const freq = div(l.imp, l.reach) ?? 0;
      const ctrE = div(e.clicks, e.imp) ?? 0, ctrL = div(l.clicks, l.imp) ?? 0;
      const cplE = div(e.spend, e.leads), cplL = div(l.spend, l.leads);
      const ctrFall = ctrE > 0 && ctrL < ctrE * 0.7;
      const cplAnstieg = cplE != null && cplL != null && cplL > cplE * 1.4;
      if (freq > 2.5 && (ctrFall || cplAnstieg)) {
        fatigue = true;
        grund = `Frequenz ${freq.toLocaleString("de-DE", { maximumFractionDigits: 1 })}, ${ctrFall ? `CTR −${Math.round((1 - ctrL / ctrE) * 100)} %` : `CPL +${Math.round((cplL! / cplE! - 1) * 100)} %`} ggü. Startwoche`;
      }
    }
    let badge: CreativeStatus["badge"] = null;
    if (top && z.id === top.id) badge = "top";
    else if (fatigue) badge = "ausgebrannt";
    else if (z.spend >= 300 && z.shows === 0) badge = "abschalten";
    else if (z.kostenShow != null && z.kostenShow < ziel && z.abschluesse > 0) badge = "skalieren";
    res.set(z.id, { adId: z.id, badge, fatigue, grund });
  }
  return res;
}

// ---------------------------------------------------------------------------
// Rep-Tabellen

export interface RepZeile {
  repId: string; name: string; rolle: string;
  anwahlen: number; gespraechsMin: number; erreichbarkeit: number | null; termine: number; showRate: number | null;
  qualiQuote: number | null; speedToLead: number | null;
  bg: number; bgShows: number; abschluesse: number; closingRate: number | null; umsatz: number; aov: number | null;
  offeneAngebote: number; tageImAngebot: number | null; verlustPreisAnteil: number | null; verlustgruende: { grund: string; anzahl: number }[];
}

export function repTabelle(ds: Dataset, f: Filter): RepZeile[] {
  const now = (f.now ?? new Date()).getTime();
  return ds.reps.filter((r) => r.aktiv).map((r) => {
    const k = berechne(ds, { ...f, rep: r.id });
    // Setter-Sicht: Termine, die der Setter gelegt hat
    const meins = ds.meetings.filter((m) => m.userId === r.id);
    const s = scope(ds, f);
    const egGebucht = meins.filter((m) => m.typ === "erstgespraech" && s.zaehlt(m.leadId, m.bookedAt)).length;
    const egF = meins.filter((m) => m.typ === "erstgespraech" && s.zaehlt(m.leadId, m.startsAt) && faellig(m, now));
    const egShows = egF.filter((m) => m.outcome === "stattgefunden").length;
    const bgF = meins.filter((m) => m.typ !== "erstgespraech" && s.zaehlt(m.leadId, m.startsAt) && faellig(m, now));
    const bgShows = bgF.filter((m) => m.outcome === "stattgefunden").length;
    const myOpps = ds.opps.filter((o) => o.userId === r.id);
    const won = myOpps.filter((o) => o.stage === "won" && s.zaehlt(o.leadId, o.wonAt));
    const lost = myOpps.filter((o) => o.stage === "lost" && s.zaehlt(o.leadId, o.lostAt));
    const offen = myOpps.filter((o) => o.stage === "angebot");
    const vg = new Map<string, number>();
    for (const o of lost) vg.set(o.verlustgrund || "ohne Angabe", (vg.get(o.verlustgrund || "ohne Angabe") ?? 0) + 1);
    const umsatz = sum(won, (o) => o.value);
    return {
      repId: r.id, name: r.name, rolle: r.rolle,
      anwahlen: k.anwahlen, gespraechsMin: k.gespraechsMin, erreichbarkeit: k.erreichbarkeit, termine: egGebucht,
      showRate: div(egShows, egF.length), qualiQuote: k.qualifizierungsquote, speedToLead: k.speedToLead,
      bg: bgF.length, bgShows, abschluesse: won.length, closingRate: div(won.length, bgShows), umsatz, aov: div(umsatz, won.length),
      offeneAngebote: offen.length, tageImAngebot: median(offen.map((o) => (now - t(o.stageSince)) / 86400000)),
      verlustPreisAnteil: div(vg.get("Preis") ?? 0, lost.length),
      verlustgruende: [...vg].map(([grund, anzahl]) => ({ grund, anzahl })).sort((a, b) => b.anzahl - a.anzahl),
    };
  });
}

// ---------------------------------------------------------------------------
// Trends

export function wochenTrend(ds: Dataset, f: Omit<Filter, "zeitraum">, wochen = 12) {
  const now = f.now ?? new Date();
  const res: { woche: string; label: string; umsatz: number; spend: number; leads: number; abschluesse: number; cash: number }[] = [];
  const start = wochenStart(now);
  for (let i = wochen - 1; i >= 0; i--) {
    const von = addDays(start, -7 * i), bis = addDays(von, 7);
    const k = berechne(ds, { ...f, sicht: "ereignis", zeitraum: { key: "frei", von, bis, label: "" } });
    res.push({ woche: isoWoche(von), label: `KW ${isoWoche(von).slice(-2)}`, umsatz: k.umsatz, spend: k.spend, leads: k.leads, abschluesse: k.abschluesse, cash: k.cash });
  }
  return res;
}

export function tagesTrend(ds: Dataset, f: Filter) {
  const res: { tag: string; label: string; spend: number; leads: number; metaLeads: number; termine: number; cpl: number | null }[] = [];
  for (let d = new Date(f.zeitraum.von); d < f.zeitraum.bis; d = addDays(d, 1)) {
    const k = berechne(ds, { ...f, sicht: "ereignis", zeitraum: { key: "frei", von: d, bis: addDays(d, 1), label: "" } });
    res.push({ tag: tagKey(d), label: d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }), spend: k.spend, leads: k.leadsMeta, metaLeads: k.metaLeads, termine: k.egGebucht, cpl: k.cpl });
  }
  return res;
}

export function sparkline(ds: Dataset, f: Filter, feld: keyof Kennzahlen, punkte = 8): number[] {
  const dauer = f.zeitraum.bis.getTime() - f.zeitraum.von.getTime();
  const schritt = Math.max(86400000, dauer / punkte);
  const res: number[] = [];
  for (let i = punkte - 1; i >= 0; i--) {
    const bis = new Date(f.zeitraum.bis.getTime() - i * schritt), von = new Date(bis.getTime() - schritt);
    const v = berechne(ds, { ...f, zeitraum: { key: "frei", von, bis, label: "" } })[feld];
    res.push(typeof v === "number" ? v : 0);
  }
  return res;
}

// ---------------------------------------------------------------------------
// Pacing + Forecast + Pipeline

export function pipeline(ds: Dataset, f: Pick<Filter, "rep" | "quelle" | "kampagne" | "kundentyp" | "now">) {
  const now = (f.now ?? new Date()).getTime();
  const ix = index(ds);
  const offen = ds.opps.filter((o) => o.stage !== "won" && o.stage !== "lost").filter((o) => {
    const l = ix.leadById.get(o.leadId);
    return (!f.rep || o.userId === f.rep || l?.setterId === f.rep) && (!f.quelle || l?.quelle === f.quelle) && (!f.kampagne || l?.utmCampaign === f.kampagne) && (!f.kundentyp || l?.kundentyp === f.kundentyp);
  });
  const w = ds.settings.stageWahrscheinlichkeit;
  const wert = (o: Opportunity) => o.value || o.listenpreis || durchschnittWert(ds);
  const stages: OppStage[] = ["setting", "closing_terminiert", "closing_fu", "angebot", "cc2"];
  const proStage = stages.map((s) => {
    const os = offen.filter((o) => o.stage === s);
    return { stage: s, anzahl: os.length, wert: sum(os, wert), gewichtet: sum(os, (o) => wert(o) * (w[s] ?? 0)), opps: os };
  });
  return {
    offen, proStage,
    summe: sum(offen, wert),
    gewichtet: sum(offen, (o) => wert(o) * (w[o.stage] ?? 0)),
    ohneAufgabe: offen.filter((o) => !o.hatNaechsteAufgabe),
    stagnierend: offen.filter((o) => now - t(o.stageSince) > 14 * 86400000),
    wert,
  };
}

function durchschnittWert(ds: Dataset) {
  const w = ds.opps.filter((o) => o.stage === "won" && o.value > 0);
  return w.length ? sum(w, (o) => o.value) / w.length : 4000;
}

export function pacing(ds: Dataset, f: Omit<Filter, "zeitraum" | "sicht">) {
  const now = f.now ?? new Date();
  const monatVon = new Date(now.getFullYear(), now.getMonth(), 1);
  const monatBis = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const heuteEnde = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1);
  const st = ds.settings;
  const ziel = st.monatsziel[now.toISOString().slice(0, 7)] ?? null;
  const k = berechne(ds, { ...f, sicht: "ereignis", zeitraum: { key: "monat", von: monatVon, bis: heuteEnde, label: "Monat" } });
  const atGesamt = arbeitstage(monatVon, monatBis, st);
  const atVergangen = arbeitstage(monatVon, heuteEnde, st);
  const sollHeute = ziel != null ? ziel * (atVergangen / Math.max(1, atGesamt)) : null;
  const p = pipeline(ds, f);
  const w = st.stageWahrscheinlichkeit;
  const imMonat = p.offen.filter((o) => o.closeDate && t(o.closeDate) >= monatVon.getTime() && t(o.closeDate) < monatBis.getTime());
  const forecast = k.umsatz + sum(imMonat, (o) => p.wert(o) * (w[o.stage] ?? 0));
  // Hochrechnung bei aktuellem Tempo
  const tempo = atVergangen > 0 ? (k.umsatz / atVergangen) * atGesamt : 0;
  const aov = k.aov ?? durchschnittWert(ds);
  // Rückwärtsrechnung des Fehlbetrags mit 90-Tage-Quoten
  const q = berechne(ds, { ...f, sicht: "ereignis", zeitraum: { key: "90t", von: addDays(now, -90), bis: now, label: "" } });
  const fehlt = ziel != null ? Math.max(0, ziel - tempo) : 0;
  const fehlendeAbschluesse = Math.ceil(fehlt / Math.max(1, q.aov ?? aov));
  const fehlendeBG = q.closingRate ? Math.ceil(fehlendeAbschluesse / q.closingRate) : null;
  const fehlendeEG = fehlendeBG != null && q.qualifizierungsquote ? Math.ceil(fehlendeBG / q.qualifizierungsquote / (q.showRateBG ?? 1)) : null;
  return {
    ziel, umsatz: k.umsatz, sollHeute, forecast, tempo,
    pacing: sollHeute ? k.umsatz / sollHeute : null,
    prognoseQuote: ziel ? tempo / ziel : null,
    fehlendeAbschluesse, fehlendeBG, fehlendeEG,
    atGesamt, atVergangen,
  };
}

// ---------------------------------------------------------------------------
// Datenhygiene (4.7)

export interface HygieneFehler { typ: string; label: string; gewicht: number; anzahl: number; basis: number; items: { id: string; leadId: string; text: string; userId?: string | null }[] }

export function hygiene(ds: Dataset, now = new Date(), rep?: string | null): { score: number; fehler: HygieneFehler[] } {
  const ix = index(ds);
  const n = now.getTime();
  const lead = (id: string) => ix.leadById.get(id);
  const okRep = (u?: string | null) => !rep || u === rep;
  const vergangene = ds.meetings.filter((m) => t(m.startsAt) < n - 2 * 3600000 && okRep(m.userId));
  const ohneOutcome = vergangene.filter((m) => !m.outcome);
  const offen = ds.opps.filter((o) => o.stage !== "won" && o.stage !== "lost" && okRep(o.userId));
  const ohneAufgabe = offen.filter((o) => !o.hatNaechsteAufgabe);
  const tasks = ds.tasks.filter((x) => okRep(x.userId));
  const ueberfaellig = tasks.filter((x) => !x.done && t(x.due) < n);
  const metaLeads = ds.leads.filter((l) => (l.quelle === "meta" || l.utmSource) && okRep(l.setterId));
  const ohneUtm = metaLeads.filter((l) => !l.utmContent);
  const alleLeads = ds.leads.filter((l) => okRep(l.setterId));
  const ohneQuelle = alleLeads.filter((l) => !l.quelle || l.quelle === "sonstige");
  const won = ds.opps.filter((o) => o.stage === "won" && okRep(o.userId));
  const wonOhne = won.filter((o) => !o.value || !o.paket);
  const name = (id: string) => lead(id)?.name ?? id;
  const fehler: HygieneFehler[] = [
    { typ: "meeting_outcome", label: "Meetings ohne Outcome", gewicht: 3, anzahl: ohneOutcome.length, basis: vergangene.length,
      items: ohneOutcome.map((m) => ({ id: m.id, leadId: m.leadId, userId: m.userId, text: `${name(m.leadId)} · ${new Date(m.startsAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}` })) },
    { typ: "opp_ohne_aufgabe", label: "Offene Opps ohne nächste Aufgabe", gewicht: 2, anzahl: ohneAufgabe.length, basis: offen.length,
      items: ohneAufgabe.map((o) => ({ id: o.id, leadId: o.leadId, userId: o.userId, text: `${name(o.leadId)} · ${o.statusLabel}` })) },
    { typ: "aufgabe_ueberfaellig", label: "Überfällige Aufgaben", gewicht: 1, anzahl: ueberfaellig.length, basis: tasks.length,
      items: ueberfaellig.map((x) => ({ id: x.id, leadId: x.leadId, userId: x.userId, text: `${name(x.leadId)} · fällig ${new Date(x.due).toLocaleDateString("de-DE")}` })) },
    { typ: "lead_ohne_utm", label: "Meta-Leads ohne Anzeigen-ID (UTM)", gewicht: 2, anzahl: ohneUtm.length, basis: metaLeads.length,
      items: ohneUtm.map((l) => ({ id: l.id, leadId: l.id, userId: l.setterId, text: l.name })) },
    { typ: "lead_ohne_quelle", label: "Leads ohne Quelle", gewicht: 1, anzahl: ohneQuelle.length, basis: alleLeads.length,
      items: ohneQuelle.map((l) => ({ id: l.id, leadId: l.id, userId: l.setterId, text: l.name })) },
    { typ: "won_ohne_wert", label: "Gewonnene Opps ohne Wert oder Paket", gewicht: 3, anzahl: wonOhne.length, basis: won.length,
      items: wonOhne.map((o) => ({ id: o.id, leadId: o.leadId, userId: o.userId, text: `${name(o.leadId)} · ${o.value ? "" : "Wert fehlt "}${o.paket ? "" : "Paket fehlt"}` })) },
  ];
  const gw = sum(fehler, (x) => x.gewicht);
  const strafe = sum(fehler, (x) => x.gewicht * (x.basis ? Math.min(1, (x.anzahl / x.basis) * 5) : 0));
  return { score: Math.max(0, Math.round(100 - (strafe / gw) * 100)), fehler };
}

// ---------------------------------------------------------------------------
// Warnungen

export interface Warnung { stufe: "rot" | "gelb"; text: string; link: string }

export function warnungen(ds: Dataset, now = new Date()): Warnung[] {
  const w: Warnung[] = [];
  const st = ds.settings;
  const ix = index(ds);
  // CPL an den letzten 3 Tagen über Ziel
  const cplZiel = st.schwellen.cpl?.gruen ?? 80;
  let tageUeber = 0;
  for (let i = 1; i <= 3; i++) {
    const von = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -i);
    const k = berechne(ds, { sicht: "ereignis", zeitraum: { key: "frei", von, bis: addDays(von, 1), label: "" }, now });
    if (k.cpl != null && k.cpl > cplZiel) tageUeber++;
  }
  if (tageUeber === 3) w.push({ stufe: "rot", text: `CPL seit 3 Tagen über Ziel (${cplZiel} €)`, link: "/meta" });
  // Unbearbeitete Leads > 30 Min.
  const unbearbeitet = ds.leads.filter((l) => !ix.firstCallByLead.has(l.id) && now.getTime() - t(l.createdAt) > 30 * 60000 && now.getTime() - t(l.createdAt) < 3 * 86400000);
  if (unbearbeitet.length) w.push({ stufe: "rot", text: `${unbearbeitet.length} ${unbearbeitet.length === 1 ? "Lead" : "Leads"} seit über 30 Min. nicht angerufen`, link: "/setting" });
  const frisch = ds.leads.filter((l) => !ix.firstCallByLead.has(l.id) && now.getTime() - t(l.createdAt) <= 30 * 60000 && now.getTime() - t(l.createdAt) > 10 * 60000);
  if (frisch.length) w.push({ stufe: "gelb", text: `${frisch.length} neue ${frisch.length === 1 ? "Lead wartet" : "Leads warten"} seit über 10 Min.`, link: "/setting" });
  // Creative-Frequenz
  const z = adTabelle(ds, { sicht: "ereignis", zeitraum: { key: "7t", von: addDays(now, -7), bis: now, label: "" }, now });
  for (const a of z.filter((x) => x.ebene === "ad" && x.status === "ACTIVE" && (x.frequency ?? 0) > 2.5)) {
    w.push({ stufe: "gelb", text: `Creative „${a.name}“ Frequenz ${a.frequency!.toLocaleString("de-DE", { maximumFractionDigits: 1 })} (7 Tage)`, link: "/meta#creatives" });
  }
  // Show-Rate 7 Tage
  const k7 = berechne(ds, { sicht: "ereignis", zeitraum: { key: "7t", von: addDays(now, -7), bis: now, label: "" }, now });
  const srZiel = st.schwellen.showRateEG?.gruen ?? 0.7;
  if (k7.showRateEG != null && k7.egFaellig >= 10 && k7.showRateEG < srZiel) w.push({ stufe: "gelb", text: `Show-Rate Erstgespräch 7 Tage ${Math.round(k7.showRateEG * 100)} % (Ziel ${Math.round(srZiel * 100)} %)`, link: "/setting" });
  // Hygiene
  const h = hygiene(ds, now);
  const mo = h.fehler.find((x) => x.typ === "meeting_outcome");
  if (mo && mo.anzahl) w.push({ stufe: "gelb", text: `${mo.anzahl} Meetings ohne Outcome`, link: "/datenqualitaet" });
  // Meta vs CRM
  if (k7.metaLeads >= 10) {
    const abw = Math.abs(k7.metaLeads - k7.leadsMeta) / k7.metaLeads;
    if (abw > 0.2) w.push({ stufe: "rot", text: `Leads laut Meta (${k7.metaLeads}) und Close (${k7.leadsMeta}) weichen ${Math.round(abw * 100)} % ab – Tracking prüfen`, link: "/meta#abgleich" });
  }
  return w.sort((a, b) => (a.stufe === b.stufe ? 0 : a.stufe === "rot" ? -1 : 1));
}

/** Schwächste Funnel-Stufe gegen Ziel (für den Klartext-Satz). */
export function engpass(k: Kennzahlen, ds: Dataset): { kpi: string; label: string; wert: number; ziel: number } | null {
  const kandidaten: [string, string, number | null, number, number][] = [
    ["ctr", "Link-CTR", k.ctr, ds.settings.schwellen.ctr?.gruen ?? 0.01, k.impressions >= 1000 ? 1 : 0],
    ["lpConv", "LP-Conversion", k.lpConv, ds.settings.schwellen.lpConv?.gruen ?? 0.15, k.lpViews >= 30 ? 1 : 0],
    ["buchungsquote", "Buchungsquote", k.buchungsquote, ds.settings.schwellen.buchungsquote?.gruen ?? 0.3, k.leads >= 10 ? 1 : 0],
    ["showRateEG", "Show-Rate Erstgespräch", k.showRateEG, ds.settings.schwellen.showRateEG?.gruen ?? 0.7, k.egFaellig >= 10 ? 1 : 0],
    ["qualifizierungsquote", "Qualifizierungsquote", k.qualifizierungsquote, ds.settings.schwellen.qualifizierungsquote?.gruen ?? 0.5, k.egShows >= 10 ? 1 : 0],
    ["showRateBG", "Show-Rate Beratung", k.showRateBG, ds.settings.schwellen.showRateBG?.gruen ?? 0.8, k.bgFaellig >= 10 ? 1 : 0],
    ["closingRate", "Closing-Rate", k.closingRate, ds.settings.schwellen.closingRate?.gruen ?? 0.25, k.bgShows >= 10 ? 1 : 0],
  ];
  let best: { kpi: string; label: string; wert: number; ziel: number; luecke: number } | null = null;
  for (const [kpi, label, wert, ziel, ok] of kandidaten) {
    if (!ok || wert == null) continue;
    const luecke = wert / ziel;
    if (luecke < 1 && (!best || luecke < best.luecke)) best = { kpi, label, wert, ziel, luecke };
  }
  return best;
}
