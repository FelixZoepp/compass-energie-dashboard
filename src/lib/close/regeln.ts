// Protokoll-Regeln (rein, testbar): Protokoll + Feldwerte → Liste interner Close-Aktionen.
// Nach Vorbild Zoepp-Cloud (src/lib/sales/protokolle.ts), angepasst auf den Compass-Ablauf
// Lead → Erstgespräch (Setter) → Beratung/Closing (Closer) → Follow-up/CC2 → Angebot → Gewonnen/Verloren.
// Keine Nachrichten an Leads – nur Lead-Status, Felder, Opportunities, Aufgaben, Notizen.

import type { LeadStatusKey, OppStatusKey } from "./felder";
import { ERGEBNIS, type ProtokollTyp } from "./protokolle";

const STUNDE = 3600_000;
const TAG = 24 * STUNDE;

/** Nach „nicht erreicht“ so lange aus den Anruflisten (Inbound: mehrere Versuche am Tag). */
export const SPERRE_NICHT_ERREICHT_STUNDEN = 2;
/** Verloren / Kein Interesse / Nicht qualifiziert ohne Rückruf-Datum → so viele Monate gesperrt, dann Reaktivierung. */
export const SPERRE_VERLOREN_MONATE = 3;
/** Angebot verschickt → Nachfass-Aufgaben an diesen Tagen. */
export const ANGEBOT_NACHFASSEN_TAGE = [1, 3, 7];

export type LeadFeldKey = "gesperrtBis" | "erstgespraechAm" | "beratungAm" | "setter" | "closer" | "kundentyp" | "teamgroesse" | "rolle";

export type Aktion =
  | { art: "lead_status"; status: LeadStatusKey }
  | { art: "lead_felder"; felder: Partial<Record<LeadFeldKey, string | number | null>> }
  | {
      art: "opp";
      ziel: OppStatusKey;
      /** Ohne aktive Opp eine neue anlegen */
      anlegen: boolean;
      wert?: number | null;
      paket?: string | null;
      plaetze?: number | null;
      zahlungsart?: string | null;
      angebotAm?: string | null;
      abschlussDatum?: string | null;
    }
  | { art: "opps_verloren"; grund?: string | null }
  | { art: "aufgabe"; text: string; datum: string; an: "bearbeiter" | "closer" }
  | { art: "notiz"; text: string };

export interface RegelErgebnis {
  /** Regel-ID für Schalter (settings.data.automatik.regeln[id]) und Log */
  regel: string;
  beschreibung: string;
  aktionen: Aktion[];
}

export type Felder = Record<string, string | null | undefined>;

const plusMonate = (d: Date, n: number) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + n); return x; };
const inZukunft = (iso: string | null | undefined, jetzt: Date) => !!iso && new Date(iso).getTime() > jetzt.getTime();
const iso = (d: Date) => d.toISOString();
const startsWith = (v: string | null | undefined, p: string) => (v ?? "").trim().toLowerCase().startsWith(p.toLowerCase());
const num = (v: string | null | undefined) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const datum = (d: Date) => d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
const uhrzeit = (d: Date) => d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });

const leer = (regel: string, beschreibung = "keine Aktion"): RegelErgebnis => ({ regel, beschreibung, aktionen: [] });

/** Verloren: Opp verloren, Lead „Verloren“, gesperrt bis Kalender (sonst 3 Monate) + Notiz. */
function verloren(regel: string, f: Felder, jetzt: Date, grund: string | null): RegelErgebnis {
  const bis = inZukunft(f.kalender, jetzt) ? new Date(f.kalender!) : plusMonate(jetzt, SPERRE_VERLOREN_MONATE);
  return {
    regel,
    beschreibung: "Verloren → Opp verloren, Lead „Verloren“, Sperre, Notiz",
    aktionen: [
      { art: "opps_verloren", grund },
      { art: "lead_status", status: "verloren" },
      { art: "lead_felder", felder: { gesperrtBis: iso(bis) } },
      { art: "notiz", text: `❌ Verloren${grund ? ` – Grund: ${grund}` : ""}. Ab ${datum(bis)} wieder anrufen (Reaktivierung).` },
    ],
  };
}

