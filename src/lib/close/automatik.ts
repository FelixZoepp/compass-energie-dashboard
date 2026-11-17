import "server-only";
// Protokoll-Automatik: Close-Webhook activity.custom_activity → Regeln (regeln.ts) → interne Close-Änderungen.
// Standardmäßig AUS (settings.data.automatik.aktiv). Dann wird nur protokolliert, was passieren würde (trocken).
// Keine Nachrichten an Leads.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { adminClient } from "../supabase/admin";
import { CloseClient } from "./client";
import { LEAD_FELDER, LEAD_STATUS, OPP_FELDER, OPP_STATUS, PIPELINE_NAME, type LeadStatusKey, type OppStatusKey } from "./felder";
import { PROTOKOLLE, type ProtokollTyp } from "./protokolle";
import { angebotNachfassen, regeln, type Aktion, type LeadFeldKey, type RegelErgebnis } from "./regeln";

export interface AutomatikEinstellung { aktiv: boolean; regeln: Record<string, boolean> }

export async function automatikEinstellung(): Promise<AutomatikEinstellung> {
  const { data } = await adminClient().from("settings").select("data").eq("id", 1).maybeSingle();
  const a = (data?.data as any)?.automatik ?? {};
  return { aktiv: a.aktiv === true, regeln: a.regeln ?? {} };
}

// Schalter je Regel-ID oder je Gruppe (z. B. "closing" schaltet alle closing.*-Regeln)
const regelAn = (e: AutomatikEinstellung, id: string) => e.aktiv && e.regeln[id] !== false && e.regeln[id.split(".")[0]] !== false;

// ---------------------------------------------------------------------------
// IDs über Namen auflösen (10 Min. Cache)

interface Kontext {
  typByActType: Map<string, ProtokollTyp>;
  feldKeyById: Map<string, { typ: ProtokollTyp; key: string }>;
  leadStatus: Partial<Record<LeadStatusKey, string>>;
  leadStatusLabelById: Map<string, string>;
  oppStatus: Partial<Record<OppStatusKey, string>>;
  pipelineStatusIds: Set<string>;
  leadFeld: Partial<Record<LeadFeldKey, string>>;
  oppFeld: Record<string, string | undefined>;
}

let ctxCache: { at: number; ctx: Kontext } | null = null;

export async function kontext(cl: CloseClient): Promise<Kontext> {
  if (ctxCache && Date.now() - ctxCache.at < 10 * 60000) return ctxCache.ctx;
  const [typen, aktFelder, leadStatus, pipelines, leadCf, oppCf] = await Promise.all([
    cl.alle("custom_activity/"), cl.alle("custom_field/activity/"), cl.alle("status/lead/"), cl.alle("pipeline/"),
    cl.alle("custom_field/lead/"), cl.alle("custom_field/opportunity/"),
  ]);
  const lc = (s: string) => s.trim().toLowerCase();
  const typByActType = new Map<string, ProtokollTyp>();
  const feldKeyById = new Map<string, { typ: ProtokollTyp; key: string }>();
  for (const p of PROTOKOLLE) {
    const t = typen.find((x: any) => lc(x.name) === lc(p.name));
    if (!t) continue;
    typByActType.set(t.id, p.typ);
    for (const f of aktFelder.filter((x: any) => x.custom_activity_type_id === t.id)) {
      const def = p.felder.find((d) => lc(d.name) === lc(f.name));
      if (def) feldKeyById.set(f.id, { typ: p.typ, key: def.key });
    }
  }
  const pipe = pipelines.find((p: any) => p.name === PIPELINE_NAME);
  const oppStatus: Partial<Record<OppStatusKey, string>> = {};
  for (const [k, label] of Object.entries(OPP_STATUS)) {
    const s = (pipe?.statuses ?? []).find((x: any) => lc(x.label) === lc(label));
    if (s) oppStatus[k as OppStatusKey] = s.id;
  }
  const leadStatusIds: Partial<Record<LeadStatusKey, string>> = {};
  for (const [k, label] of Object.entries(LEAD_STATUS)) {
    const s = leadStatus.find((x: any) => lc(x.label) === lc(label));
    if (s) leadStatusIds[k as LeadStatusKey] = s.id;
  }
  const feldId = (liste: any[], name: string) => liste.find((f) => lc(f.name) === lc(name))?.id as string | undefined;
  const ctx: Kontext = {
    typByActType, feldKeyById, leadStatus: leadStatusIds,
    leadStatusLabelById: new Map(leadStatus.map((s: any) => [s.id, s.label])),
    oppStatus, pipelineStatusIds: new Set((pipe?.statuses ?? []).map((s: any) => s.id)),
    leadFeld: {
      gesperrtBis: feldId(leadCf, LEAD_FELDER.gesperrtBis.name), erstgespraechAm: feldId(leadCf, LEAD_FELDER.erstgespraechAm.name),
      beratungAm: feldId(leadCf, LEAD_FELDER.beratungAm.name), setter: feldId(leadCf, LEAD_FELDER.setter.name), closer: feldId(leadCf, LEAD_FELDER.closer.name),
      kundentyp: feldId(leadCf, LEAD_FELDER.kundentyp.name), teamgroesse: feldId(leadCf, LEAD_FELDER.teamgroesse.name), rolle: feldId(leadCf, LEAD_FELDER.rolle.name),
    },
    oppFeld: Object.fromEntries(Object.entries(OPP_FELDER).map(([k, d]) => [k, feldId(oppCf, d.name)])),
  };
  ctxCache = { at: Date.now(), ctx };
  return ctx;
}

