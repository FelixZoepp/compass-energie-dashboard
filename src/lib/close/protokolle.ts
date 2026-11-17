// Gesprächsprotokolle (Close Custom Activities) für Compass – nach Vorbild der Zoepp-Cloud.
// Rein deklarativ (keine Server-Abhängigkeiten): wird von scripts/close-setup.ts angelegt,
// von der Automatik (automatik.ts) über die Namen aufgelöst und von regeln.ts ausgewertet.

export type ProtokollTyp = "erstkontakt" | "erstgespraech" | "closing" | "followup";

export type FeldTyp = "text" | "textarea" | "number" | "date" | "datetime" | "choices" | "user";

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

export const VERLUSTGRUENDE = ["Preis", "Kein Bedarf", "Zeitpunkt", "Konkurrenz", "Nicht erreichbar", "Entscheider fehlt", "Sonstiges"];

export const NQ_GRUENDE = [
  "Kein Vertriebsteam / zu klein",
  "Kein Budget",
  "Entscheider fehlt",
  "Kein zeitnaher Start",
  "Passt nicht (Branche/Modell)",
  "Respektlos / unseriös",
];

export const ERGEBNIS = {
  erstkontakt: {
    egTerminiert: "Erstgespräch terminiert",
    rueckruf: "Rückruf vereinbart",
    nichtErreicht: "Nicht erreicht",
    keinInteresse: "Kein Interesse",
    nichtQualifiziert: "Nicht qualifiziert",
    badData: "Bad Data (falsche Nummer/Spam)",
  },
  erstgespraech: {
    beratungTerminiert: "Beratung terminiert",
    followup: "Follow-up / Rückruf",
    nichtQualifiziert: "Nicht qualifiziert",
    noShow: "No-Show",
    verschoben: "Verschoben",
    abgesagt: "Abgesagt",
  },
  closing: {
    gewonnen: "Gewonnen",
    angebot: "Angebot verschickt",
    followup: "Follow-up",
    cc2: "CC2 terminiert",
    verloren: "Verloren",
    noShow: "No-Show",
    verschoben: "Verschoben",
    abgesagt: "Abgesagt",
    nichtQualifiziert: "Nicht qualifiziert",
  },
  followup: {
    egTerminiert: "Erstgespräch terminiert",
    beratungTerminiert: "Beratung terminiert",
    gewonnen: "Gewonnen",
    weiter: "Weiter Follow-up",
    verloren: "Verloren",
    nichtErreicht: "Nicht erreicht",
  },
} as const;

