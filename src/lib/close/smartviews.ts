// Smart Views (Close „saved_search“, Tabs) für Compass – Nummerierung nach Zoepp-Muster:
// 0.x Kontrolle · 1.x Setting (Setter) · 2.x Closing (Closer) · 3.x Bestand/Reaktivierung.
// Rein (keine Server-Abhängigkeiten); IDs werden vom Setup-Skript aufgelöst und übergeben.
// Hinweis aus Erfahrung: Textfilter auf Custom Fields nur mit mode "beginning_of_words" (phrase liefert 0 Treffer).

import type { LeadStatusKey, OppStatusKey } from "./felder";

type Q = Record<string, unknown>;

export interface SmartViewIds {
  leadStatus: Partial<Record<LeadStatusKey, string>>;
  oppStatus: Partial<Record<OppStatusKey, string>>;
  feld: { gesperrtBis?: string; erstgespraechAm?: string; beratungAm?: string };
}

export interface SmartViewDef { name: string; s_query: Q; fehlt: string[] }

const and = (...queries: Q[]): Q => ({ negate: false, queries, type: "and" });
const or = (...queries: Q[]): Q => ({ negate: false, queries, type: "or" });
const cf = (id: string, condition: Q, negate = false): Q => ({ condition, field: { custom_field_id: id, type: "custom_field" }, negate, type: "field_condition" });
const feld = (objectType: string, name: string, condition: Q, negate = false): Q => ({ condition, field: { field_name: name, object_type: objectType, type: "regular_field" }, negate, type: "field_condition" });
const heute: Q = {
  before: { range: "today", type: "start_end_of_predefined_relative_period", which: "end" },
  on_or_after: { range: "today", type: "start_end_of_predefined_relative_period", which: "start" },
  type: "moment_range",
};
const bisJetzt: Q = { before: { type: "now" }, on_or_after: null, type: "moment_range" };
const offset = (tage: number, stunden = 0) => ({ days: tage, hours: stunden, minutes: 0, months: 0, seconds: 0, weeks: 0, years: 0 });
const aelterAlsTage = (tage: number): Q => ({
  before: { direction: "past", moment: { type: "now" }, offset: offset(tage), type: "offset", which_day_end: "start" },
  on_or_after: null,
  type: "moment_range",
});
const letzteTage = (tage: number): Q => ({
  before: { type: "now" },
  on_or_after: { direction: "past", moment: { type: "now" }, offset: offset(tage), type: "offset", which_day_end: "start" },
  type: "moment_range",
});
const zahl = (r: { gte?: number; lte?: number; gt?: number }): Q => ({ type: "number_range", ...r });
const sQuery = (filter: Q, sort: Q[] = []) => ({ query: and({ negate: false, object_type: "lead", type: "object_type" }, filter), results_limit: null, sort });
const sortierung = (name: string, richtung: "asc" | "desc", objectType = "lead"): Q => ({ direction: richtung, field: { field_name: name, object_type: objectType, type: "regular_field" } });