// ---------------------------------------------------------------------------
// Ausführen

const berlinDatum = (iso: string) => new Date(iso || Date.now()).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

async function aktiveOpps(cl: CloseClient, ctx: Kontext, leadId: string) {
  const { data } = await cl.get(`opportunity/?lead_id=${leadId}&status_type=active&_fields=id,status_id,date_created,value`);
  // Close ignoriert einen pipeline-Filter → über die Status-IDs der Pipeline filtern
  return (data as any[]).filter((o) => ctx.pipelineStatusIds.has(o.status_id)).sort((a, b) => b.date_created.localeCompare(a.date_created));
}

export async function fuehreAus(cl: CloseClient, ctx: Kontext, leadId: string, aktionen: Aktion[], bearbeiter: string | null): Promise<string[]> {
  const log: string[] = [];
  const lead = await cl.get(`lead/${leadId}/?_fields=id,status_id,status_label`);
  const istKunde = (lead.status_label ?? "").trim().toLowerCase() === LEAD_STATUS.kunde.toLowerCase();
  let oppHatWert = false;
  /** Nach Gewonnen/Verloren: offene „Angebot nachfassen“-Aufgaben erledigen */
  const nachfassenErledigen = async () => {
    const offen = await cl.get(`task/?lead_id=${leadId}&is_complete=false&_fields=id,text`);
    for (const t of (offen.data ?? []).filter((x: any) => (x.text ?? "").startsWith("💶 Angebot nachfassen"))) {
      await cl.put(`task/${t.id}/`, { is_complete: true });
      log.push(`Aufgabe erledigt: ${t.text}`);
    }
  };

  for (const a of aktionen) {
    switch (a.art) {
      case "lead_status": {
        if (istKunde && a.status !== "kunde") { log.push(`Lead-Status bleibt „Kunde“ (statt ${LEAD_STATUS[a.status]})`); break; }
        const id = ctx.leadStatus[a.status];
        if (!id) { log.push(`! Lead-Status „${LEAD_STATUS[a.status]}“ fehlt in Close`); break; }
        if (lead.status_id !== id) await cl.put(`lead/${leadId}/`, { status_id: id });
        log.push(`Lead-Status → ${LEAD_STATUS[a.status]}`);
        break;
      }
      case "lead_felder": {
        const body: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(a.felder)) {
          const id = ctx.leadFeld[k as LeadFeldKey];
          if (id) body[`custom.${id}`] = v;
        }
        if (Object.keys(body).length) { await cl.put(`lead/${leadId}/`, body); log.push(`Lead-Felder: ${Object.keys(a.felder).join(", ")}`); }
        break;
      }
      case "opp": {
        const ziel = ctx.oppStatus[a.ziel];
        if (!ziel) { log.push(`! Opp-Status „${OPP_STATUS[a.ziel]}“ fehlt in Close`); break; }
        const body: Record<string, unknown> = { status_id: ziel };
        if (a.wert != null) { body.value = Math.round(a.wert * 100); body.value_period = "one_time"; }
        if (a.abschlussDatum) body.date_won = berlinDatum(a.abschlussDatum); // Close: date_won = (erwartetes) Abschlussdatum
        const f = ctx.oppFeld;
        if (a.paket && f.paket) body[`custom.${f.paket}`] = a.paket;
        if (a.plaetze != null && f.plaetze) body[`custom.${f.plaetze}`] = a.plaetze;
        if (a.zahlungsart && f.zahlungsart) body[`custom.${f.zahlungsart}`] = a.zahlungsart;
        if (a.angebotAm && f.angebotAm) body[`custom.${f.angebotAm}`] = berlinDatum(a.angebotAm);
        const aktiv = await aktiveOpps(cl, ctx, leadId);
        if (aktiv[0]) {
          oppHatWert = Number(aktiv[0].value) > 0;
          await cl.put(`opportunity/${aktiv[0].id}/`, body);
          log.push(`Opp ${aktiv[0].id} → ${OPP_STATUS[a.ziel]}${aktiv.length > 1 ? ` (${aktiv.length - 1} weitere aktive Opp(s) unverändert)` : ""}`);
        } else if (a.anlegen) {
          const neu = await cl.post("opportunity/", { lead_id: leadId, ...body, ...(bearbeiter ? { user_id: bearbeiter } : {}), note: "Angelegt durch Protokoll-Automatik" });
          log.push(`Opp angelegt ${neu.id} (${OPP_STATUS[a.ziel]})`);
        }
        if (a.ziel === "gewonnen") await nachfassenErledigen();
        break;
      }
      case "opps_verloren": {
        const ziel = ctx.oppStatus.verloren;
        if (!ziel) { log.push("! Opp-Status „Verloren“ fehlt"); break; }
        for (const o of await aktiveOpps(cl, ctx, leadId)) {
          const body: Record<string, unknown> = { status_id: ziel };
          if (a.grund && ctx.oppFeld.verlustgrund) body[`custom.${ctx.oppFeld.verlustgrund}`] = a.grund;
          await cl.put(`opportunity/${o.id}/`, body);
          log.push(`Opp ${o.id} → Verloren${a.grund ? ` (${a.grund})` : ""}`);
        }
        await nachfassenErledigen();
        break;
      }
      case "aufgabe": {
        if (oppHatWert && a.text.startsWith("💶 Auftragswert")) { log.push("Auftragswert schon an der Opp – keine Aufgabe"); break; }
        const offen = await cl.get(`task/?lead_id=${leadId}&is_complete=false&_fields=text`);
        if ((offen.data ?? []).some((t: any) => t.text === a.text)) { log.push(`Aufgabe existiert schon: ${a.text}`); break; }
        await cl.post("task/", { lead_id: leadId, text: a.text, date: berlinDatum(a.datum), ...(bearbeiter ? { assigned_to: bearbeiter } : {}) });
        log.push(`Aufgabe: ${a.text} (${berlinDatum(a.datum)})`);
        break;
      }
      case "notiz": {
        await cl.post("activity/note/", { lead_id: leadId, note: a.text });
        log.push("Notiz angelegt");
        break;
      }
    }
  }
  return log;
}

