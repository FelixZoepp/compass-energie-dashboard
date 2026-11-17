// Team-Auswertungen: Leaderboard, Rep-Scorecard, Coaching-Hinweise, Mein Tag.
import type { Dataset, Rep } from "../types";
import { repTabelle, type Filter, type RepZeile } from "./engine";
import { addDays, arbeitstage, startOfDay, wochenStart, zeitraum, type Zeitraum, type ZeitraumKey } from "./zeit";

const t = (s: string | null | undefined) => (s ? new Date(s).getTime() : NaN);

export type LeaderPeriode = "heute" | "woche" | "monat";
export const PERIODEN: { key: LeaderPeriode; label: string }[] = [
  { key: "heute", label: "Heute" },
  { key: "woche", label: "Diese Woche" },
  { key: "monat", label: "Dieser Monat" },
];

export function basisFilter(z: Zeitraum, now = new Date()): Filter {
  return { zeitraum: z, sicht: "ereignis", now };
}

export interface LeaderEintrag { repId: string; name: string; rolle: Rep["rolle"]; wert: number; zusatz?: string }

/** Leaderboard je Kennzahl für eine Periode. */
export function leaderboard(ds: Dataset, periode: LeaderPeriode, now = new Date()) {
  const z = zeitraum(periode as ZeitraumKey, now);
  const zeilen = repTabelle(ds, basisFilter(z, now));
  const reps = new Map(ds.reps.map((r) => [r.id, r]));
  const setter = zeilen.filter((r) => reps.get(r.repId)?.rolle !== "closer");
  const closer = zeilen.filter((r) => reps.get(r.repId)?.rolle !== "setter");
  const sortiert = (a: RepZeile[], f: (r: RepZeile) => number, zusatz?: (r: RepZeile) => string): LeaderEintrag[] =>
    a.map((r) => ({ repId: r.repId, name: r.name, rolle: reps.get(r.repId)?.rolle ?? "beides", wert: f(r), zusatz: zusatz?.(r) }))
      .sort((x, y) => y.wert - x.wert);
  return {
    zeitraum: z,
    termine: sortiert(setter, (r) => r.termine, (r) => `${r.anwahlen} Anwahlen`),
    abschluesse: sortiert(closer, (r) => r.abschluesse, (r) => (r.closingRate != null ? `Closing-Rate ${Math.round(r.closingRate * 100)} %` : "")),
    umsatz: sortiert(closer, (r) => r.umsatz, (r) => `${r.abschluesse} ${r.abschluesse === 1 ? "Abschluss" : "Abschlüsse"}`),
  };
}

/** Monatsziele auf einen Zeitraum herunterbrechen (über Arbeitstage). */
export function zielAnteil(ds: Dataset, z: Zeitraum) {
  const monatVon = new Date(z.von.getFullYear(), z.von.getMonth(), 1);
  const monatBis = new Date(z.von.getFullYear(), z.von.getMonth() + 1, 1);
  const gesamt = arbeitstage(monatVon, monatBis, ds.settings);
  return Math.max(0, arbeitstage(z.von, z.bis, ds.settings)) / Math.max(1, gesamt);
}

export interface RadarAchse { achse: string; ich: number; team: number; ziel: number; ichWert: string; teamWert: string; zielWert: string }

export interface Scorecard {
  rep: Rep;
  zeile: RepZeile;
  team: RepZeile; // Durchschnitt
  radar: RadarAchse[];
  coaching: Coaching[];
}

export interface Coaching { stufe: "rot" | "gelb" | "gruen"; text: string; modul: string | null }

