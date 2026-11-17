// Zusätzliche Auswertungen fürs CEO-Cockpit: Verlauf je Kennzahl, Termin-Verteilung, Kanal-Mix, Ziele-Kompass.
import type { Dataset, MeetingTyp, Quelle } from "../types";
import { ampel, type KpiId } from "./katalog";
import { berechne, type Filter, type Kennzahlen } from "./engine";
import { addDays, startOfDay, wochenStart } from "./zeit";

export type Granularitaet = "tage" | "wochen" | "monate";
export const VERLAUF_METRIKEN = [
  { key: "leads", label: "Neue Leads", format: "zahl" },
  { key: "egGebucht", label: "Erstgespräche gebucht", format: "zahl" },
  { key: "egShows", label: "Erstgespräche geführt", format: "zahl" },
  { key: "bgGebucht", label: "Beratungen gebucht", format: "zahl" },
  { key: "bgShows", label: "Beratungen geführt", format: "zahl" },
  { key: "abschluesse", label: "Abschlüsse", format: "zahl" },
  { key: "umsatz", label: "Umsatz", format: "eur" },
  { key: "cash", label: "Cash", format: "eur" },
  { key: "spend", label: "Werbeausgaben", format: "eur" },
] as const;
export type VerlaufKey = (typeof VERLAUF_METRIKEN)[number]["key"];
export type VerlaufPunkt = { label: string } & Record<VerlaufKey, number>;

export function verlauf(ds: Dataset, f: Filter, g: Granularitaet, now = new Date()): VerlaufPunkt[] {
  const buckets: { von: Date; bis: Date; label: string }[] = [];
  if (g === "tage") {
    for (let i = 29; i >= 0; i--) { const von = addDays(startOfDay(now), -i); buckets.push({ von, bis: addDays(von, 1), label: von.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) }); }
  } else if (g === "wochen") {
    const s = wochenStart(now);
    for (let i = 11; i >= 0; i--) { const von = addDays(s, -7 * i); buckets.push({ von, bis: addDays(von, 7), label: von.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) }); }
  } else {
    for (let i = 5; i >= 0; i--) { const von = new Date(now.getFullYear(), now.getMonth() - i, 1); buckets.push({ von, bis: new Date(von.getFullYear(), von.getMonth() + 1, 1), label: von.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }) }); }
  }
  return buckets.map((b) => {
    const k = berechne(ds, { ...f, sicht: "ereignis", zeitraum: { key: "frei", von: b.von, bis: b.bis, label: "" }, now });
    const p = { label: b.label } as VerlaufPunkt;
    for (const m of VERLAUF_METRIKEN) p[m.key] = Math.round((k[m.key as keyof Kennzahlen] as number) * 100) / 100;
    return p;
  });
}

export interface Verteilung { key: string; label: string; anzahl: number; farbe: string; schraffiert?: boolean }

/** Wie gingen die Termine im Zeitraum aus (nach Startdatum)? */
export function terminVerteilung(ds: Dataset, f: Filter, typ: MeetingTyp | "beratung+cc2", now = new Date()) {
  const von = f.zeitraum.von.getTime(), bis = f.zeitraum.bis.getTime(), n = now.getTime();
  const leadOk = new Set(ds.leads.filter((l) => (!f.quelle || l.quelle === f.quelle) && (!f.kampagne || l.utmCampaign === f.kampagne) && (!f.kundentyp || l.kundentyp === f.kundentyp) && (!f.rep || l.setterId === f.rep || l.closerId === f.rep)).map((l) => l.id));
  const ms = ds.meetings.filter((m) => leadOk.has(m.leadId) && (typ === "beratung+cc2" ? m.typ !== "erstgespraech" : m.typ === typ))
    .filter((m) => { const t = Date.parse(m.startsAt); return t >= von && t < bis; });
  const gewonnen = new Set(ds.opps.filter((o) => o.stage === "won").map((o) => o.leadId));
  const z = { abschluss: 0, gefuehrt: 0, no_show: 0, abgesagt: 0, offen: 0, geplant: 0 };
  for (const m of ms) {
    const vergangen = Date.parse(m.startsAt) < n;
    if (!vergangen) z.geplant++;
    else if (m.outcome === "stattgefunden") { if (typ !== "erstgespraech" && gewonnen.has(m.leadId)) z.abschluss++; else z.gefuehrt++; }
    else if (m.outcome === "no_show") z.no_show++;
    else if (m.outcome === "abgesagt" || m.outcome === "verschoben") z.abgesagt++;
    else z.offen++;
  }
  const teile: Verteilung[] = [
    ...(typ !== "erstgespraech" ? [{ key: "abschluss", label: "Abschluss", anzahl: z.abschluss, farbe: "var(--brand-700)" }] : []),
    { key: "gefuehrt", label: "geführt", anzahl: z.gefuehrt, farbe: "var(--brand-400)" },
    { key: "no_show", label: "nicht erschienen", anzahl: z.no_show, farbe: "var(--bad)" },
    { key: "abgesagt", label: "abgesagt / verschoben", anzahl: z.abgesagt, farbe: "var(--warn)" },
    { key: "offen", label: "Ergebnis fehlt", anzahl: z.offen, farbe: "var(--axis)" },
    { key: "geplant", label: "geplant", anzahl: z.geplant, farbe: "var(--grid)", schraffiert: true },
  ];
  const faellig = ms.length - z.geplant;
  const quote = faellig > 0 ? (z.gefuehrt + z.abschluss) / faellig : null;
  return { gesamt: ms.length, faellig, quote, teile };
}

/** Kanal-Mix: Leads → Termine → Abschlüsse → Umsatz je Quelle. */
export function kanalMix(ds: Dataset, f: Filter) {
  const quellen: Quelle[] = ["meta", "linkedin", "empfehlung", "kaltakquise", "organisch", "sonstige"];
  return quellen.map((q) => ({ quelle: q, k: berechne(ds, { ...f, quelle: q }) })).filter((x) => x.k.leads > 0 || x.k.abschluesse > 0);
}

export const QUELLE_LABEL: Record<Quelle, string> = { meta: "Meta Ads", linkedin: "LinkedIn", empfehlung: "Empfehlung", kaltakquise: "Kaltakquise", organisch: "Organisch", sonstige: "Sonstige" };

/** Ziele-Kompass: wie viele Soll-Quoten sind erreicht? */
export function zieleKompass(k: Kennzahlen, ds: Dataset) {
  const q: { id: KpiId; label: string; wert: number | null; basis?: number }[] = [
    { id: "buchungsquote", label: "Lead → Erstgespräch gebucht", wert: k.buchungsquote, basis: k.leads },
    { id: "showRateEG", label: "Show-Rate Erstgespräch", wert: k.showRateEG, basis: k.egFaellig },
    { id: "qualifizierungsquote", label: "Erstgespräch → Beratung", wert: k.qualifizierungsquote, basis: k.egShows },
    { id: "showRateBG", label: "Show-Rate Beratung", wert: k.showRateBG, basis: k.bgFaellig },
    { id: "closingRate", label: "Closing-Rate", wert: k.closingRate, basis: k.bgShows },
    { id: "cpl", label: "Kosten pro Lead", wert: k.cpl, basis: k.leadsMeta },
  ];
  const mit = q.map((x) => ({ ...x, a: ampel(x.id, x.wert, x.basis, ds.settings) }));
  return {
    quoten: mit,
    erreicht: mit.filter((x) => x.a === "gruen").length,
    knapp: mit.filter((x) => x.a === "gelb").length,
    verfehlt: mit.filter((x) => x.a === "rot").length,
    gesamt: mit.length,
  };
}
