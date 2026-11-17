// Deterministische Demo-Daten (120 Tage), damit jede Seite ohne angebundene Quellen
// realistisch aussieht. Wird nur genutzt, solange keine echten Daten da sind.

import { DEFAULT_SETTINGS } from "../kpi/katalog";
import type {
  AdBreakdown, AdEntity, AdInsight, Call, Dataset, Lead, Meeting, Opportunity, OppStage, Payment, Quelle, Rep, Task,
} from "../types";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VORNAMEN = ["Lukas", "Anna", "Jonas", "Lea", "Tim", "Sarah", "Max", "Julia", "Paul", "Laura", "Felix", "Nina", "David", "Lisa", "Jan", "Marie", "Tobias", "Sophie", "Kevin", "Hannah"];
const NACHNAMEN = ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Hoffmann", "Schulz", "Koch", "Richter", "Klein", "Wolf", "Neumann", "Krüger", "Braun", "Zimmermann"];
const VERLUSTGRUENDE = ["Preis", "Kein Bedarf", "Zeitpunkt", "Konkurrenz", "Nicht erreichbar", "Entscheider fehlt"];

const iso = (d: Date) => d.toISOString();
const day = (d: Date) => d.toISOString().slice(0, 10);
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

export function demoDataset(now = new Date()): Dataset {
  const r = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const TAGE = 120;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - TAGE);

  const reps: Rep[] = [
    { id: "u_setter1", name: "Mia Setter", rolle: "setter", aktiv: true },
    { id: "u_setter2", name: "Ben Setter", rolle: "setter", aktiv: true },
    { id: "u_closer1", name: "Clara Closer", rolle: "closer", aktiv: true },
    { id: "u_closer2", name: "Daniel Closer", rolle: "closer", aktiv: true },
  ];
  const setter = reps.filter((x) => x.rolle === "setter");
  const closer = reps.filter((x) => x.rolle === "closer");

  // Kampagnenstruktur
  const kampagnen = [
    { id: "c_1001", name: "B2B | Quiz-Funnel | Kalt", budget: 450, typ: "B2B" as const, guete: 1.15 },
    { id: "c_1002", name: "B2C | Webinar | Kalt", budget: 250, typ: "B2C" as const, guete: 0.9 },
    { id: "c_1003", name: "Retargeting | Alle", budget: 100, typ: "B2B" as const, guete: 1.3 },
  ];
  const ads: AdEntity[] = [];
  const hooks = ["Hook 1 – Fehler im Vertrieb", "Hook 2 – Vorher/Nachher", "Hook 3 – Testimonial", "Hook 4 – Zahlen-Story"];
  kampagnen.forEach((c, ci) => {
    for (let a = 0; a < 2; a++) {
      const adsetId = `as_${ci}${a}`;
      for (let b = 0; b < 2; b++) {
        const n = ci * 4 + a * 2 + b;
        ads.push({
          adId: `ad_${2000 + n}`,
          adName: `${hooks[(n + ci) % 4]} · V${b + 1}`,
          adsetId,
          adsetName: a === 0 ? "Broad 25–55" : "Lookalike Kunden 3 %",
          campaignId: c.id,
          campaignName: c.name,
          status: n === 5 ? "PAUSED" : "ACTIVE",
          tagesbudget: c.budget,
          thumbnailUrl: null,
          title: hooks[(n + ci) % 4],
          body: "Dein Vertrieb wächst nicht, weil die Führung fehlt? TRIAS 360 zeigt dir in 12 Wochen, wie es geht.",
          isVideo: b === 0 || n % 3 === 0,
        });
      }
    }
  });
  const adQualitaet = new Map(ads.map((a) => [a.adId, 0.6 + r() * 0.9]));

  const insights: AdInsight[] = [];
  const leads: Lead[] = [];
  const meetings: Meeting[] = [];
  const calls: Call[] = [];
  const opps: Opportunity[] = [];
  const tasks: Task[] = [];
  const payments: Payment[] = [];
  let lid = 0;

  const neuerLead = (createdAt: Date, quelle: Quelle, ad?: AdEntity) => {
    const typ = ad ? kampagnen.find((c) => c.id === ad.campaignId)!.typ : r() < 0.6 ? "B2B" : "B2C";
    const team = typ === "B2B" ? 1 + Math.floor(r() * 12) : null;
    const lead: Lead = {
      id: `lead_demo_${++lid}`,
      name: `${pick(VORNAMEN)} ${pick(NACHNAMEN)}`,
      createdAt: iso(createdAt),
      quelle,
      utmSource: ad ? "meta" : null,
      utmMedium: ad ? "paid" : null,
      utmCampaign: ad?.campaignId ?? null,
      utmTerm: ad?.adsetId ?? null,
      utmContent: ad ? (r() < 0.96 ? ad.adId : null) : null,
      kundentyp: r() < 0.93 ? typ : null,
      rolle: pick(["Geschäftsführer", "Vertriebsleiter", "Teamleiter", "Selbstständig"]),
      teamgroesse: team,
      qualifiziert: false,
      setterId: pick(setter).id,
      closerId: null,
    };
    lead.qualifiziert = lead.kundentyp === "B2C" ? r() < 0.55 : (team ?? 0) >= 3;
    leads.push(lead);
    simuliereLead(lead, ad ? adQualitaet.get(ad.adId)! : 1);
  };

  const inArbeitszeit = (d: Date) => {
    const x = new Date(d);
    if (x.getHours() >= 19) { x.setDate(x.getDate() + 1); x.setHours(8, 5 + Math.floor(r() * 40), 0, 0); }
    if (x.getHours() < 8) x.setHours(8, 5 + Math.floor(r() * 40), 0, 0);
    while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1);
    return x;
  };

  function simuliereLead(lead: Lead, q: number) {
    const created = new Date(lead.createdAt);
    const s = reps.find((x) => x.id === lead.setterId)!;
    const schnell = s.id === "u_setter1" ? 0.85 : 0.55;
    // Anrufe
    let t = inArbeitszeit(addMin(created, r() < schnell ? 1 + r() * 4 : 6 + r() * 90));
    let erreicht = false;
    const maxVersuche = 2 + Math.floor(r() * 7);
    let gespraechAm: Date | null = null;
    for (let v = 0; v < maxVersuche && t < now; v++) {
      const ok = r() < (0.22 + 0.04 * Math.min(v, 3)) * (t.getHours() >= 16 || t.getHours() < 10 ? 1.4 : 1);
      calls.push({ id: `call_${calls.length}`, leadId: lead.id, userId: s.id, at: iso(t), direction: "outbound", durationSec: ok ? 120 + Math.floor(r() * 900) : Math.floor(r() * 25), answered: ok });
      if (ok) { erreicht = true; gespraechAm = t; break; }
      t = inArbeitszeit(addMin(t, 60 + r() * 60 * 26));
    }
    if (!erreicht || !gespraechAm) {
      if (r() < 0.3) tasks.push({ id: `task_${tasks.length}`, leadId: lead.id, userId: s.id, due: iso(addMin(created, 60 * 48)), done: r() < 0.4 });
      return;
    }
    // Erstgespräch buchen
    const quali = lead.qualifiziert ? 1 : 0.45;
    if (r() > 0.42 * quali * Math.min(q, 1.1)) return;
    const egStart = inArbeitszeit(addMin(gespraechAm, 60 * (20 + r() * 80)));
    const egOutcome = (start: Date) => (start > now ? null : r() < 0.7 * Math.min(q, 1.2) ? "stattgefunden" : r() < 0.75 ? "no_show" : "verschoben");
    let outcome = egOutcome(egStart);
    if (egStart < now && egStart > addMin(now, -60 * 24 * 21) && r() < 0.05) outcome = null; // fehlendes Outcome → Datenhygiene
    meetings.push({ id: `mtg_${meetings.length}`, leadId: lead.id, typ: "erstgespraech", bookedAt: iso(gespraechAm), startsAt: iso(egStart), outcome: outcome as Meeting["outcome"], userId: s.id });
    let egOk = outcome === "stattgefunden" ? egStart : null;
    if (outcome === "no_show" && r() < 0.4) {
      const neu = inArbeitszeit(addMin(egStart, 60 * 30));
      const o2 = neu > now ? null : r() < 0.6 ? "stattgefunden" : "no_show";
      meetings.push({ id: `mtg_${meetings.length}`, leadId: lead.id, typ: "erstgespraech", bookedAt: iso(addMin(egStart, 60)), startsAt: iso(neu), outcome: o2 as Meeting["outcome"], userId: s.id });
      if (o2 === "stattgefunden") egOk = neu;
    }
    if (!egOk) return;
    const c = pick(closer);
    lead.closerId = c.id;
    const opp: Opportunity = {
      id: `oppo_${opps.length}`, leadId: lead.id, stage: "setting", statusLabel: "Setting", value: 0,
      createdAt: iso(egOk), stageSince: iso(egOk), userId: c.id, hatNaechsteAufgabe: r() < 0.85,
    };
    opps.push(opp);
    if (r() > 0.55 * quali) { if (egOk < addMin(now, -60 * 24 * 10) && r() < 0.7) verliere(opp, egOk); return; }
    const bgStart = inArbeitszeit(addMin(egOk, 60 * (24 + r() * 24 * 6)));
    const bgOutcome = bgStart > now ? null : r() < 0.8 ? "stattgefunden" : "no_show";
    meetings.push({ id: `mtg_${meetings.length}`, leadId: lead.id, typ: "beratung", bookedAt: iso(egOk), startsAt: iso(bgStart), outcome: bgOutcome as Meeting["outcome"], userId: c.id });
    setStage(opp, "closing_terminiert", egOk);
    opp.closeDate = iso(bgStart);
    if (bgOutcome !== "stattgefunden") return;
    const paket = lead.kundentyp === "B2B" ? (r() < 0.6 ? "Team" : r() < 0.7 ? "Einzelplatz" : "Inhouse") : "Einzelplatz";
    const liste = { Einzelplatz: 3000, Team: 9000, Inhouse: 18000 }[paket]!;
    opp.paket = paket; opp.listenpreis = liste;
    opp.plaetze = paket === "Einzelplatz" ? 1 : paket === "Team" ? 3 + Math.floor(r() * 4) : 10;
    opp.value = Math.round(liste * (r() < 0.25 ? 0.85 + r() * 0.1 : 1));
    const closeQ = c.id === "u_closer1" ? 0.24 : 0.14;
    const angebot = r() < 0.55;
    let t2 = bgStart;
    if (angebot) { t2 = addMin(bgStart, 60 * 3); opp.angebotAm = iso(t2); setStage(opp, "angebot", t2); }
    else setStage(opp, "closing_fu", bgStart);
    const entscheid = addMin(t2, 60 * 24 * (1 + r() * 14));
    if (entscheid > now) { opp.closeDate = iso(addMin(now, 60 * 24 * (2 + r() * 20))); return; }
    if (r() < closeQ * Math.min(q, 1.15) * (angebot ? 1.25 : 0.8)) {
      setStage(opp, "won", entscheid); opp.wonAt = iso(entscheid);
      opp.zahlungsart = pick(["Einmalzahlung", "Ratenzahlung 3x", "Ratenzahlung 6x"]);
      if (r() < 0.06) opp.value = 0; // Datenhygiene: Wert fehlt
      const anteil = opp.zahlungsart === "Einmalzahlung" ? 1 : opp.zahlungsart === "Ratenzahlung 3x" ? 1 / 3 : 1 / 6;
      const raten = Math.round(1 / anteil);
      for (let i = 0; i < raten; i++) {
        const at = addMin(entscheid, 60 * 24 * (2 + i * 30 + r() * 5));
        if (at < now && r() < 0.95) payments.push({ id: `pay_${payments.length}`, oppId: opp.id, leadId: lead.id, at: iso(at), amount: Math.round(opp.value * anteil) });
      }
    } else if (r() < 0.75 || entscheid < addMin(now, -60 * 24 * 21)) verliere(opp, entscheid);
    else { opp.closeDate = iso(addMin(now, 60 * 24 * (3 + r() * 25))); if (r() < 0.3) setStage(opp, "cc2", entscheid); }
  }

  function setStage(o: Opportunity, s: OppStage, at: Date) {
    o.stage = s; o.stageSince = iso(at);
    o.statusLabel = { setting: "Setting", closing_terminiert: "Closing terminiert", closing_fu: "Closing FU", angebot: "Angebot", cc2: "CC2", won: "Gewonnen", lost: "Verloren" }[s];
  }
  function verliere(o: Opportunity, at: Date) {
    setStage(o, "lost", at); o.lostAt = iso(at);
    o.verlustgrund = o.userId === "u_closer2" && r() < 0.5 ? "Preis" : pick(VERLUSTGRUENDE);
  }

  // Tage durchlaufen
  for (let d = 0; d <= TAGE; d++) {
    const datum = new Date(start);
    datum.setDate(datum.getDate() + d);
    if (datum > now) break;
    const anteilTag = d === TAGE ? Math.min(1, (now.getHours() * 60 + now.getMinutes()) / (24 * 60)) : 1;
    const wochenende = datum.getDay() === 0 || datum.getDay() === 6;
    for (const ad of ads) {
      if (ad.status === "PAUSED" && d > TAGE - 20) continue;
      const k = kampagnen.find((c) => c.id === ad.campaignId)!;
      const q = adQualitaet.get(ad.adId)!;
      const alter = d / TAGE;
      const muede = ad.adId === "ad_2002" ? 1 - 0.45 * alter : 1; // ein ausbrennendes Creative
      const spend = (k.budget / 4) * (0.75 + r() * 0.5) * anteilTag * (1 + d / 400);
      const cpm = 35 + r() * 20;
      const impressions = Math.round((spend / cpm) * 1000);
      const reach = Math.round(impressions / (1.3 + alter * (ad.adId === "ad_2002" ? 2.6 : 0.8)));
      const ctr = (0.006 + 0.006 * q) * muede * k.guete;
      const linkClicks = Math.round(impressions * ctr);
      const lpViews = Math.round(linkClicks * (0.72 + r() * 0.18));
      const v3 = ad.isVideo ? Math.round(impressions * (0.18 + 0.2 * q) * muede) : 0;
      const thru = Math.round(v3 * (0.15 + 0.15 * q));
      const conv = (0.07 + 0.07 * q) * (wochenende ? 0.85 : 1);
      let crmLeads = 0;
      for (let i = 0; i < lpViews; i++) if (r() < conv) crmLeads++;
      insights.push({
        date: day(datum), adId: ad.adId, spend: Math.round(spend * 100) / 100, impressions, reach, linkClicks, lpViews,
        videoViews3s: v3, thruplays: thru,
        p25: Math.round(v3 * 0.55), p50: Math.round(v3 * 0.32), p75: Math.round(v3 * 0.2), p100: Math.round(thru * 0.7),
        metaLeads: Math.round(crmLeads * (1.05 + r() * 0.15)), metaSchedules: 0, metaPurchases: 0,
      });
      for (let i = 0; i < crmLeads; i++) {
        const t = new Date(datum);
        t.setHours(7 + Math.floor(r() * 15), Math.floor(r() * 60));
        if (t < now) neuerLead(t, "meta", ad);
      }
    }
    // Nicht-Meta-Leads
    const extra: [Quelle, number][] = [["empfehlung", 0.35], ["kaltakquise", 0.45], ["organisch", 0.25], ["linkedin", 0.3]];
    for (const [q, p] of extra) {
      if (r() < p * anteilTag) {
        const t = new Date(datum);
        t.setHours(8 + Math.floor(r() * 10), Math.floor(r() * 60));
        if (t < now) neuerLead(t, q);
      }
    }
  }

  // ein paar frische, noch nicht angerufene Leads für die Live-Liste
  for (let i = 0; i < 4; i++) {
    const t = addMin(now, -(3 + i * 9));
    const ad = ads[i];
    leads.push({
      id: `lead_demo_${++lid}`, name: `${pick(VORNAMEN)} ${pick(NACHNAMEN)}`, createdAt: iso(t), quelle: "meta",
      utmSource: "meta", utmMedium: "paid", utmCampaign: ad.campaignId, utmTerm: ad.adsetId, utmContent: ad.adId,
      kundentyp: "B2B", rolle: "Geschäftsführer", teamgroesse: 5, qualifiziert: true, setterId: setter[i % 2].id,
    });
  }

  const breakdowns: AdBreakdown[] = [];
  const spendGesamt = insights.reduce((s, x) => s + x.spend, 0);
  for (const alter of ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]) {
    for (const g of ["male", "female"]) {
      const w = { "18-24": 0.06, "25-34": 0.24, "35-44": 0.3, "45-54": 0.22, "55-64": 0.13, "65+": 0.05 }[alter]! * (g === "male" ? 0.58 : 0.42);
      const eff = { "18-24": 0.5, "25-34": 1, "35-44": 1.25, "45-54": 1.1, "55-64": 0.8, "65+": 0.5 }[alter]! * (g === "male" ? 1.05 : 0.95);
      const spend = spendGesamt * w;
      breakdowns.push({ dimension: "age_gender", key: `${alter}|${g}`, spend, impressions: Math.round(spend * 80), linkClicks: Math.round(spend * 0.8 * eff), metaLeads: Math.round((spend / 70) * eff) });
    }
  }
  for (const [key, w, eff] of [["facebook|feed", 0.3, 1.1], ["instagram|feed", 0.22, 0.95], ["instagram|reels", 0.25, 1.15], ["instagram|stories", 0.13, 0.8], ["facebook|reels", 0.06, 0.9], ["audience_network|classic", 0.04, 0.3]] as const) {
    const spend = spendGesamt * w;
    breakdowns.push({ dimension: "platform_position", key, spend, impressions: Math.round(spend * 85), linkClicks: Math.round(spend * 0.8 * eff), metaLeads: Math.round((spend / 70) * eff) });
  }
  for (const [key, w, eff] of [["mobile_app", 0.78, 1], ["desktop", 0.18, 1.25], ["mobile_web", 0.04, 0.6]] as const) {
    const spend = spendGesamt * w;
    breakdowns.push({ dimension: "device", key, spend, impressions: Math.round(spend * 85), linkClicks: Math.round(spend * 0.8 * eff), metaLeads: Math.round((spend / 70) * eff) });
  }

  const monat = now.toISOString().slice(0, 7);
  const vormonat = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().slice(0, 7);
  return {
    quelle: "demo",
    stand: iso(addMin(now, -4)),
    reps, leads, meetings, calls, opps, tasks, payments, ads, insights, breakdowns,
    settings: {
      ...DEFAULT_SETTINGS,
      monatsziel: { [monat]: 120000, [vormonat]: 110000 },
      repZiele: {
        u_setter1: { termine: 40, anwahlen: 900 }, u_setter2: { termine: 40, anwahlen: 900 },
        u_closer1: { abschluesse: 9, umsatz: 64000 }, u_closer2: { abschluesse: 8, umsatz: 56000 },
      },
    },
  };
}