// ---------------------------------------------------------------------------
// Einstieg aus dem Webhook

/** Feldwerte einer Close-Custom-Activity → { key: Wert } laut Protokoll-Definition. */
export function felderAus(ctx: Kontext, a: Record<string, any>): Record<string, string | null> {
  const felder: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(a)) {
    if (!k.startsWith("custom.")) continue;
    const m = ctx.feldKeyById.get(k.slice(7));
    if (!m) continue;
    felder[m.key] = v == null ? null : Array.isArray(v) ? v.join(", ") : String(v);
  }
  return felder;
}

const SCHLUESSEL = ["ergebnis", "erreicht", "kalender", "preis", "paket", "plaetze", "closer", "gelegtAuf", "verlustgrund", "grund"];

export async function verarbeiteProtokoll(activityId: string, jetzt: Date = new Date()): Promise<string> {
  const cl = new CloseClient();
  const sb = adminClient();
  const a = await cl.get(`activity/custom/${activityId}/`);
  if (a.status && a.status !== "published") return `Protokoll ${activityId} ist Entwurf – übersprungen`;
  const ctx = await kontext(cl);
  const typ = ctx.typByActType.get(a.custom_activity_type_id);
  if (!typ) return `Protokoll-Typ ${a.custom_activity_type_id} gehört nicht zur Automatik`;

  const felder = felderAus(ctx, a);
  const schluessel = SCHLUESSEL.map((k) => felder[k] ?? "").join("|");
  const { data: vorher } = await sb.from("close_protokolle").select("schluessel").eq("id", activityId).maybeSingle();
  const bearbeiter: string | null = a.user_id ?? a.created_by ?? null;

  const ergebnisse: RegelErgebnis[] = [regeln(typ, felder, jetzt, bearbeiter)];
  if (ergebnisse[0].regel === "closing.angebot") ergebnisse.push(angebotNachfassen(jetzt));

  const basis = {
    id: activityId, lead_id: a.lead_id, typ, user_id: bearbeiter, datum: a.activity_at ?? a.date_created,
    ergebnis: felder.ergebnis ?? null, felder, schluessel, regel: ergebnisse[0].regel, updated_at: new Date().toISOString(),
  };
  // Gleiche Schlüsselfelder wie beim letzten Mal (z. B. nur Notiz geändert) → keine Aktionen erneut
  if (vorher?.schluessel === schluessel) {
    await sb.from("close_protokolle").upsert(basis);
    return `Protokoll ${activityId} (${typ}) unverändert – keine Aktion`;
  }

  const einstellung = await automatikEinstellung();
  const zeilen: Record<string, unknown>[] = [];
  const zusammenfassung: string[] = [];
  for (const e of ergebnisse) {
    if (!e.aktionen.length) continue;
    const an = regelAn(einstellung, e.regel);
    try {
      const log = an ? await fuehreAus(cl, ctx, a.lead_id, e.aktionen, bearbeiter) : [];
      zeilen.push({ activity_id: activityId, lead_id: a.lead_id, regel: e.regel, beschreibung: e.beschreibung, aktionen: e.aktionen, ergebnis: log, ok: true, trocken: !an });
      zusammenfassung.push(`${e.regel}${an ? "" : " (trocken)"}`);
    } catch (err) {
      zeilen.push({ activity_id: activityId, lead_id: a.lead_id, regel: e.regel, beschreibung: e.beschreibung, aktionen: e.aktionen, ok: false, trocken: !an, fehler: (err as Error).message.slice(0, 500) });
      zusammenfassung.push(`${e.regel} FEHLER`);
    }
  }
  await sb.from("close_protokolle").upsert({ ...basis, verarbeitet_am: new Date().toISOString() });
  if (zeilen.length) await sb.from("automatik_log").insert(zeilen);
  return `Protokoll ${activityId} (${typ}): ${zusammenfassung.join(", ") || "keine Aktion"}`;
}

