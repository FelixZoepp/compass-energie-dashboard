// Zusätzliche Berechnungen für Sales-Funnel, Setting und Closing.
// Gleiche Regeln wie die Engine: Raten aus Summen, Ereignis- bzw. Kohortensicht über den Filter.

import type { Dataset, Lead, Meeting, Opportunity, Quelle, Kundentyp } from "../types";
import { berechne, funnel, index, median, type Filter, type FunnelStufe, type Kennzahlen } from "./engine";
import { addDays, isoWoche, wochenStart } from "./zeit";

const t = (s: string | null | undefined) => (s ? new Date(s).getTime() : NaN);
const TAG = 86400000;
const div = (a: number, b: number) => (b > 0 ? a / b : null);

/** Leads im Filter-Scope (ohne Zeitraum). */
export function leadsImScope(ds: Dataset, f: Pick<Filter, "quelle" | "kampagne" | "kundentyp" | "rep">): Lead[] {
  return ds.leads.filter((l) =>
    (!f.quelle || l.quelle === f.quelle) &&
    (!f.kampagne || l.utmCampaign === f.kampagne) &&
    (!f.kundentyp || l.kundentyp === f.kundentyp) &&
    (!f.rep || l.setterId === f.rep || l.closerId === f.rep));
}

const imZeitraum = (f: Filter, iso: string | null | undefined) => {
  const v = t(iso);
  return v >= f.zeitraum.von.getTime() && v < f.zeitraum.bis.getTime();
};

// ---------------------------------------------------------------------------
// Funnel-Vergleich nach Gruppen

export interface VergleichsGruppe { key: string; label: string; k: Kennzahlen; stufen: FunnelStufe[] }

export const QUELL_GRUPPEN: { key: Quelle; label: string }[] = [
  { key: "meta", label: "Meta" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "empfehlung", label: "Empfehlung" },
  { key: "kaltakquise", label: "Kaltakquise" },
];
export const TYP_GRUPPEN: { key: Kundentyp; label: string }[] = [
  { key: "B2B", label: "B2B" },
  { key: "B2C", label: "B2C" },
];

export function funnelVergleich(ds: Dataset, f: Filter, dim: "quelle" | "typ"): VergleichsGruppe[] {
  const gruppen = dim === "quelle" ? QUELL_GRUPPEN : TYP_GRUPPEN;
  return gruppen.map((g) => {
    const k = berechne(ds, dim === "quelle" ? { ...f, quelle: g.key as Quelle } : { ...f, kundentyp: g.key as Kundentyp });
    return { key: g.key, label: g.label, k, stufen: funnel(k) };
  });
}

// ---------------------------------------------------------------------------
// Durchlaufzeiten (Median Tage), gezählt beim Endereignis im Zeitraum (Kohorte: Lead im Zeitraum eingetragen)

export interface Durchlauf { label: string; median: number | null; anzahl: number }

export function durchlaufzeiten(ds: Dataset, f: Filter): Durchlauf[] {
  const ix = index(ds);
  const leads = leadsImScope(ds, f);
  const a: number[] = [], b: number[] = [], c: number[] = [], gesamt: number[] = [];
  const zaehlt = (l: Lead, ende: string | null | undefined) => (f.sicht === "kohorte" ? imZeitraum(f, l.createdAt) && !!ende : imZeitraum(f, ende));
  for (const l of leads) {
    const ms = ix.meetingsByLead.get(l.id) ?? [];
    const egShow = ms.filter((m) => m.typ === "erstgespraech" && m.outcome === "stattgefunden").sort((x, y) => t(x.startsAt) - t(y.startsAt))[0];
    const bgShow = ms.filter((m) => m.typ !== "erstgespraech" && m.outcome === "stattgefunden").sort((x, y) => t(x.startsAt) - t(y.startsAt))[0];
    const won = (ix.oppsByLead.get(l.id) ?? []).find((o) => o.stage === "won" && o.wonAt);
    if (egShow && zaehlt(l, egShow.startsAt)) a.push((t(egShow.startsAt) - t(l.createdAt)) / TAG);
    if (egShow && bgShow && zaehlt(l, bgShow.startsAt)) b.push((t(bgShow.startsAt) - t(egShow.startsAt)) / TAG);
    if (bgShow && won && zaehlt(l, won.wonAt)) c.push((t(won.wonAt) - t(bgShow.startsAt)) / TAG);
    if (won && zaehlt(l, won.wonAt)) gesamt.push((t(won.wonAt) - t(l.createdAt)) / TAG);
  }
  const pos = (x: number[]) => x.filter((v) => v >= 0);
  return [
    { label: "Eintragung → Erstgespräch", median: median(pos(a)), anzahl: pos(a).length },
    { label: "Erstgespräch → Beratung", median: median(pos(b)), anzahl: pos(b).length },
    { label: "Beratung → Abschluss", median: median(pos(c)), anzahl: pos(c).length },
    { label: "Gesamt: Eintragung → Abschluss", median: median(pos(gesamt)), anzahl: pos(gesamt).length },
  ];
}