/** Baut alle Views. Fehlende IDs → View wird mit `fehlt` markiert und vom Setup übersprungen. */
export function smartViews(ids: SmartViewIds): SmartViewDef[] {
  const fehlt: string[] = [];
  const lsCond = (negate: boolean, keys: LeadStatusKey[]) => {
    const vals = keys.map((k) => ids.leadStatus[k] ?? (fehlt.push(`Lead-Status ${k}`), ""));
    return feld("lead", "status_id", { object_ids: vals, reference_type: "status.lead", type: "reference" }, negate);
  };
  const ls = (...keys: LeadStatusKey[]) => lsCond(false, keys);
  const lsNicht = (...keys: LeadStatusKey[]) => lsCond(true, keys);
  const deal = (keys: OppStatusKey[], ...extra: Q[]): Q => ({
    negate: false,
    related_object_type: "opportunity",
    related_query: and(feld("opportunity", "status_id", { object_ids: keys.map((k) => ids.oppStatus[k] ?? (fehlt.push(`Opp-Status ${k}`), "")), reference_type: "status.opportunity", type: "reference" }), ...extra),
    this_object_type: "lead",
    type: "has_related",
  });
  const f = (key: keyof SmartViewIds["feld"]) => ids.feld[key] ?? (fehlt.push(`Lead-Feld ${key}`), "");
  const nichtGesperrt = () => or(cf(f("gesperrtBis"), bisJetzt), cf(f("gesperrtBis"), { type: "exists" }, true));
  const abgeschlossen = (): LeadStatusKey[] => ["kunde", "exKunde", "verloren", "nichtQualifiziert", "badData"];
  const hatTelefon = feld("lead", "num_phone_numbers", zahl({ gt: 0 }));

  const views: Array<{ name: string; s_query: Q }> = [
    {
      name: "💤 0.9 Offene Deals ohne Bewegung > 7 Tage",
      s_query: sQuery(deal(["setting", "settingFu", "closingTerminiert", "closingFu", "angebot", "cc2", "settingNoShow", "closingNoShow"], feld("opportunity", "date_updated", aelterAlsTage(7))), [sortierung("date_updated", "asc")]),
    },
    {
      name: "🔥 1.0 Neue Inbound-Leads – sofort anrufen",
      s_query: sQuery(and(lsNicht(...abgeschlossen()), hatTelefon, feld("lead", "num_outgoing_calls", zahl({ gte: 0, lte: 0 })), feld("lead", "date_created", letzteTage(14))), [sortierung("date_created", "desc")]),
    },
    {
      name: "📞 1.1 Kontaktversuche offen (noch kein Termin)",
      s_query: sQuery(and(ls("neu", "kontaktversuch"), feld("lead", "num_outgoing_calls", zahl({ gte: 1 })), nichtGesperrt()), [sortierung("date_updated", "asc")]),
    },
    { name: "📅 1.2 Erstgespräche heute", s_query: sQuery(cf(f("erstgespraechAm"), heute), [sortierung("date_updated", "asc")]) },
    { name: "❌ 1.3 No-Show Erstgespräch zurückholen", s_query: sQuery(and(deal(["settingNoShow"]), nichtGesperrt()), [sortierung("date_updated", "asc")]) },
    { name: "🔁 1.4 Setting-Follow-ups fällig", s_query: sQuery(and(deal(["settingFu"]), nichtGesperrt()), [sortierung("date_updated", "asc")]) },
    { name: "📅 2.0 Beratungen heute", s_query: sQuery(cf(f("beratungAm"), heute), [sortierung("date_updated", "asc")]) },
    { name: "🔁 2.1 Closing-Follow-ups fällig", s_query: sQuery(and(deal(["closingFu"]), nichtGesperrt()), [sortierung("date_updated", "asc")]) },
    { name: "💶 2.2 Offene Angebote > 3 Tage", s_query: sQuery(deal(["angebot"], feld("opportunity", "date_updated", aelterAlsTage(3))), [sortierung("date_updated", "asc")]) },
    { name: "❌ 2.3 No-Show Beratung zurückholen", s_query: sQuery(and(deal(["closingNoShow"]), nichtGesperrt()), [sortierung("date_updated", "asc")]) },
    { name: "🤝 2.4 CC2 / zweites Closing", s_query: sQuery(deal(["cc2"]), [sortierung("date_updated", "asc")]) },
    { name: "🏆 3.0 Kunden", s_query: sQuery(ls("kunde"), [sortierung("date_updated", "desc")]) },
    { name: "🧊 3.1 Verloren – Reaktivierung fällig", s_query: sQuery(and(ls("verloren"), cf(f("gesperrtBis"), bisJetzt)), [sortierung("date_updated", "asc")]) },
    { name: "🚫 3.2 Nicht qualifiziert", s_query: sQuery(ls("nichtQualifiziert"), [sortierung("date_updated", "desc")]) },
  ];

  // Fehlende IDs gelten für den ganzen Satz (Setup legt Status/Felder vorher an)
  return views.map((v) => ({ ...v, fehlt: [...new Set(fehlt)] }));
}
