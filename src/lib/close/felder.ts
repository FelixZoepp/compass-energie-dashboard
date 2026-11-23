import { VERLUSTGRUENDE } from "./protokolle";
// Close-Struktur, die das Dashboard erwartet. Wird von scripts/close-setup.ts angelegt
// und vom Sync über den Namen aufgelöst (IDs ändern sich je Org).

export const PIPELINE_NAME = "Setting / Closing Pipeline";

export const PIPELINE_STATUS: { label: string; type: "active" | "won" | "lost"; stage: string }[] = [
  { label: "Setting - Terminiert", type: "active", stage: "setting" },
  { label: "Setting - No Show", type: "active", stage: "setting" },
  { label: "Setting - Follow Up", type: "active", stage: "setting" },
  { label: "Closing - Terminiert", type: "active", stage: "closing_terminiert" },
  { label: "Closing - No Show", type: "active", stage: "closing_terminiert" },
  { label: "Closing - Follow Up", type: "active", stage: "closing_fu" },
  { label: "Angebot verschickt", type: "active", stage: "angebot" },
  { label: "CC2 - Terminiert", type: "active", stage: "cc2" },
  { label: "Close", type: "won", stage: "won" },
  { label: "Verloren", type: "lost", stage: "lost" },
];

export interface FeldDef {
  name: string;
  type: "text" | "number" | "date" | "datetime" | "choices" | "user";
  choices?: string[];
  description?: string;
}

export const LEAD_FELDER = {
  quelle: { name: "Leadquelle", type: "text", description: "Woher kommt der Lead? (Meta, LinkedIn, Empfehlung, Kaltakquise, Organisch …)" },
  datumEintragung: { name: "Datum Eintragung", type: "datetime" },
  utmSource: { name: "utm_source", type: "text" },
  utmMedium: { name: "utm_medium", type: "text" },
  utmCampaign: { name: "utm_campaign", type: "text", description: "Meta-Kampagnen-ID ({{campaign.id}})" },
  utmTerm: { name: "utm_term", type: "text", description: "Meta-Anzeigengruppen-ID ({{adset.id}})" },
  utmContent: { name: "utm_content", type: "text", description: "Meta-Anzeigen-ID ({{ad.id}}) – Schlüssel für die Attribution" },
  fbclid: { name: "fbclid", type: "text" },
  fbc: { name: "_fbc", type: "text" },
  fbp: { name: "_fbp", type: "text" },
  kundentyp: { name: "Kundentyp", type: "choices", choices: ["B2B", "B2C"] },
  rolle: { name: "Rolle", type: "text", description: "z. B. Geschäftsführer, Vertriebsleiter" },
  teamgroesse: { name: "Teamgröße", type: "number", description: "Anzahl Vertriebler" },
  opener: { name: "Setting Termin gelegt von: (Opener)", type: "user" },
  terminGelegtVon: { name: "Termin gelegt von", type: "user" },
  setter: { name: "Lead Qualifiziert durch Setter:", type: "user" },
  closer: { name: "Closer für den Lead", type: "user" },
  mitarbeiterzahl: { name: "Mitarbeiterzahl", type: "text" },
  gesperrtBis: { name: "Gesperrt bis", type: "datetime", description: "Bis dahin aus den Anruflisten (Smart Views) ausgeblendet – setzt die Protokoll-Automatik" },
  erstgespraechAm: { name: "Setting Termin (Direktbuchung)", type: "datetime", description: "Nächstes Setting/Erstgespräch (aus Protokoll/Calendly)" },
  beratungAm: { name: "Closing Termin", type: "datetime", description: "Nächstes Beratungsgespräch/CC2 (aus Protokoll/Calendly)" },
  ccTermin: { name: "CC Termin", type: "number" },
} satisfies Record<string, FeldDef>;

/** Lead-Status wie in der Zoepp-Org (Close-Standardstatus gelöscht). Mehrere Schlüssel dürfen auf dasselbe Label zeigen. */
export const LEAD_STATUS = {
  neu: "Leadpool",
  kontaktversuch: "Leadpool",
  followup: "Interessiert",
  egTerminiert: "Setting",
  beratungTerminiert: "Closing",
  angebot: "Closing",
  kunde: "Kunde",
  exKunde: "Ex-Kunde",
  nichtQualifiziert: "Unqualifiziert",
  verloren: "Disqualifiziert",
  badData: "Bad Data",
} as const;
export type LeadStatusKey = keyof typeof LEAD_STATUS;