function nichtQualifiziert(regel: string, f: Felder, jetzt: Date, grund: string | null): RegelErgebnis {
  const mitRueckruf = inZukunft(f.kalender, jetzt);
  const bis = mitRueckruf ? new Date(f.kalender!) : plusMonate(jetzt, SPERRE_VERLOREN_MONATE);
  return {
    regel,
    beschreibung: "Nicht qualifiziert → Lead „Nicht qualifiziert“, Opps verloren, Sperre" + (mitRueckruf ? " + Rückruf-Aufgabe" : ""),
    aktionen: [
      { art: "lead_status", status: "nichtQualifiziert" },
      { art: "opps_verloren", grund: grund ?? "Kein Bedarf" },
      { art: "lead_felder", felder: { gesperrtBis: iso(bis) } },
      ...(mitRueckruf ? [{ art: "aufgabe" as const, text: `📞 Rückruf ${uhrzeit(bis)} Uhr – damals nicht qualifiziert${grund ? `: ${grund}` : ""}. Prüfen, ob es jetzt passt.`, datum: iso(bis), an: "bearbeiter" as const }] : []),
    ],
  };
}

function erstgespraechTerminiert(regel: string, f: Felder, bearbeiter: string | null): RegelErgebnis {
  return {
    regel,
    beschreibung: "Erstgespräch terminiert → Lead-Status, Termin, Setter, Opp „Setting“, Sperre aufheben",
    aktionen: [
      { art: "lead_status", status: "egTerminiert" },
      { art: "lead_felder", felder: { erstgespraechAm: f.kalender ?? null, gesperrtBis: null, ...(bearbeiter ? { setter: bearbeiter } : {}) } },
      { art: "opp", ziel: "setting", anlegen: true, abschlussDatum: f.kalender ?? null },
    ],
  };
}

function beratungTerminiert(regel: string, f: Felder, closer: string | null, setter: string | null): RegelErgebnis {
  return {
    regel,
    beschreibung: "Beratung terminiert → Lead-Status, Termin, Closer/Setter, Opp „Closing terminiert“, Sperre aufheben",
    aktionen: [
      { art: "lead_status", status: "beratungTerminiert" },
      {
        art: "lead_felder",
        felder: {
          beratungAm: f.kalender ?? null,
          gesperrtBis: null,
          ...(closer ? { closer } : {}),
          ...(setter ? { setter } : {}),
          ...(f.kundentyp ? { kundentyp: f.kundentyp } : {}),
          ...(num(f.teamgroesse) != null ? { teamgroesse: num(f.teamgroesse) } : {}),
          ...(f.rolle ? { rolle: f.rolle } : {}),
        },
      },
      { art: "opp", ziel: "closingTerminiert", anlegen: true, abschlussDatum: f.kalender ?? null },
    ],
  };
}

function gewonnen(regel: string, f: Felder): RegelErgebnis {
  const wert = num(f.preis);
  return {
    regel,
    beschreibung: "Gewonnen → Lead „Kunde“, Opp gewonnen mit Wert/Paket/Plätzen" + (wert == null ? " + Aufgabe Auftragswert nachtragen" : ""),
    aktionen: [
      { art: "lead_status", status: "kunde" },
      { art: "lead_felder", felder: { gesperrtBis: null } },
      { art: "opp", ziel: "gewonnen", anlegen: true, wert, paket: f.paket ?? null, plaetze: num(f.plaetze), zahlungsart: f.zahlungsart ?? null },
      ...(wert == null ? [{ art: "aufgabe" as const, text: "💶 Auftragswert, Paket und Plätze an der gewonnenen Opportunity nachtragen.", datum: "", an: "bearbeiter" as const }] : []),
    ],
  };
}

function rueckrufAufgabe(text: string, f: Felder, jetzt: Date, standardInStunden: number) {
  const d = inZukunft(f.kalender, jetzt) ? new Date(f.kalender!) : new Date(jetzt.getTime() + standardInStunden * STUNDE);
  return { d, aufgabe: { art: "aufgabe" as const, text: `${text}${inZukunft(f.kalender, jetzt) ? ` (${uhrzeit(d)} Uhr)` : ""}`, datum: iso(d), an: "bearbeiter" as const } };
}