const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)} %`);
const zahl = (v: number | null) => (v == null ? "–" : v.toLocaleString("de-DE", { maximumFractionDigits: 0 }));
const eur = (v: number | null) => (v == null ? "–" : v.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }));

function mittel(zeilen: RepZeile[]): RepZeile {
  const n = zeilen.length || 1;
  const avg = (f: (r: RepZeile) => number | null) => {
    const w = zeilen.map(f).filter((x): x is number => x != null);
    return w.length ? w.reduce((s, x) => s + x, 0) / w.length : null;
  };
  const summe = (f: (r: RepZeile) => number) => zeilen.reduce((s, r) => s + f(r), 0) / n;
  return {
    repId: "team", name: "Teamschnitt", rolle: "beides",
    anwahlen: summe((r) => r.anwahlen), gespraechsMin: summe((r) => r.gespraechsMin), erreichbarkeit: avg((r) => r.erreichbarkeit),
    termine: summe((r) => r.termine), showRate: avg((r) => r.showRate), qualiQuote: avg((r) => r.qualiQuote), speedToLead: avg((r) => r.speedToLead),
    bg: summe((r) => r.bg), bgShows: summe((r) => r.bgShows), abschluesse: summe((r) => r.abschluesse), closingRate: avg((r) => r.closingRate),
    umsatz: summe((r) => r.umsatz), aov: avg((r) => r.aov), offeneAngebote: summe((r) => r.offeneAngebote), tageImAngebot: avg((r) => r.tageImAngebot),
    verlustPreisAnteil: avg((r) => r.verlustPreisAnteil), verlustgruende: [],
  };
}

export function scorecard(ds: Dataset, repId: string, f: Filter): Scorecard | null {
  const rep = ds.reps.find((r) => r.id === repId);
  if (!rep) return null;
  const alle = repTabelle(ds, f);
  const zeile = alle.find((r) => r.repId === repId);
  if (!zeile) return null;
  const gleiche = alle.filter((r) => {
    const rr = ds.reps.find((x) => x.id === r.repId);
    return rr && (rep.rolle === "beides" || rr.rolle === rep.rolle || rr.rolle === "beides");
  });
  const team = mittel(gleiche);
  const ziele = ds.settings.repZiele[repId] ?? {};
  const anteil = zielAnteil(ds, f.zeitraum);
  const sch = ds.settings.schwellen;

  const achsen: { achse: string; ich: number | null; team: number | null; ziel: number | null; fmt: (v: number | null) => string; setter?: boolean; closer?: boolean }[] = [
    { achse: "Anwahlen", ich: zeile.anwahlen, team: team.anwahlen, ziel: ziele.anwahlen ? ziele.anwahlen * anteil : null, fmt: zahl, setter: true },
    { achse: "Termine", ich: zeile.termine, team: team.termine, ziel: ziele.termine ? ziele.termine * anteil : null, fmt: zahl, setter: true },
    { achse: "Erreichbarkeit", ich: zeile.erreichbarkeit, team: team.erreichbarkeit, ziel: sch.erreichbarkeit?.gruen ?? 0.6, fmt: pct, setter: true },
    { achse: "Show-Rate", ich: zeile.showRate, team: team.showRate, ziel: sch.showRateEG?.gruen ?? 0.7, fmt: pct, setter: true },
    { achse: "Quali-Quote", ich: zeile.qualiQuote, team: team.qualiQuote, ziel: sch.qualifizierungsquote?.gruen ?? 0.5, fmt: pct, setter: true },
    { achse: "Closing-Rate", ich: zeile.closingRate, team: team.closingRate, ziel: sch.closingRate?.gruen ?? 0.25, fmt: pct, closer: true },
    { achse: "Abschlüsse", ich: zeile.abschluesse, team: team.abschluesse, ziel: ziele.abschluesse ? ziele.abschluesse * anteil : null, fmt: zahl, closer: true },
    { achse: "Umsatz", ich: zeile.umsatz, team: team.umsatz, ziel: ziele.umsatz ? ziele.umsatz * anteil : null, fmt: eur, closer: true },
  ];
  const passend = achsen.filter((a) => rep.rolle === "beides" || (rep.rolle === "setter" ? a.setter : a.closer));
  const radar: RadarAchse[] = passend.map((a) => {
    // Ohne Ziel: Teamschnitt = 100 %
    const bezug = a.ziel ?? a.team ?? 0;
    const norm = (v: number | null) => (v == null || !bezug ? 0 : Math.min(150, Math.round((v / bezug) * 100)));
    return { achse: a.achse, ich: norm(a.ich), team: norm(a.team), ziel: 100, ichWert: a.fmt(a.ich), teamWert: a.fmt(a.team), zielWert: a.ziel != null ? a.fmt(a.ziel) : "Teamschnitt" };
  });
  return { rep, zeile, team, radar, coaching: coaching(ds, rep, zeile) };
}

/** Schwächen → TRIAS-Module. */
export function coaching(ds: Dataset, rep: Rep, z: RepZeile): Coaching[] {
  const s = ds.settings.schwellen;
  const res: Coaching[] = [];
  const setter = rep.rolle !== "closer", closer = rep.rolle !== "setter";
  const check = (wert: number | null, gruen: number, gelb: number, text: (w: number) => string, modul: string | null) => {
    if (wert == null) return;
    if (wert < gelb) res.push({ stufe: "rot", text: text(wert), modul });
    else if (wert < gruen) res.push({ stufe: "gelb", text: text(wert), modul });
  };
  if (setter) {
    check(z.erreichbarkeit, s.erreichbarkeit?.gruen ?? 0.6, s.erreichbarkeit?.gelb ?? 0.45, (w) => `Erreichbarkeit ${pct(w)} – Anrufzeiten und Mehrfachversuche optimieren`, "Modul 9/10");
    check(z.qualiQuote, s.qualifizierungsquote?.gruen ?? 0.5, s.qualifizierungsquote?.gelb ?? 0.35, (w) => `Qualifizierungsquote ${pct(w)} – Bedarfsanalyse im Erstgespräch schärfen`, "Modul 12");
    check(z.showRate, s.showRateEG?.gruen ?? 0.7, s.showRateEG?.gelb ?? 0.6, (w) => `Show-Rate Erstgespräch ${pct(w)} – Terminbestätigung und Erinnerung prüfen`, null);
    if (z.speedToLead != null && z.speedToLead > (s.speedToLead?.gruen ?? 5))
      res.push({ stufe: z.speedToLead > (s.speedToLead?.gelb ?? 15) ? "rot" : "gelb", text: `Speed-to-Lead ${Math.round(z.speedToLead)} Min. – neue Leads sofort anrufen`, modul: null });
  }
  if (closer) {
    check(z.closingRate, s.closingRate?.gruen ?? 0.25, s.closingRate?.gelb ?? 0.18, (w) => `Closing-Rate ${pct(w)} – Abschlusstechnik trainieren`, "Modul 18–20");
    if (z.verlustPreisAnteil != null && z.verlustPreisAnteil >= 0.4)
      res.push({ stufe: z.verlustPreisAnteil >= 0.55 ? "rot" : "gelb", text: `${pct(z.verlustPreisAnteil)} der Verluste wegen Preis – Werteverkauf und Einwandbehandlung`, modul: "Modul 15/16" });
  }
  if (!res.length) res.push({ stufe: "gruen", text: "Keine auffälligen Schwächen im Zeitraum.", modul: null });
  return res;
}

/** Trend über 8 Wochen für einen Rep. */
export function repWochenTrend(ds: Dataset, repId: string, now = new Date(), wochen = 8) {
  const start = wochenStart(now);
  const res: { label: string; termine: number; abschluesse: number; umsatz: number; anwahlen: number }[] = [];
  for (let i = wochen - 1; i >= 0; i--) {
    const von = addDays(start, -7 * i), bis = addDays(von, 7);
    const z = repTabelle(ds, basisFilter({ key: "frei", von, bis, label: "" }, now)).find((r) => r.repId === repId);
    res.push({ label: von.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }), termine: z?.termine ?? 0, abschluesse: z?.abschluesse ?? 0, umsatz: z?.umsatz ?? 0, anwahlen: z?.anwahlen ?? 0 });
  }
  return res;
}

/** Anwahlen und Gespräche pro Tag (letzte N Tage). */
export function aktivitaetProTag(ds: Dataset, repId: string, now = new Date(), tage = 14) {
  const heute = startOfDay(now);
  const res: { label: string; anwahlen: number; gespraeche: number }[] = [];
  for (let i = tage - 1; i >= 0; i--) {
    const von = addDays(heute, -i).getTime(), bis = addDays(heute, -i + 1).getTime();
    const c = ds.calls.filter((x) => x.userId === repId && x.direction === "outbound" && t(x.at) >= von && t(x.at) < bis);
    res.push({ label: new Date(von).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit" }), anwahlen: c.length, gespraeche: c.filter((x) => x.answered).length });
  }
  return res;
}

// ---------------------------------------------------------------------------
// Mein Tag

export function meinTag(ds: Dataset, repId: string, now = new Date()) {
  const heute = startOfDay(now), morgen = addDays(heute, 1);
  const leadName = new Map(ds.leads.map((l) => [l.id, l.name]));
  const termineHeute = ds.meetings
    .filter((m) => (m.userId === repId) && t(m.startsAt) >= heute.getTime() && t(m.startsAt) < morgen.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((m) => ({ ...m, name: leadName.get(m.leadId) ?? m.leadId }));
  const grenze = addDays(heute, -30).getTime();
  const noShows = ds.meetings
    .filter((m) => m.userId === repId && m.outcome === "no_show" && t(m.startsAt) >= grenze && t(m.startsAt) < now.getTime())
    .filter((m) => !ds.meetings.some((x) => x.leadId === m.leadId && t(x.startsAt) > t(m.startsAt) && x.outcome !== "abgesagt"))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .map((m) => ({ ...m, name: leadName.get(m.leadId) ?? m.leadId }));
  const followUps = ds.tasks
    .filter((x) => x.userId === repId && !x.done && t(x.due) < morgen.getTime())
    .sort((a, b) => a.due.localeCompare(b.due))
    .map((x) => ({ ...x, name: leadName.get(x.leadId) ?? x.leadId, ueberfaellig: t(x.due) < heute.getTime() }));

  const zHeute = zeitraum("heute", now), zWoche = zeitraum("woche", now);
  const ziele = ds.settings.repZiele[repId] ?? {};
  const fortschritt = (z: Zeitraum) => {
    const r = repTabelle(ds, basisFilter(z, now)).find((x) => x.repId === repId);
    const a = zielAnteil(ds, { ...z, bis: z.key === "woche" ? addDays(wochenStart(now), 7) : z.bis });
    const zeilen: { label: string; ist: number; ziel: number | null; format: "zahl" | "eur" }[] = [];
    if (ziele.anwahlen != null) zeilen.push({ label: "Anwahlen", ist: r?.anwahlen ?? 0, ziel: Math.ceil(ziele.anwahlen * a), format: "zahl" });
    if (ziele.termine != null) zeilen.push({ label: "Termine gebucht", ist: r?.termine ?? 0, ziel: Math.ceil(ziele.termine * a), format: "zahl" });
    if (ziele.abschluesse != null) zeilen.push({ label: "Abschlüsse", ist: r?.abschluesse ?? 0, ziel: Math.max(1, Math.round(ziele.abschluesse * a)), format: "zahl" });
    if (ziele.umsatz != null) zeilen.push({ label: "Umsatz", ist: r?.umsatz ?? 0, ziel: Math.round(ziele.umsatz * a), format: "eur" });
    if (!zeilen.length) zeilen.push({ label: "Anwahlen", ist: r?.anwahlen ?? 0, ziel: null, format: "zahl" }, { label: "Termine gebucht", ist: r?.termine ?? 0, ziel: null, format: "zahl" });
    return zeilen;
  };
  const woche = repTabelle(ds, basisFilter(zWoche, now));
  const ich = woche.find((r) => r.repId === repId) ?? null;
  const rolle = ds.reps.find((r) => r.id === repId)?.rolle ?? "beides";
  const gleiche = woche.filter((r) => {
    const x = ds.reps.find((y) => y.id === r.repId);
    return x?.aktiv && (rolle === "beides" || x.rolle === rolle || x.rolle === "beides");
  });
  return { termineHeute, noShows, followUps, heute: fortschritt(zHeute), woche: fortschritt(zWoche), ich, team: mittel(gleiche) };
}