/** Opp-Status-Label der Pipeline je Ziel (für die Automatik). */
export const OPP_STATUS = {
  setting: "Setting - Terminiert",
  settingNoShow: "Setting - No Show",
  settingFu: "Setting - Follow Up",
  closingTerminiert: "Closing - Terminiert",
  closingNoShow: "Closing - No Show",
  closingFu: "Closing - Follow Up",
  angebot: "Angebot verschickt",
  cc2: "CC2 - Terminiert",
  gewonnen: "Close",
  verloren: "Verloren",
} as const;
export type OppStatusKey = keyof typeof OPP_STATUS;

/** Kontaktfelder wie in der Zoepp-Org. */
export const KONTAKT_FELDER = {
  socials: { name: "Socials", type: "text" },
  rolle: { name: "Contact Role", type: "choices", choices: ["Decision Maker", "Gatekeeper", "Point of Contact"] },
} satisfies Record<string, FeldDef>;

export const OPP_FELDER = {
  paket: { name: "Paket", type: "choices", choices: ["Einzelplatz", "Team", "Inhouse"] },
  plaetze: { name: "Plätze", type: "number" },
  zahlungsart: { name: "Zahlungsart", type: "choices", choices: ["Einmalzahlung", "Ratenzahlung 3x", "Ratenzahlung 6x", "Ratenzahlung 12x", "Finanzierung"] },
  verlustgrund: { name: "Verlustgrund", type: "choices", choices: VERLUSTGRUENDE },
  listenpreis: { name: "Listenpreis", type: "number", description: "Für die Rabattquote" },
  cashCollected: { name: "Cash collected", type: "number", description: "Übergangslösung, bis ein Zahlungstool angebunden ist" },
  angebotAm: { name: "Angebot verschickt am", type: "date" },
} satisfies Record<string, FeldDef>;

/** Meeting-Ergebnisse (Close Outcomes, gelten für Meetings). */
export const MEETING_OUTCOMES = ["Stattgefunden", "No Show", "Verschoben", "Abgesagt"];

/** Meeting-Typ aus dem Titel (Calendly-Eventname oder manuell). */
export function meetingTyp(titel: string | null | undefined): "erstgespraech" | "beratung" | "cc2" {
  const t = (titel ?? "").toLowerCase();
  if (/\bcc ?2\b|zweitgespr|closing ?call ?2/.test(t)) return "cc2";
  if (/beratung|strategie|closing|analyse/.test(t)) return "beratung";
  return "erstgespraech";
}

export function meetingOutcome(name: string | null | undefined, status?: string | null) {
  const n = (name ?? "").toLowerCase();
  if (/stattgefunden|completed|erschienen$|durchgef/.test(n)) return "stattgefunden" as const;
  if (/no.?show|nicht erschienen/.test(n)) return "no_show" as const;
  if (/verschoben|reschedul/.test(n)) return "verschoben" as const;
  if (/abgesagt|cancel/.test(n)) return "abgesagt" as const;
  if (status === "canceled" || status === "declined-by-lead" || status === "declined-by-org") return "abgesagt" as const;
  return null;
}

export function quelleAus(wert: string | null | undefined, utmSource?: string | null) {
  const v = (wert ?? "").toLowerCase();
  if (v) {
    if (v.startsWith("meta") || v.includes("facebook") || v.includes("instagram")) return "meta" as const;
    if (v.includes("linkedin")) return "linkedin" as const;
    if (v.includes("empfehl")) return "empfehlung" as const;
    if (v.includes("kalt")) return "kaltakquise" as const;
    if (v.includes("organ")) return "organisch" as const;
  }
  const u = (utmSource ?? "").toLowerCase();
  if (/meta|facebook|fb|instagram|ig/.test(u)) return "meta" as const;
  if (u.includes("linkedin")) return "linkedin" as const;
  return "sonstige" as const;
}