/** Auswertung eines Protokolls. `bearbeiter` = Close-User, der das Protokoll angelegt hat. */
export function regeln(typ: ProtokollTyp, f: Felder, jetzt: Date = new Date(), bearbeiter: string | null = null): RegelErgebnis {
  const e = f.ergebnis ?? "";
  switch (typ) {
    case "erstkontakt": {
      const E = ERGEBNIS.erstkontakt;
      if (startsWith(e, E.egTerminiert)) return erstgespraechTerminiert("erstkontakt.erstgespraech_terminiert", f, bearbeiter);
      if (startsWith(e, E.nichtQualifiziert)) return nichtQualifiziert("erstkontakt.nicht_qualifiziert", f, jetzt, null);
      if (startsWith(e, E.keinInteresse)) return verloren("erstkontakt.kein_interesse", f, jetzt, "Kein Bedarf");
      if (startsWith(e, "Bad Data") || startsWith(f.erreicht, "Falsche Nummer"))
        return { regel: "erstkontakt.bad_data", beschreibung: "Bad Data → Lead „Bad Data“, Opps verloren", aktionen: [{ art: "lead_status", status: "badData" }, { art: "opps_verloren", grund: "Nicht erreichbar" }] };
      if (startsWith(e, E.rueckruf)) {
        const { d, aufgabe } = rueckrufAufgabe("📞 Rückruf vereinbart – Erstgespräch terminieren", f, jetzt, 24);
        return { regel: "erstkontakt.rueckruf", beschreibung: "Rückruf → Lead „Kontaktversuch“, Sperre bis Rückruf, Aufgabe", aktionen: [{ art: "lead_status", status: "kontaktversuch" }, { art: "lead_felder", felder: { gesperrtBis: iso(d) } }, aufgabe] };
      }
      if (startsWith(e, E.nichtErreicht) || startsWith(f.erreicht, "Nein")) {
        const bis = inZukunft(f.kalender, jetzt) ? new Date(f.kalender!) : new Date(jetzt.getTime() + SPERRE_NICHT_ERREICHT_STUNDEN * STUNDE);
        return { regel: "erstkontakt.nicht_erreicht", beschreibung: `Nicht erreicht → Lead „Kontaktversuch“, ${SPERRE_NICHT_ERREICHT_STUNDEN} Std. gesperrt`, aktionen: [{ art: "lead_status", status: "kontaktversuch" }, { art: "lead_felder", felder: { gesperrtBis: iso(bis) } }] };
      }
      return leer("erstkontakt.ohne_ergebnis");
    }

    case "erstgespraech": {
      const E = ERGEBNIS.erstgespraech;
      if (startsWith(e, E.beratungTerminiert)) return beratungTerminiert("erstgespraech.beratung_terminiert", f, f.closer ?? null, bearbeiter);
      if (startsWith(e, E.nichtQualifiziert)) return nichtQualifiziert("erstgespraech.nicht_qualifiziert", f, jetzt, f.grund ?? null);
      if (startsWith(e, E.noShow)) {
        const bis = new Date(jetzt.getTime() + SPERRE_NICHT_ERREICHT_STUNDEN * STUNDE);
        return {
          regel: "erstgespraech.no_show",
          beschreibung: "No-Show → Opp „Setting No-Show“, Rückhol-Aufgabe heute",
          aktionen: [
            { art: "opp", ziel: "settingNoShow", anlegen: true },
            { art: "lead_felder", felder: { gesperrtBis: iso(bis) } },
            { art: "aufgabe", text: "❌ No-Show Erstgespräch – anrufen und neu terminieren.", datum: iso(bis), an: "bearbeiter" },
          ],
        };
      }
      if (startsWith(e, E.verschoben)) {
        return { regel: "erstgespraech.verschoben", beschreibung: "Verschoben → neuer Erstgespräch-Termin, Opp „Setting“", aktionen: [{ art: "lead_felder", felder: { erstgespraechAm: f.kalender ?? null } }, { art: "opp", ziel: "setting", anlegen: true, abschlussDatum: f.kalender ?? null }] };
      }
      if (startsWith(e, "Follow-up") || startsWith(e, E.abgesagt)) {
        const abgesagt = startsWith(e, E.abgesagt);
        const { d, aufgabe } = rueckrufAufgabe(abgesagt ? "📞 Erstgespräch abgesagt – anrufen und neu terminieren" : "🔁 Setting-Follow-up", f, jetzt, 24);
        return {
          regel: abgesagt ? "erstgespraech.abgesagt" : "erstgespraech.followup",
          beschreibung: `${abgesagt ? "Abgesagt" : "Follow-up"} → Lead „Follow-up“, Opp „Setting“, Sperre bis Termin, Aufgabe`,
          aktionen: [
            { art: "lead_status", status: "followup" },
            { art: "opp", ziel: "setting", anlegen: true },
            { art: "lead_felder", felder: { gesperrtBis: iso(d), ...(bearbeiter ? { setter: bearbeiter } : {}) } },
            aufgabe,
          ],
        };
      }
      return leer("erstgespraech.ohne_ergebnis");
    }

    case "closing": {
      const E = ERGEBNIS.closing;
      if (startsWith(e, E.gewonnen)) return gewonnen("closing.gewonnen", f);
      if (startsWith(e, E.angebot)) {
        const wert = num(f.preis);
        return {
          regel: "closing.angebot",
          beschreibung: "Angebot verschickt → Lead „Angebot“, Opp „Angebot“ (Wert, Paket, Datum)",
          aktionen: [
            { art: "lead_status", status: "angebot" },
            { art: "opp", ziel: "angebot", anlegen: true, wert, paket: f.paket ?? null, plaetze: num(f.plaetze), zahlungsart: f.zahlungsart ?? null, angebotAm: iso(jetzt), abschlussDatum: f.kalender ?? null },
          ],
        };
      }
      if (startsWith(e, E.followup)) {
        const { d, aufgabe } = rueckrufAufgabe("🔁 Closing-Follow-up", f, jetzt, 48);
        return {
          regel: "closing.followup",
          beschreibung: "Follow-up → Lead „Follow-up“, Opp „Closing FU“, Sperre bis Termin, Aufgabe",
          aktionen: [{ art: "lead_status", status: "followup" }, { art: "opp", ziel: "closingFu", anlegen: true, abschlussDatum: iso(d) }, { art: "lead_felder", felder: { gesperrtBis: iso(d) } }, aufgabe],
        };
      }
      if (startsWith(e, E.cc2)) {
        return { regel: "closing.cc2", beschreibung: "CC2 → Opp „CC2“, Beratung-am = CC2-Termin", aktionen: [{ art: "opp", ziel: "cc2", anlegen: true, abschlussDatum: f.kalender ?? null }, { art: "lead_felder", felder: { beratungAm: f.kalender ?? null, gesperrtBis: null } }] };
      }
      if (startsWith(e, E.verloren)) return verloren("closing.verloren", f, jetzt, f.verlustgrund ?? null);
      if (startsWith(e, E.noShow)) {
        return {
          regel: "closing.no_show",
          beschreibung: "No-Show → Opp „Closing No-Show“, Rückhol-Aufgabe heute",
          aktionen: [{ art: "opp", ziel: "closingNoShow", anlegen: true }, { art: "aufgabe", text: "❌ No-Show Beratungsgespräch – anrufen und neu terminieren.", datum: iso(jetzt), an: "bearbeiter" }],
        };
      }
      if (startsWith(e, E.verschoben)) {
        return { regel: "closing.verschoben", beschreibung: "Verschoben → Opp „Closing terminiert“, neuer Termin", aktionen: [{ art: "opp", ziel: "closingTerminiert", anlegen: true, abschlussDatum: f.kalender ?? null }, { art: "lead_felder", felder: { beratungAm: f.kalender ?? null } }] };
      }
      if (startsWith(e, E.abgesagt)) {
        const { d, aufgabe } = rueckrufAufgabe("📞 Beratung abgesagt – anrufen und neuen Termin legen", f, jetzt, 0);
        return { regel: "closing.abgesagt", beschreibung: "Abgesagt → Rückruf-Aufgabe, Sperre bis Termin", aktionen: [...(inZukunft(f.kalender, jetzt) ? [{ art: "lead_felder" as const, felder: { gesperrtBis: iso(d) } }] : []), aufgabe] };
      }
      if (startsWith(e, E.nichtQualifiziert)) return nichtQualifiziert("closing.nicht_qualifiziert", f, jetzt, null);
      return leer("closing.ohne_ergebnis");
    }

    case "followup": {
      const E = ERGEBNIS.followup;
      if (startsWith(e, E.gewonnen)) return gewonnen("followup.gewonnen", f);
      if (startsWith(e, E.egTerminiert)) return erstgespraechTerminiert("followup.erstgespraech_terminiert", f, f.gelegtAuf ?? bearbeiter);
      if (startsWith(e, E.beratungTerminiert)) return beratungTerminiert("followup.beratung_terminiert", f, f.gelegtAuf ?? null, null);
      if (startsWith(e, E.verloren)) return verloren("followup.verloren", f, jetzt, f.verlustgrund ?? null);
      if (startsWith(e, E.nichtErreicht) || startsWith(f.erreicht, "Nein")) {
        const bis = inZukunft(f.kalender, jetzt) ? new Date(f.kalender!) : new Date(jetzt.getTime() + TAG);
        return { regel: "followup.nicht_erreicht", beschreibung: "Nicht erreicht → 1 Tag (oder bis Kalender) gesperrt", aktionen: [{ art: "lead_felder", felder: { gesperrtBis: iso(bis) } }] };
      }
      if (startsWith(e, E.weiter)) {
        const { d, aufgabe } = rueckrufAufgabe("🔁 Follow-up", f, jetzt, 48);
        return { regel: "followup.weiter", beschreibung: "Weiter Follow-up → Sperre bis Termin, Aufgabe", aktionen: [{ art: "lead_felder", felder: { gesperrtBis: iso(d) } }, aufgabe] };
      }
      return leer("followup.ohne_ergebnis");
    }
  }
}