// ---------------------------------------------------------------------------
// Verlustgründe je Stufe (Stufe vor dem Verlust aus Termin-/Angebotsstand abgeleitet)

export const VERLUST_STUFEN = ["Nach Erstgespräch", "Beratung nicht erschienen", "Nach Beratung", "Nach Angebot"] as const;

export function verlustStufe(o: Opportunity, ms: Meeting[]): (typeof VERLUST_STUFEN)[number] {
  if (o.angebotAm) return "Nach Angebot";
  const bg = ms.filter((m) => m.typ !== "erstgespraech");
  if (bg.some((m) => m.outcome === "stattgefunden")) return "Nach Beratung";
  if (bg.length) return "Beratung nicht erschienen";
  return "Nach Erstgespräch";
}

export function verlusteNachStufe(ds: Dataset, f: Filter) {
  const ix = index(ds);
  const leadIds = new Set(leadsImScope(ds, f).map((l) => l.id));
  const lost = ds.opps.filter((o) => o.stage === "lost" && leadIds.has(o.leadId) &&
    (f.sicht === "kohorte" ? imZeitraum(f, ix.leadById.get(o.leadId)?.createdAt) : imZeitraum(f, o.lostAt)));
  const proStufe = new Map<string, Map<string, number>>();
  for (const o of lost) {
    const s = verlustStufe(o, ix.meetingsByLead.get(o.leadId) ?? []);
    const m = proStufe.get(s) ?? proStufe.set(s, new Map()).get(s)!;
    const g = o.verlustgrund || "ohne Angabe";
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  const gesamt = new Map<string, number>();
  for (const o of lost) gesamt.set(o.verlustgrund || "ohne Angabe", (gesamt.get(o.verlustgrund || "ohne Angabe") ?? 0) + 1);
  return {
    anzahl: lost.length,
    gesamt: [...gesamt].map(([name, wert]) => ({ name, wert })).sort((a, b) => b.wert - a.wert),
    stufen: VERLUST_STUFEN.map((s) => {
      const m = proStufe.get(s) ?? new Map<string, number>();
      return { stufe: s, anzahl: [...m.values()].reduce((x, y) => x + y, 0), gruende: [...m].map(([name, wert]) => ({ name, wert })).sort((a, b) => b.wert - a.wert) };
    }),
  };
}

// ---------------------------------------------------------------------------
// Wochen-Kohorten: Leads aus KW x → Anteil mit Termin / Show / Abschluss nach 7/14/30/60 Tagen

export const HORIZONTE = [7, 14, 30, 60] as const;

export interface KohortenZeile {
  woche: string; label: string; leads: number;
  termin: (number | null)[]; show: (number | null)[]; abschluss: (number | null)[];
}

export function wochenKohorten(ds: Dataset, f: Filter, wochen = 10, now = new Date()): KohortenZeile[] {
  const ix = index(ds);
  const leads = leadsImScope(ds, f);
  const start = wochenStart(now);
  const res: KohortenZeile[] = [];
  for (let i = wochen - 1; i >= 0; i--) {
    const von = addDays(start, -7 * i), bis = addDays(von, 7);
    const ws = leads.filter((l) => t(l.createdAt) >= von.getTime() && t(l.createdAt) < bis.getTime());
    const quote = (h: number, pruef: (l: Lead, grenze: number) => boolean) => {
      // Reif erst, wenn auch der zuletzt eingetragene Lead der Woche h Tage alt ist
      if (bis.getTime() + h * TAG > now.getTime() + TAG || !ws.length) return null;
      return ws.filter((l) => pruef(l, t(l.createdAt) + h * TAG)).length / ws.length;
    };
    const ms = (l: Lead) => (ix.meetingsByLead.get(l.id) ?? []).filter((m) => m.typ === "erstgespraech");
    res.push({
      woche: isoWoche(von),
      label: `KW ${isoWoche(von).slice(-2)} · ${von.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`,
      leads: ws.length,
      termin: HORIZONTE.map((h) => quote(h, (l, g) => ms(l).some((m) => t(m.bookedAt) <= g))),
      show: HORIZONTE.map((h) => quote(h, (l, g) => ms(l).some((m) => m.outcome === "stattgefunden" && t(m.startsAt) <= g))),
      abschluss: HORIZONTE.map((h) => quote(h, (l, g) => (ix.oppsByLead.get(l.id) ?? []).some((o) => o.stage === "won" && t(o.wonAt) <= g))),
    });
  }
  return res;
}

// ---------------------------------------------------------------------------
// Setting: Heatmap Erreichbarkeit, Versuche bis Erstkontakt, unbearbeitete Leads

export const HEAT_STUNDEN = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
export const HEAT_TAGE = ["Mo", "Di", "Mi", "Do", "Fr"];

export function erreichbarkeitHeatmap(ds: Dataset, f: Filter) {
  const leadIds = new Set(leadsImScope(ds, f).map((l) => l.id));
  const ix = index(ds);
  const zellen = HEAT_TAGE.map(() => HEAT_STUNDEN.map(() => ({ calls: 0, erreicht: 0 })));
  for (const c of ds.calls) {
    if (c.direction !== "outbound" || !leadIds.has(c.leadId) || (f.rep && c.userId !== f.rep)) continue;
    const ok = f.sicht === "kohorte" ? imZeitraum(f, ix.leadById.get(c.leadId)?.createdAt) : imZeitraum(f, c.at);
    if (!ok) continue;
    const d = new Date(c.at);
    const wd = (d.getDay() + 6) % 7;
    const h = HEAT_STUNDEN.indexOf(d.getHours());
    if (wd > 4 || h < 0) continue;
    zellen[wd][h].calls++;
    if (c.answered) zellen[wd][h].erreicht++;
  }
  return zellen.map((zeile) => zeile.map((z) => ({ ...z, quote: div(z.erreicht, z.calls) })));
}

export function versucheBisErstkontakt(ds: Dataset, f: Filter) {
  const leads = leadsImScope(ds, f).filter((l) => imZeitraum(f, l.createdAt));
  const proLead = new Map<string, { at: number; answered: boolean }[]>();
  const ids = new Set(leads.map((l) => l.id));
  for (const c of ds.calls) {
    if (c.direction !== "outbound" || !ids.has(c.leadId)) continue;
    (proLead.get(c.leadId) ?? proLead.set(c.leadId, []).get(c.leadId)!).push({ at: t(c.at), answered: c.answered });
  }
  const buckets = Array.from({ length: 10 }, () => 0);
  let nie = 0, angerufen = 0;
  for (const calls of proLead.values()) {
    angerufen++;
    calls.sort((a, b) => a.at - b.at);
    const i = calls.findIndex((c) => c.answered);
    if (i < 0) nie++;
    else buckets[Math.min(9, i)]++;
  }
  const erreicht = buckets.reduce((a, b) => a + b, 0);
  let kum = 0;
  const daten = buckets.map((n, i) => {
    kum += n;
    return { versuch: i === 9 ? "10+" : String(i + 1), erreicht: n, kumuliert: div(kum, erreicht) };
  });
  // Ab welchem Versuch kommen < 5 % der Erstkontakte dazu?
  const grenze = daten.findIndex((d, i) => i >= 2 && erreicht > 0 && d.erreicht / erreicht < 0.05);
  return { daten, nie, angerufen, erreicht, grenze: grenze >= 0 ? grenze + 1 : null };
}

export function unbearbeiteteLeads(ds: Dataset, f: Pick<Filter, "quelle" | "kampagne" | "kundentyp" | "rep">, now = new Date()) {
  const ix = index(ds);
  return leadsImScope(ds, f)
    .filter((l) => !ix.firstCallByLead.has(l.id) && now.getTime() - t(l.createdAt) < 3 * TAG && t(l.createdAt) <= now.getTime())
    .map((l) => ({ lead: l, wartezeitMin: (now.getTime() - t(l.createdAt)) / 60000 }))
    .sort((a, b) => b.wartezeitMin - a.wartezeitMin);
}

// ---------------------------------------------------------------------------
// Closing: Angebote ohne Bewegung, Paket-Mix

export function stagnierendeAngebote(ds: Dataset, f: Pick<Filter, "quelle" | "kampagne" | "kundentyp" | "rep">, tage = 7, now = new Date()) {
  const ix = index(ds);
  const leadIds = new Set(leadsImScope(ds, { ...f, rep: null }).map((l) => l.id));
  return ds.opps
    .filter((o) => o.stage === "angebot" && leadIds.has(o.leadId) && (!f.rep || o.userId === f.rep))
    .map((o) => ({ opp: o, lead: ix.leadById.get(o.leadId), tage: (now.getTime() - t(o.stageSince)) / TAG }))
    .filter((x) => x.tage > tage)
    .sort((a, b) => b.tage - a.tage);
}

export function paketMix(ds: Dataset, f: Filter) {
  const ix = index(ds);
  const leadIds = new Set(leadsImScope(ds, { ...f, rep: null }).map((l) => l.id));
  const won = ds.opps.filter((o) => o.stage === "won" && leadIds.has(o.leadId) && (!f.rep || o.userId === f.rep) &&
    (f.sicht === "kohorte" ? imZeitraum(f, ix.leadById.get(o.leadId)?.createdAt) : imZeitraum(f, o.wonAt)));
  const pakete = ["Einzelplatz", "Team", "Inhouse", "ohne Paket"];
  const gesamtUmsatz = won.reduce((s, o) => s + o.value, 0);
  return pakete.map((p) => {
    const os = won.filter((o) => (o.paket ?? "ohne Paket") === p);
    const umsatz = os.reduce((s, o) => s + o.value, 0);
    return { paket: p, anzahl: os.length, umsatz, anteil: div(umsatz, gesamtUmsatz) };
  }).filter((x) => x.paket !== "ohne Paket" || x.anzahl > 0);
}

// ---------------------------------------------------------------------------
// Coaching-Zuordnung (Schwäche → TRIAS-Modul)

export const COACHING_MODULE = {
  erreichbarkeit: "Modul 9/10",
  qualifizierungsquote: "Modul 12",
  preis: "Modul 15/16",
  closingRate: "Modul 18–20",
} as const;

/** Basis (Nenner) einer Funnel-Conversion – für die Mindestmengen-Regel. */
export function funnelBasis(kpi: string | undefined | null, k: Kennzahlen): number | undefined {
  switch (kpi) {
    case "ctr": return k.impressions;
    case "lpConv": return k.lpViews;
    case "buchungsquote": return k.leads;
    case "showRateEG": return k.egFaellig;
    case "qualifizierungsquote": return k.egShows;
    case "showRateBG": return k.bgFaellig;
    case "closingRate": return k.bgShows;
    default: return undefined;
  }
}
