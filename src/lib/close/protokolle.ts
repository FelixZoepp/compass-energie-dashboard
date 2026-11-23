// Gesprächsprotokolle (Close Custom Activities) für Compass – 1:1 wie in der Zoepp-Org.
// Rein deklarativ (keine Server-Abhängigkeiten): wird von scripts/close-setup.ts angelegt,
// von der Automatik (automatik.ts) über die Namen aufgelöst und von regeln.ts ausgewertet.

export type ProtokollTyp = "erstkontakt" | "erstgespraech" | "closing" | "followup";

export type FeldTyp = "text" | "textarea" | "richtextarea" | "number" | "date" | "datetime" | "choices" | "user";

export interface ProtokollFeld {
  key: string;
  name: string;
  typ: FeldTyp;
  choices?: string[];
}

export interface ProtokollDef {
  typ: ProtokollTyp;
  name: string;
  beschreibung: string;
  felder: ProtokollFeld[];
}

const JA_NEIN = ["Ja", "Nein"];

/** Gründe wie in der Zoepp-Org (GS = Grundsatz-Kriterium aus dem Setting). */
export const NQ_GRUENDE = [
  "Entscheider fehlt (GS 3)",
  "Kein Bedarf (GS 1)",
  "Kein Budget / nicht liquide (GS 2)",
  "Kein zeitnaher Start (GS 4)",
  "Passt nicht (Branche/Modell)",
  "Respektlos (GS 5)",
];
export const VERLUSTGRUENDE = ["Anderer Anbieter", ...NQ_GRUENDE.slice(0, 4), "Nicht mehr erreichbar (Ghosting)", ...NQ_GRUENDE.slice(4), "Sonstiges (Notiz)"].sort((a, b) => a.localeCompare(b, "de"));

export const ERGEBNIS = {
  erstkontakt: {
    badData: "Bad Data / Falsche Nummer",
    selbstBuchung: "Bucht sich selbst ein",
    keinInteresse3: "Kein Interesse - 3M",
    keinInteresse6: "Kein Interesse - 6M",
    rueckruf: "Rückruf vereinbart am:",
    egTerminiert: "Setting vereinbart am:",
    nichtQualifiziert: "Unqualifiziert",
  },
  erstgespraech: {
    abgesagt: "Abgesagt",
    beratungTerminiert: "Beratungsgespräch gelegt",
    disqualifiziert: "Disqualifiziert",
    followup: "Follow-up / Rückruf",
    noShow: "No-Show",
    nichtQualifiziert: "Unqualifiziert",
    verschoben: "Verschoben",
  },
  closing: {
    gewonnen: "1. Abgeschlossen",
    angebot: "2. Angebot versendet",
    nichtQualifiziert: "3. Unqualifiziert",
    disqualifiziert: "4. Disqualifiziert",
    cc2: "5. CC2 vereinbart am:",
    noShow: "6. No-Show",
    verschoben: "7. Verschoben auf:",
    verloren: "8. Verloren",
    abgesagt: "9. Abgesagt",
  },
  followup: {
    gewonnen: "Abgeschlossen",
    beratungTerminiert: "Beratungsgespräch gelegt",
    egTerminiert: "Erstgespräch gelegt",
    nichtErreicht: "Nicht erreicht",
    verloren: "Verloren",
    weiter: "Weiter Follow-up",
  },
} as const;