export const PROTOKOLLE: ProtokollDef[] = [
  {
    typ: "erstkontakt",
    name: "1 - Erstkontakt (Terminierung)",
    beschreibung: "Jeder Anrufversuch bei einem neuen Inbound-Lead. Ziel: Erstgespräch terminieren.",
    felder: [
      { key: "erreicht", name: "📞 Erreicht?", typ: "choices", choices: ["Ja", "Nein / Mailbox", "Falsche Nummer"] },
      { key: "ergebnis", name: "✅ Ergebnis", typ: "choices", choices: Object.values(ERGEBNIS.erstkontakt) },
      { key: "einwand", name: "Einwand", typ: "choices", choices: ["Keine Zeit", "Kein Bedarf", "Schon Anbieter", "Zu teuer", "Nur Infos gewollt", "Sonstiges"] },
      { key: "kalender", name: "📅 Kalender (Erstgespräch / Rückruf)", typ: "datetime" },
      { key: "notizen", name: "Notizen", typ: "textarea" },
    ],
  },
  {
    typ: "erstgespraech",
    name: "2 - Erstgespräch (Setting)",
    beschreibung: "Qualifizierung durch den Setter (Telefon). Ziel: Beratungsgespräch mit dem Closer legen.",
    felder: [
      { key: "kundentyp", name: "Kundentyp", typ: "choices", choices: ["B2B", "B2C"] },
      { key: "rolle", name: "Rolle", typ: "choices", choices: ["Geschäftsführer/Inhaber", "Vertriebsleiter", "Teamleiter", "Selbstständiger Vertriebler", "Sonstiges"] },
      { key: "branche", name: "Branche / Produkt", typ: "text" },
      { key: "teamgroesse", name: "Teamgröße (Vertriebler)", typ: "number" },
      { key: "schmerz", name: "Größter Engpass im Vertrieb", typ: "textarea" },
      { key: "ziel", name: "Ziel in 12 Monaten", typ: "text" },
      { key: "gs1Bedarf", name: "GS 1 · Bedarf bestätigt", typ: "choices", choices: JA_NEIN },
      { key: "gs2Budget", name: "GS 2 · Budget vorhanden", typ: "choices", choices: ["Ja", "Nein", "Unklar"] },
      { key: "gs3Entscheider", name: "GS 3 · Entscheider", typ: "choices", choices: ["Allein", "Weitere kommen mit", "Weitere entscheiden mit, kommen nicht"] },
      { key: "gs4Start", name: "GS 4 · Möglicher Start", typ: "date" },
      { key: "ergebnis", name: "✅ Ergebnis", typ: "choices", choices: Object.values(ERGEBNIS.erstgespraech) },
      { key: "grund", name: "Grund (bei Nicht qualifiziert)", typ: "choices", choices: NQ_GRUENDE },
      { key: "kalender", name: "📅 Kalender (Beratung / Rückruf)", typ: "datetime" },
      { key: "closer", name: "Closer", typ: "user" },
      { key: "notizen", name: "Notizen für den Closer", typ: "textarea" },
    ],
  },
  {
    typ: "closing",
    name: "3 - Beratungsgespräch (Closing)",
    beschreibung: "Beratungs-/Verkaufsgespräch durch den Closer (Video). Auch für CC2 verwenden.",
    felder: [
      { key: "entscheiderDabei", name: "Entscheider dabei?", typ: "choices", choices: JA_NEIN },
      { key: "einwand", name: "Haupteinwand", typ: "choices", choices: ["Preis", "Zeitpunkt", "Entscheider", "Vertrauen / Garantie", "Vergleicht Anbieter", "Kein Einwand", "Sonstiges"] },
      { key: "ergebnis", name: "✅ Nächster Schritt", typ: "choices", choices: Object.values(ERGEBNIS.closing) },
      { key: "paket", name: "Paket", typ: "choices", choices: ["Einzelplatz", "Team", "Inhouse"] },
      { key: "plaetze", name: "Plätze", typ: "number" },
      { key: "preis", name: "Preis netto (€)", typ: "number" },
      { key: "zahlungsart", name: "Zahlungsart", typ: "choices", choices: ["Einmalzahlung", "Ratenzahlung 3x", "Ratenzahlung 6x", "Ratenzahlung 12x", "Finanzierung"] },
      { key: "verlustgrund", name: "Verlustgrund", typ: "choices", choices: VERLUSTGRUENDE },
      { key: "kalender", name: "📅 Kalender (CC2 / Follow-up / neuer Termin)", typ: "datetime" },
      { key: "notizen", name: "Notizen", typ: "textarea" },
    ],
  },
  {
    typ: "followup",
    name: "4 - Follow-up",
    beschreibung: "Nachfassen: Setting-Follow-up, Closing-Follow-up, No-Show-Rückholung, Angebot nachfassen.",
    felder: [
      { key: "art", name: "Art", typ: "choices", choices: ["Setting-Follow-up", "Closing-Follow-up", "No-Show-Rückholung", "Angebot nachfassen"] },
      { key: "erreicht", name: "📞 Erreicht?", typ: "choices", choices: ["Ja", "Nein / Mailbox"] },
      { key: "offenerPunkt", name: "Offener Punkt / Einwand", typ: "choices", choices: ["Budget", "Entscheider", "Zeitpunkt", "Vertrauen / Garantie", "Vergleicht Anbieter", "Kein Bedarf mehr", "Sonstiges"] },
      { key: "ergebnis", name: "✅ Ergebnis", typ: "choices", choices: Object.values(ERGEBNIS.followup) },
      { key: "verlustgrund", name: "Verlustgrund", typ: "choices", choices: VERLUSTGRUENDE },
      { key: "kalender", name: "📅 Kalender (Termin / nächster Versuch)", typ: "datetime" },
      { key: "gelegtAuf", name: "Gelegt auf (Setter/Closer)", typ: "user" },
      { key: "notizen", name: "Notizen", typ: "textarea" },
    ],
  },
];

export const protokollDef = (typ: ProtokollTyp) => PROTOKOLLE.find((p) => p.typ === typ)!;
