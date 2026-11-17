import { test } from "node:test";
import assert from "node:assert/strict";
import { angebotNachfassen, regeln, REGEL_IDS, SPERRE_NICHT_ERREICHT_STUNDEN, type Aktion } from "../regeln";
import { ERGEBNIS, PROTOKOLLE } from "../protokolle";
import { smartViews } from "../smartviews";

const jetzt = new Date("2026-11-18T10:00:00Z");
const morgen = "2026-11-19T14:00:00Z";
const arten = (a: Aktion[]) => a.map((x) => x.art);
const finde = <A extends Aktion["art"]>(a: Aktion[], art: A) => a.find((x) => x.art === art) as Extract<Aktion, { art: A }> | undefined;

test("Erstkontakt: Erstgespräch terminiert → Status, Termin, Setter, Opp Setting", () => {
  const r = regeln("erstkontakt", { ergebnis: ERGEBNIS.erstkontakt.egTerminiert, kalender: morgen }, jetzt, "user_setter");
  assert.equal(r.regel, "erstkontakt.erstgespraech_terminiert");
  assert.deepEqual(finde(r.aktionen, "lead_status"), { art: "lead_status", status: "egTerminiert" });
  assert.equal(finde(r.aktionen, "lead_felder")?.felder.erstgespraechAm, morgen);
  assert.equal(finde(r.aktionen, "lead_felder")?.felder.setter, "user_setter");
  assert.equal(finde(r.aktionen, "lead_felder")?.felder.gesperrtBis, null);
  assert.equal(finde(r.aktionen, "opp")?.ziel, "setting");
});

test("Erstkontakt: nicht erreicht → Kontaktversuch + kurze Sperre", () => {
  const r = regeln("erstkontakt", { erreicht: "Nein / Mailbox", ergebnis: ERGEBNIS.erstkontakt.nichtErreicht }, jetzt);
  assert.equal(r.regel, "erstkontakt.nicht_erreicht");
  const bis = new Date(finde(r.aktionen, "lead_felder")!.felder.gesperrtBis as string).getTime();
  assert.equal(bis - jetzt.getTime(), SPERRE_NICHT_ERREICHT_STUNDEN * 3600_000);
});

test("Erstkontakt: Kein Interesse → verloren, 3 Monate gesperrt, Notiz", () => {
  const r = regeln("erstkontakt", { ergebnis: ERGEBNIS.erstkontakt.keinInteresse }, jetzt);
  assert.deepEqual(arten(r.aktionen), ["opps_verloren", "lead_status", "lead_felder", "notiz"]);
  assert.equal(finde(r.aktionen, "lead_felder")?.felder.gesperrtBis, "2027-02-18T10:00:00.000Z");
});

test("Erstgespräch: Beratung terminiert → Closer + Qualifizierung an den Lead, Opp Closing terminiert", () => {
  const r = regeln("erstgespraech", { ergebnis: ERGEBNIS.erstgespraech.beratungTerminiert, kalender: morgen, closer: "user_closer", kundentyp: "B2B", teamgroesse: "8", rolle: "Vertriebsleiter" }, jetzt, "user_setter");
  const lf = finde(r.aktionen, "lead_felder")!.felder;
  assert.equal(lf.closer, "user_closer");
  assert.equal(lf.setter, "user_setter");
  assert.equal(lf.teamgroesse, 8);
  assert.equal(lf.beratungAm, morgen);
  assert.equal(finde(r.aktionen, "opp")?.ziel, "closingTerminiert");
  assert.equal(finde(r.aktionen, "lead_status")?.status, "beratungTerminiert");
});

test("Erstgespräch: Nicht qualifiziert mit Rückruf-Datum → Sperre bis dahin + Aufgabe, Grund als Verlustgrund", () => {
  const r = regeln("erstgespraech", { ergebnis: ERGEBNIS.erstgespraech.nichtQualifiziert, grund: "Kein Budget", kalender: morgen }, jetzt);
  assert.equal(finde(r.aktionen, "opps_verloren")?.grund, "Kein Budget");
  assert.equal(finde(r.aktionen, "lead_felder")?.felder.gesperrtBis, new Date(morgen).toISOString());
  assert.ok(finde(r.aktionen, "aufgabe"));
});

test("Erstgespräch: No-Show → Opp Setting No-Show + Rückhol-Aufgabe", () => {
  const r = regeln("erstgespraech", { ergebnis: ERGEBNIS.erstgespraech.noShow }, jetzt);
  assert.equal(finde(r.aktionen, "opp")?.ziel, "settingNoShow");
  assert.match(finde(r.aktionen, "aufgabe")!.text, /No-Show/);
});

