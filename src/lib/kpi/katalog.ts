// KPI-Katalog: feste Definitionen, Startziele und Ampel-Logik (Abschnitt 4 der Spezifikation).
// Schwellen sind in den Einstellungen überschreibbar (settings.schwellen[id]).

import type { OppStage, Settings } from "../types";

export type Einheit = "eur" | "pct" | "zahl" | "min" | "tage" | "faktor";
export type Richtung = "hoch" | "niedrig"; // hoch = mehr ist besser

export interface KpiDef {
  id: string;
  label: string;
  formel: string;
  quelle: string;
  einheit: Einheit;
  richtung?: Richtung;
  gruen?: number; // ab hier grün
  gelb?: number; // ab hier gelb, sonst rot
  minBasis?: number; // darunter: "zu wenig Daten"
}

const k = (d: KpiDef) => d;

export const KPIS = {
  // 4.1 Meta
  spend: k({ id: "spend", label: "Werbeausgaben", formel: "Σ spend", quelle: "Meta Insights", einheit: "eur" }),
  impressions: k({ id: "impressions", label: "Impressionen", formel: "Σ impressions", quelle: "Meta Insights", einheit: "zahl" }),
  reach: k({ id: "reach", label: "Reichweite", formel: "Σ reach (Tageswerte, Näherung)", quelle: "Meta Insights", einheit: "zahl" }),
  frequency: k({ id: "frequency", label: "Frequenz", formel: "Impressionen ÷ Reichweite", quelle: "Meta Insights", einheit: "faktor", richtung: "niedrig", gruen: 2.5, gelb: 3.5 }),
  cpm: k({ id: "cpm", label: "CPM", formel: "Spend ÷ Impressionen × 1000", quelle: "Meta Insights", einheit: "eur", richtung: "niedrig" }),
  hookRate: k({ id: "hookRate", label: "Hook-Rate", formel: "3-Sek.-Views ÷ Impressionen", quelle: "Meta Insights", einheit: "pct", richtung: "hoch", gruen: 0.3, gelb: 0.2, minBasis: 1000 }),
  holdRate: k({ id: "holdRate", label: "Hold-Rate", formel: "ThruPlays ÷ 3-Sek.-Views", quelle: "Meta Insights", einheit: "pct", richtung: "hoch", gruen: 0.25, gelb: 0.15, minBasis: 200 }),
  ctr: k({ id: "ctr", label: "Link-CTR", formel: "Link-Klicks ÷ Impressionen", quelle: "Meta Insights", einheit: "pct", richtung: "hoch", gruen: 0.01, gelb: 0.007, minBasis: 1000 }),
  cpc: k({ id: "cpc", label: "CPC (Link)", formel: "Spend ÷ Link-Klicks", quelle: "Meta Insights", einheit: "eur", richtung: "niedrig", gruen: 2, gelb: 3, minBasis: 20 }),
  lpLoad: k({ id: "lpLoad", label: "LP-Ladequote", formel: "LP-Views ÷ Link-Klicks", quelle: "Meta Insights", einheit: "pct", richtung: "hoch", gruen: 0.8, gelb: 0.65, minBasis: 30 }),
  lpConv: k({ id: "lpConv", label: "LP-Conversion", formel: "Leads ÷ LP-Views", quelle: "Meta + Close", einheit: "pct", richtung: "hoch", gruen: 0.15, gelb: 0.1, minBasis: 30 }),

  // 4.2 Leads und Termine
  leads: k({ id: "leads", label: "Leads", formel: "neue Leads (CRM-verifiziert)", quelle: "Close", einheit: "zahl", richtung: "hoch" }),
  cpl: k({ id: "cpl", label: "CPL", formel: "Spend ÷ Leads (nur Meta-Leads)", quelle: "Meta + Close", einheit: "eur", richtung: "niedrig", gruen: 80, gelb: 110, minBasis: 5 }),
  qualiQuote: k({ id: "qualiQuote", label: "Qualifizierte Leads", formel: "Leads mit Kundentyp + ICP ÷ Leads", quelle: "Close", einheit: "pct", richtung: "hoch", gruen: 0.5, gelb: 0.35, minBasis: 10 }),
  kostenQualiLead: k({ id: "kostenQualiLead", label: "Kosten pro qual. Lead", formel: "Spend ÷ qualifizierte Leads", quelle: "Meta + Close", einheit: "eur", richtung: "niedrig" }),
  buchungsquote: k({ id: "buchungsquote", label: "Buchungsquote", formel: "Erstgespräche gebucht ÷ Leads", quelle: "Close", einheit: "pct", richtung: "hoch", gruen: 0.3, gelb: 0.2, minBasis: 10 }),
  kostenTermin: k({ id: "kostenTermin", label: "Kosten pro Termin", formel: "Spend ÷ Erstgespräche gebucht", quelle: "Meta + Close", einheit: "eur", richtung: "niedrig", gruen: 150, gelb: 220, minBasis: 3 }),
  kostenShow: k({ id: "kostenShow", label: "Kosten pro Show", formel: "Spend ÷ Erstgespräche stattgefunden", quelle: "Meta + Close", einheit: "eur", richtung: "niedrig", gruen: 200, gelb: 300, minBasis: 3 }),

  // 4.3 Setting
  speedToLead: k({ id: "speedToLead", label: "Speed-to-Lead", formel: "Median Minuten Eintragung → erster Anruf (Arbeitszeit)", quelle: "Close Calls", einheit: "min", richtung: "niedrig", gruen: 5, gelb: 15, minBasis: 5 }),
  unter5: k({ id: "unter5", label: "Anteil < 5 Min. angerufen", formel: "Leads mit erstem Anruf < 5 Min. ÷ angerufene Leads", quelle: "Close Calls", einheit: "pct", richtung: "hoch", gruen: 0.8, gelb: 0.6, minBasis: 5 }),
  anwahlen: k({ id: "anwahlen", label: "Anwahlen", formel: "Σ ausgehende Calls", quelle: "Close Calls", einheit: "zahl", richtung: "hoch" }),
  anwahlenProLead: k({ id: "anwahlenProLead", label: "Anwahlen pro Lead", formel: "Calls ÷ bearbeitete Leads", quelle: "Close Calls", einheit: "faktor", richtung: "hoch", gruen: 6, gelb: 4, minBasis: 5 }),
  erreichbarkeit: k({ id: "erreichbarkeit", label: "Erreichbarkeit", formel: "Leads mit ≥ 1 Gespräch ÷ angerufene Leads", quelle: "Close Calls", einheit: "pct", richtung: "hoch", gruen: 0.6, gelb: 0.45, minBasis: 10 }),
  gespraechszeit: k({ id: "gespraechszeit", label: "Gesprächszeit", formel: "Σ Dauer angenommener Calls", quelle: "Close Calls", einheit: "min", richtung: "hoch" }),
  showRateEG: k({ id: "showRateEG", label: "Show-Rate Erstgespräch", formel: "stattgefunden ÷ fällig", quelle: "Close Meetings", einheit: "pct", richtung: "hoch", gruen: 0.7, gelb: 0.6, minBasis: 10 }),
  qualifizierungsquote: k({ id: "qualifizierungsquote", label: "Qualifizierungsquote", formel: "Beratungsgespräche gebucht ÷ Erstgespräche stattgefunden", quelle: "Close Meetings", einheit: "pct", richtung: "hoch", gruen: 0.5, gelb: 0.35, minBasis: 10 }),
  noShowRecovery: k({ id: "noShowRecovery", label: "No-Show-Recovery", formel: "No-Shows mit neuem stattgefundenem Termin ÷ No-Shows", quelle: "Close Meetings", einheit: "pct", richtung: "hoch", gruen: 0.3, gelb: 0.2, minBasis: 5 }),

  // 4.4 Closing
  showRateBG: k({ id: "showRateBG", label: "Show-Rate Beratung", formel: "stattgefunden ÷ fällig", quelle: "Close Meetings", einheit: "pct", richtung: "hoch", gruen: 0.8, gelb: 0.7, minBasis: 10 }),
  closingRate: k({ id: "closingRate", label: "Closing-Rate", formel: "Gewonnen ÷ Beratungsgespräche stattgefunden", quelle: "Close", einheit: "pct", richtung: "hoch", gruen: 0.25, gelb: 0.18, minBasis: 10 }),
  angebotsquote: k({ id: "angebotsquote", label: "Angebotsquote", formel: "Angebote verschickt ÷ Beratungsgespräche stattgefunden", quelle: "Close", einheit: "pct", richtung: "hoch" }),
  angebotsAbschluss: k({ id: "angebotsAbschluss", label: "Angebots-Abschlussquote", formel: "Gewonnen aus Angebot ÷ Angebote", quelle: "Close", einheit: "pct", richtung: "hoch", gruen: 0.4, gelb: 0.3, minBasis: 5 }),
  aov: k({ id: "aov", label: "Ø Auftragswert", formel: "Umsatz ÷ Abschlüsse", quelle: "Close", einheit: "eur", richtung: "hoch" }),
  plaetzeB2B: k({ id: "plaetzeB2B", label: "Ø Plätze pro B2B-Deal", formel: "Σ Plätze ÷ B2B-Abschlüsse", quelle: "Close", einheit: "faktor", richtung: "hoch" }),
  rabattquote: k({ id: "rabattquote", label: "Rabattquote", formel: "Σ (Listenpreis − Verkaufspreis) ÷ Σ Listenpreis", quelle: "Close", einheit: "pct", richtung: "niedrig", gruen: 0.05, gelb: 0.1, minBasis: 3 }),
  salesCycle: k({ id: "salesCycle", label: "Sales Cycle", formel: "Median Tage Eintragung → Gewonnen", quelle: "Close", einheit: "tage", richtung: "niedrig" }),

  // 4.5 Umsatz und Unit Economics
  umsatz: k({ id: "umsatz", label: "Umsatz", formel: "Σ Opp-Werte gewonnen (Auftragseingang)", quelle: "Close", einheit: "eur", richtung: "hoch" }),
  cash: k({ id: "cash", label: "Cash collected", formel: "Σ Zahlungseingänge", quelle: "Zahlungen / Close-Feld", einheit: "eur", richtung: "hoch" }),
  cashQuote: k({ id: "cashQuote", label: "Cash-Quote", formel: "Cash ÷ Umsatz", quelle: "Zahlungen + Close", einheit: "pct", richtung: "hoch", gruen: 0.7, gelb: 0.5 }),
  abschluesse: k({ id: "abschluesse", label: "Abschlüsse", formel: "Anzahl gewonnener Opps", quelle: "Close", einheit: "zahl", richtung: "hoch" }),
  cac: k({ id: "cac", label: "CAC (bezahlt)", formel: "Meta-Spend ÷ Abschlüsse aus Meta (Ziel < 30 % AOV)", quelle: "Meta + Close", einheit: "eur", richtung: "niedrig" }),
  cacVoll: k({ id: "cacVoll", label: "CAC (voll)", formel: "(Spend + Provisionen + Tools) ÷ alle Abschlüsse", quelle: "Meta + Close + Einstellungen", einheit: "eur", richtung: "niedrig" }),
  roas: k({ id: "roas", label: "ROAS", formel: "Umsatz aus Meta-Leads ÷ Meta-Spend (Kohorte)", quelle: "Meta + Close", einheit: "faktor", richtung: "hoch", gruen: 4, gelb: 2.5 }),
  cashRoas: k({ id: "cashRoas", label: "Cash-ROAS", formel: "Cash aus Meta-Leads ÷ Meta-Spend", quelle: "Meta + Zahlungen", einheit: "faktor", richtung: "hoch", gruen: 2.5, gelb: 1.5 }),
  mer: k({ id: "mer", label: "MER", formel: "Gesamtumsatz ÷ Marketingbudget", quelle: "Meta + Close", einheit: "faktor", richtung: "hoch" }),
  deckungsbeitrag: k({ id: "deckungsbeitrag", label: "Deckungsbeitrag / Kunde", formel: "AOV − CAC − Provision − Lieferkosten", quelle: "berechnet", einheit: "eur", richtung: "hoch" }),
  ltvCac: k({ id: "ltvCac", label: "LTV : CAC", formel: "LTV ÷ CAC", quelle: "berechnet", einheit: "faktor", richtung: "hoch", gruen: 3, gelb: 2 }),

  // 4.7 Datenhygiene
  dqScore: k({ id: "dqScore", label: "Datenqualitäts-Score", formel: "100 − gewichtete Fehler", quelle: "Close", einheit: "zahl", richtung: "hoch", gruen: 95, gelb: 85 }),
} satisfies Record<string, KpiDef>;