// ---------------------------------------------------------------------------
// Neuer Lead (Close-Webhook lead.created): Status „Neu“ + Aufgabe „sofort anrufen“ für den Setter.

export function regelNeuerLead(jetzt: Date = new Date()): RegelErgebnis {
  return {
    regel: "lead.neu",
    beschreibung: "Neuer Lead → Status „Neu“, Aufgabe „sofort anrufen“ (Speed-to-Lead < 5 Min.)",
    aktionen: [
      { art: "lead_status", status: "neu" },
      { art: "aufgabe", text: "🔥 Neuer Inbound-Lead – sofort anrufen (Ziel: unter 5 Minuten)", datum: jetzt.toISOString(), an: "bearbeiter" },
    ],
  };
}

export async function verarbeiteNeuenLead(leadId: string, jetzt: Date = new Date()): Promise<string> {
  const cl = new CloseClient();
  const sb = adminClient();
  const ctx = await kontext(cl);
  const e = regelNeuerLead(jetzt);
  // Setter-Feld als Bearbeiter, sonst Lead-Besitzer (Close weist sonst dem API-Nutzer zu)
  const setterFeld = (await cl.alle("custom_field/lead/")).find((f: any) => f.name === LEAD_FELDER.setter.name)?.id;
  const lead = await cl.get(`lead/${leadId}/`);
  const bearbeiter: string | null = (setterFeld && lead[`custom.${setterFeld}`]) || null;
  // Leads, die schon einen Ablauf-Status haben (z. B. vom Funnel gesetzt), nicht zurücksetzen
  const eigene = Object.values(LEAD_STATUS).map((x) => x.toLowerCase());
  const aktionen = eigene.includes((lead.status_label ?? "").toLowerCase()) ? e.aktionen.filter((a) => a.art !== "lead_status") : e.aktionen;
  const an = regelAn(await automatikEinstellung(), e.regel);
  try {
    const log = an ? await fuehreAus(cl, ctx, leadId, aktionen, bearbeiter) : [];
    await sb.from("automatik_log").insert({ lead_id: leadId, regel: e.regel, beschreibung: e.beschreibung, aktionen, ergebnis: log, ok: true, trocken: !an });
    return `Neuer Lead ${leadId}: ${e.regel}${an ? "" : " (trocken)"}`;
  } catch (err) {
    await sb.from("automatik_log").insert({ lead_id: leadId, regel: e.regel, beschreibung: e.beschreibung, aktionen, ok: false, trocken: !an, fehler: (err as Error).message.slice(0, 500) });
    return `Neuer Lead ${leadId}: FEHLER`;
  }
}
