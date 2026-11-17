// Close-Struktur, die das Dashboard erwartet. Wird von scripts/close-setup.ts angelegt
// und vom Sync über den Namen aufgelöst (IDs ändern sich je Org).

export const PIPELINE_NAME = "Vertrieb TRIAS 360";

export const PIPELINE_STATUS: { label: string; type: "active" | "won" | "lost"; stage: string }[] = [
  { label: "Setting", type: "active", stage: "setting" },
  { label: "Closing terminiert", type: "active", stage: "closing_terminiert" },
  { label: "Closing FU", type: "active", stage: "closing_fu" },
  { label: "Angebot", type: "active", stage: "angebot" },
  { label: "CC2", type: "active", stage: "cc2" },
  { label: "Gewonnen", type: "won", stage: "won" },
  { label: "Verloren", type: "lost", stage: "lost" },
];

export interface FeldDef {
  name: string;
  type: "text" | "number" | "date" | "datetime" | "choices" | "user";
  choices?: string[];
  description?: string;
}

export const LEAD_FELDER = {
  quelle: { name: "Quelle", type: "choices", choices: ["Meta", "LinkedIn", "Empfehlung", "Kaltakquise", "Organisch", "Sonstige"], description: "Woher kommt der Lead?" },
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
  setter: { name: "Setter", type: "user" },
  closer: { name: "Closer", type: "user" },
} satisfies Record<string, FeldDef>;

export const OPP_FELDER = {
  paket: { name: "Paket", type: "choices", choices: ["Einzelplatz", "Team", "Inhouse"] },
  plaetze: { name: "Plätze", type: "number" },
  zahlungsart: { name: "Zahlungsart", type: "choices", choices: ["Einmalzahlung", "Ratenzahlung 3x", "Ratenzahlung 6x", "Ratenzahlung 12x", "Finanzierung"] },
  verlustgrund: { name: "Verlustgrund", type: "choices", choices: ["Preis", "Kein Bedarf", "Zeitpunkt", "Konkurrenz", "Nicht erreichbar", "Entscheider fehlt", "Sonstiges"] },
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