export type KpiId = keyof typeof KPIS;

export type Ampel = "gruen" | "gelb" | "rot" | "grau" | "neutral";

export function ampel(id: KpiId, wert: number | null | undefined, basis: number | undefined, settings?: Settings): Ampel {
  const def = KPIS[id] as KpiDef;
  if (wert == null || !Number.isFinite(wert)) return "grau";
  if (def.minBasis != null && basis != null && basis < def.minBasis) return "grau";
  const s = settings?.schwellen?.[id];
  const gruen = s?.gruen ?? def.gruen;
  const gelb = s?.gelb ?? def.gelb;
  if (gruen == null || gelb == null || !def.richtung) return "neutral";
  if (def.richtung === "hoch") return wert >= gruen ? "gruen" : wert >= gelb ? "gelb" : "rot";
  return wert <= gruen ? "gruen" : wert <= gelb ? "gelb" : "rot";
}

export function zielText(id: KpiId, settings?: Settings): string | null {
  const def = KPIS[id] as KpiDef;
  const s = settings?.schwellen?.[id];
  const g = s?.gruen ?? def.gruen;
  if (g == null || !def.richtung) return null;
  return `${def.richtung === "hoch" ? "≥" : "≤"} ${formatWert(g, def.einheit)}`;
}

export function formatWert(v: number | null | undefined, einheit: Einheit, kompakt = false): string {
  if (v == null || !Number.isFinite(v)) return "–";
  switch (einheit) {
    case "eur":
      if (kompakt && Math.abs(v) >= 10000) return `${(v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} T€`;
      return v.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 });
    case "pct":
      return `${(v * 100).toLocaleString("de-DE", { maximumFractionDigits: v < 0.1 ? 1 : 0 })} %`;
    case "min":
      return v < 60 ? `${v.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Min.` : `${(v / 60).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Std.`;
    case "tage":
      return `${v.toLocaleString("de-DE", { maximumFractionDigits: 0 })} Tage`;
    case "faktor":
      return v.toLocaleString("de-DE", { maximumFractionDigits: 2 });
    default:
      return v.toLocaleString("de-DE", { maximumFractionDigits: 0 });
  }
}

export const STAGE_LABEL: Record<OppStage, string> = {
  setting: "Setting",
  closing_terminiert: "Closing terminiert",
  closing_fu: "Closing Follow-up",
  angebot: "Angebot",
  cc2: "CC2",
  won: "Gewonnen",
  lost: "Verloren",
};

export const DEFAULT_SETTINGS: Settings = {
  monatsziel: {},
  repZiele: {},
  schwellen: {},
  provisionsquote: 0.1,
  toolkostenMonat: 800,
  lieferkostenProTeilnehmer: 250,
  listenpreise: { Einzelplatz: 3000, Team: 9000, Inhouse: 18000 },
  arbeitszeit: { start: 8, ende: 19, tage: [1, 2, 3, 4, 5] },
  stageWahrscheinlichkeit: { setting: 0.05, closing_terminiert: 0.25, closing_fu: 0.3, angebot: 0.5, cc2: 0.6, won: 1, lost: 0 },
  icpMinTeam: 3,
};