/** Angebot verschickt → zusätzliche Nachfass-Aufgaben (eigene Regel, einzeln schaltbar). */
export function angebotNachfassen(jetzt: Date = new Date()): RegelErgebnis {
  return {
    regel: "closing.angebot_nachfassen",
    beschreibung: `Angebot → Nachfass-Aufgaben Tag ${ANGEBOT_NACHFASSEN_TAGE.join("/")}`,
    aktionen: ANGEBOT_NACHFASSEN_TAGE.map((t) => ({ art: "aufgabe" as const, text: `💶 Angebot nachfassen (Tag ${t})`, datum: iso(new Date(jetzt.getTime() + t * TAG)), an: "bearbeiter" as const })),
  };
}

/** Alle Regel-IDs mit Beschreibung (für Einstellungen/README). */
export const REGEL_IDS: Record<string, string> = {
  "erstkontakt.erstgespraech_terminiert": "Erstkontakt: Erstgespräch terminiert",
  "erstkontakt.rueckruf": "Erstkontakt: Rückruf vereinbart",
  "erstkontakt.nicht_erreicht": "Erstkontakt: Nicht erreicht",
  "erstkontakt.kein_interesse": "Erstkontakt: Kein Interesse",
  "erstkontakt.nicht_qualifiziert": "Erstkontakt: Nicht qualifiziert",
  "erstkontakt.bad_data": "Erstkontakt: Bad Data",
  "erstgespraech.beratung_terminiert": "Erstgespräch: Beratung terminiert",
  "erstgespraech.followup": "Erstgespräch: Follow-up",
  "erstgespraech.nicht_qualifiziert": "Erstgespräch: Nicht qualifiziert",
  "erstgespraech.no_show": "Erstgespräch: No-Show",
  "erstgespraech.verschoben": "Erstgespräch: Verschoben",
  "erstgespraech.abgesagt": "Erstgespräch: Abgesagt",
  "closing.gewonnen": "Closing: Gewonnen",
  "closing.angebot": "Closing: Angebot verschickt",
  "closing.angebot_nachfassen": "Closing: Angebot nachfassen (Aufgaben Tag 1/3/7)",
  "closing.followup": "Closing: Follow-up",
  "closing.cc2": "Closing: CC2 terminiert",
  "closing.verloren": "Closing: Verloren",
  "closing.no_show": "Closing: No-Show",
  "closing.verschoben": "Closing: Verschoben",
  "closing.abgesagt": "Closing: Abgesagt",
  "closing.nicht_qualifiziert": "Closing: Nicht qualifiziert",
  "followup.erstgespraech_terminiert": "Follow-up: Erstgespräch terminiert",
  "followup.beratung_terminiert": "Follow-up: Beratung terminiert",
  "followup.gewonnen": "Follow-up: Gewonnen",
  "followup.weiter": "Follow-up: Weiter Follow-up",
  "followup.verloren": "Follow-up: Verloren",
  "followup.nicht_erreicht": "Follow-up: Nicht erreicht",
};