/** Protokolle 1:1 wie in der Zoepp-Org (Namen, Felder, Auswahlwerte). Closing hat zusätzlich die Compass-Deal-Felder am Ende. */
export const PROTOKOLLE: ProtokollDef[] = [
  {
    typ: "erstkontakt",
    name: "1 - Gesprächsprotokoll (Terminierung)",
    beschreibung: "Jeder Anrufversuch. Ziel: Setting (Erstgespräch) vereinbaren.",
    felder: [
      { key: "erreicht", name: "📞Wen erreicht?", typ: "choices", choices: ["Gatekeeper / Assistenz", "Lead", "Niemand / Mailbox"] },
      { key: "gatekeeper", name: "🔎 Gatekeeper Ergebnis", typ: "choices", choices: ["Abgeblockt", "Handy/Durchwahl bekommen", "Rückruf vereinbart am:"] },
      { key: "ergebnis", name: "🔍Entscheider Ergebnis", typ: "choices", choices: Object.values(ERGEBNIS.erstkontakt) },
      { key: "einwand", name: "🛑 Einwand", typ: "choices", choices: ["Hat schon Anbieter", "Kein Bedarf mehr", "Kein Budget", "Keine Zeit", "Schicken Sie eine Mail", "Wollte nur Infos"] },
      { key: "kalender", name: "⏰ Kalender", typ: "datetime" },
      { key: "gelegtAuf", name: "Gelegt auf:", typ: "user" },
    ],
  },
  {
    typ: "erstgespraech",
    name: "2 - Gesprächsprotokoll (Setting)",
    beschreibung: "Qualifizierung durch den Setter. Ziel: Beratungsgespräch mit dem Closer legen.",
    felder: [
      { key: "produktRegion", name: "Produkt & Region", typ: "text" },
      { key: "schmerz", name: "Größtes Problem bei der Vertriebler-Gewinnung", typ: "text" },
      { key: "bisher", name: "Bisher ausprobiert & warum nicht geklappt", typ: "text" },
      { key: "gs1Bedarf", name: "GS 1 · Bedarf bestätigt", typ: "choices", choices: JA_NEIN },
      { key: "teamgroesse", name: "Vertriebler aktuell", typ: "number" },
      { key: "anstellungsart", name: "Anstellungsart", typ: "choices", choices: ["Angestellt", "Gemischt", "Handelsvertreter nebenbei", "Handelsvertreter Vollzeit"] },
      { key: "umsatz", name: "Umsatz pro Monat (€)", typ: "number" },
      { key: "ziel", name: "Ziel: neue Vertriebler pro Monat", typ: "number" },
      { key: "zielWarum", name: "Warum ist das Ziel wichtig?", typ: "text" },
      { key: "bewerberAnrufen", name: "Bewerber anrufen", typ: "choices", choices: ["Abgeben (Innendienst)", "Selbst", "Teamleiter"] },
      { key: "gs2Budget", name: "GS 2 · Monatsbudget inkl. Werbebudget (€)", typ: "number" },
      { key: "gs2Liquide", name: "GS 2 · Geld liquide", typ: "choices", choices: JA_NEIN },
      { key: "gs3Entscheider", name: "GS 3 · Entscheider", typ: "choices", choices: ["Allein", "Weitere entscheiden mit, kommen nicht", "Weitere kommen mit"] },
      { key: "teilnehmer", name: "Weitere Teilnehmer im Termin", typ: "text" },
      { key: "gs4Start", name: "GS 4 · Möglicher Start", typ: "date" },
      { key: "gs5", name: "GS 5 · Persönlich geeignet (respektvoll)", typ: "choices", choices: JA_NEIN },
      { key: "garantie", name: "Hat nach Garantie gefragt", typ: "choices", choices: JA_NEIN },
      { key: "whatsapp", name: "WhatsApp-Nummer (nur wenn abweichend)", typ: "text" },
      { key: "ergebnis", name: "✅ Ergebnis", typ: "choices", choices: Object.values(ERGEBNIS.erstgespraech) },
      { key: "grund", name: "Grund (bei Unqualifiziert)", typ: "choices", choices: NQ_GRUENDE },
      { key: "kalender", name: "📅 Kalender (Beratungsgespräch / Rückruf)", typ: "datetime" },
      { key: "closer", name: "Closer", typ: "user" },
      { key: "notizen", name: "Notizen für den Closer", typ: "richtextarea" },
    ],
  },
  {
    typ: "closing",
    name: "3 - Gesprächsprotokoll (Closing)",
    beschreibung: "Beratungsgespräch durch den Closer. Auch für CC2 verwenden.",
    felder: [
      { key: "ergebnis", name: "Nächster Schritt:", typ: "choices", choices: Object.values(ERGEBNIS.closing) },
      { key: "umsatzAktuell", name: "Wie viel Umsatz aktuell?", typ: "text" },
      { key: "herausforderung", name: "Größte Herausforderung aktuell?", typ: "text" },
      { key: "dreiJahre", name: "Was meinst du wenn 3 Jahre genauso weitermachst, was würde sich ändern?", typ: "text" },
      { key: "bedeutung", name: "Was würde das für dich bedeuten?", typ: "text" },
      { key: "gefuehl", name: "Wie fühlt sich das an?", typ: "text" },
      { key: "kundenwert", name: "Wie viel ist ein Kunde wert?", typ: "text" },
      { key: "gefuehlZiel", name: "Wie würde sich das anfühlen?", typ: "text" },
      { key: "commitment", name: "Das heißt wenn ich dir das zeigen könnte und du ein gutes Bauchgefühl hast, dann machen wir das?", typ: "choices", choices: JA_NEIN },
      { key: "frame", name: "Frame setzen: 100% geben", typ: "choices", choices: ["Ja gemacht", "Nicht gemacht"] },
      { key: "methode", name: "Methode zeigen", typ: "choices", choices: ["Gemacht", "Nicht gemacht"] },
      { key: "anrufen", name: "Würdest du auch Leute anrufen, ist das für dich eine Mehtode?", typ: "text" },
      { key: "vertrauen", name: "Vertraust du dir, diese Ergebnisse zu erreichen?", typ: "text" },
      { key: "skala", name: "Skala 1-10 wie sicher bist du dir dass unsere Methode funktioniert", typ: "text" },
      { key: "kalender", name: "📅Kalender:", typ: "datetime" },
      // Compass-Deal-Felder (für Umsatz/Paket im Dashboard)
      { key: "paket", name: "Paket", typ: "choices", choices: ["Einzelplatz", "Team", "Inhouse"] },
      { key: "plaetze", name: "Plätze", typ: "number" },
      { key: "preis", name: "Preis netto (€)", typ: "number" },
      { key: "zahlungsart", name: "Zahlungsart", typ: "choices", choices: ["Einmalzahlung", "Ratenzahlung 3x", "Ratenzahlung 6x", "Ratenzahlung 12x", "Finanzierung"] },
      { key: "verlustgrund", name: "Verlustgrund", typ: "choices", choices: VERLUSTGRUENDE },
    ],
  },
  {
    typ: "followup",
    name: "4 - Gesprächsprotokoll (Follow-Up)",
    beschreibung: "Nachfassen: Setting-Follow-up, Closing-Follow-up, No-Show-Rückholung.",
    felder: [
      { key: "art", name: "Art", typ: "choices", choices: ["Closing-Follow-up", "No-Show-Rückholung", "Setting-Follow-up"] },
      { key: "erreicht", name: "📞 Erreicht?", typ: "choices", choices: ["Ja", "Nein / Mailbox"] },
      { key: "offenerPunkt", name: "Offener Punkt / Einwand", typ: "choices", choices: ["Budget", "Entscheider", "Kein Bedarf mehr", "Sonstiges", "Vergleicht Anbieter", "Vertrauen / Garantie", "Zeitpunkt"] },
      { key: "ergebnis", name: "✅ Ergebnis", typ: "choices", choices: Object.values(ERGEBNIS.followup) },
      { key: "verlustgrund", name: "Verloren-Grund", typ: "choices", choices: NQ_GRUENDE },
      { key: "kalender", name: "📅 Kalender (Termin / nächster Versuch)", typ: "datetime" },
      { key: "gelegtAuf", name: "Gelegt auf (Closer/Setter)", typ: "user" },
      { key: "notizen", name: "Notizen", typ: "textarea" },
    ],
  },
];

export const protokollDef = (typ: ProtokollTyp) => PROTOKOLLE.find((p) => p.typ === typ)!;