test("Closing: Gewonnen mit Preis → Kunde, Opp gewonnen mit Wert/Paket/Plätzen, keine Nachtrag-Aufgabe", () => {
  const r = regeln("closing", { ergebnis: ERGEBNIS.closing.gewonnen, preis: "9000", paket: "Team", plaetze: "5", zahlungsart: "Einmalzahlung" }, jetzt);
  const o = finde(r.aktionen, "opp")!;
  assert.equal(o.ziel, "gewonnen");
  assert.equal(o.wert, 9000);
  assert.equal(o.plaetze, 5);
  assert.equal(o.paket, "Team");
  assert.equal(finde(r.aktionen, "lead_status")?.status, "kunde");
  assert.equal(finde(r.aktionen, "aufgabe"), undefined);
});

test("Closing: Gewonnen ohne Preis → Aufgabe Auftragswert nachtragen", () => {
  const r = regeln("closing", { ergebnis: ERGEBNIS.closing.gewonnen }, jetzt);
  assert.match(finde(r.aktionen, "aufgabe")!.text, /Auftragswert/);
});

test("Closing: Angebot → Opp Angebot mit Datum; Nachfass-Regel erzeugt 3 Aufgaben", () => {
  const r = regeln("closing", { ergebnis: ERGEBNIS.closing.angebot, preis: "3000" }, jetzt);
  assert.equal(r.regel, "closing.angebot");
  assert.equal(finde(r.aktionen, "opp")?.angebotAm, jetzt.toISOString());
  assert.equal(angebotNachfassen(jetzt).aktionen.length, 3);
});

test("Closing: Verloren → Verlustgrund übernommen", () => {
  const r = regeln("closing", { ergebnis: ERGEBNIS.closing.verloren, verlustgrund: "Preis" }, jetzt);
  assert.equal(finde(r.aktionen, "opps_verloren")?.grund, "Preis");
  assert.equal(finde(r.aktionen, "lead_status")?.status, "verloren");
});

test("Closing: CC2 / No-Show / Follow-up setzen die passende Stufe", () => {
  assert.equal(finde(regeln("closing", { ergebnis: ERGEBNIS.closing.cc2, kalender: morgen }, jetzt).aktionen, "opp")?.ziel, "cc2");
  assert.equal(finde(regeln("closing", { ergebnis: ERGEBNIS.closing.noShow }, jetzt).aktionen, "opp")?.ziel, "closingNoShow");
  assert.equal(finde(regeln("closing", { ergebnis: ERGEBNIS.closing.followup }, jetzt).aktionen, "opp")?.ziel, "closingFu");
});

test("Follow-up: Beratung terminiert nutzt „Gelegt auf“ als Closer", () => {
  const r = regeln("followup", { ergebnis: ERGEBNIS.followup.beratungTerminiert, gelegtAuf: "user_x", kalender: morgen }, jetzt, "user_setter");
  assert.equal(finde(r.aktionen, "lead_felder")?.felder.closer, "user_x");
});

test("Follow-up: Nicht erreicht → 1 Tag Sperre, sonst nichts", () => {
  const r = regeln("followup", { erreicht: "Nein / Mailbox" }, jetzt);
  assert.deepEqual(arten(r.aktionen), ["lead_felder"]);
});

test("Ohne Ergebnis → keine Aktion", () => {
  for (const t of ["erstkontakt", "erstgespraech", "closing", "followup"] as const) assert.equal(regeln(t, {}, jetzt).aktionen.length, 0);
});

test("Jede Regel-ID aus den Ergebnissen ist in REGEL_IDS dokumentiert", () => {
  for (const p of PROTOKOLLE) {
    const ergebnisFeld = p.felder.find((f) => f.key === "ergebnis")!;
    for (const e of ergebnisFeld.choices!) {
      const r = regeln(p.typ, { ergebnis: e, kalender: morgen, preis: "1" }, jetzt);
      assert.ok(r.aktionen.length > 0, `${p.typ}: „${e}“ ohne Aktion`);
      assert.ok(REGEL_IDS[r.regel], `Regel ${r.regel} fehlt in REGEL_IDS`);
    }
  }
});

test("Smart Views: alle IDs vorhanden → nichts fehlt, Namen eindeutig", () => {
  const ids = {
    leadStatus: { neu: "s1", kontaktversuch: "s2", egTerminiert: "s3", beratungTerminiert: "s4", followup: "s5", angebot: "s6", kunde: "s7", nichtQualifiziert: "s8", verloren: "s9", badData: "s10" },
    oppStatus: { setting: "o1", closingTerminiert: "o2", closingFu: "o3", angebot: "o4", cc2: "o5", settingNoShow: "o6", closingNoShow: "o7", gewonnen: "o8", verloren: "o9" },
    feld: { gesperrtBis: "cf_a", erstgespraechAm: "cf_b", beratungAm: "cf_c" },
  };
  const v = smartViews(ids);
  assert.equal(v[0].fehlt.length, 0);
  assert.equal(new Set(v.map((x) => x.name)).size, v.length);
  assert.ok(smartViews({ leadStatus: {}, oppStatus: {}, feld: {} })[0].fehlt.length > 0);
});
