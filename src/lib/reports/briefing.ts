import "server-only";
// Morgen-Briefing und Wochenreport als Markdown (Slack-tauglich). Versand nur, wenn REPORTS_AKTIV=1.

import { adTabelle, berechne, engpass, pacing, repTabelle, warnungen, type Filter } from "../kpi/engine";
import { formatWert } from "../kpi/katalog";
import { addDays, startOfDay, wochenStart } from "../kpi/zeit";
import type { Dataset } from "../types";

const eur = (v: number | null | undefined) => formatWert(v, "eur");
const pct = (v: number | null | undefined) => formatWert(v, "pct");
const zr = (von: Date, bis: Date) => ({ key: "frei" as const, von, bis, label: "" });
const dlt = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? "" : ` (${a >= b ? "+" : "−"}${Math.abs(Math.round(((a - b) / Math.abs(b)) * 100))} %)`);

const EMPFEHLUNG: Record<string, string> = {
  ctr: "Neue Hooks testen, Creatives mit hoher Frequenz pausieren.",
  lpConv: "Landingpage prüfen (Ladezeit, Formular-Länge, Versprechen aus der Anzeige).",
  buchungsquote: "Speed-to-Lead und Anwahlversuche prüfen, Setter-Skript schärfen (Modul 9/10).",
  showRateEG: "Bestätigung + Erinnerungen vor dem Erstgespräch, No-Shows aktiv zurückholen.",
  qualifizierungsquote: "Bedarfsanalyse im Erstgespräch vertiefen (Modul 12).",
  showRateBG: "Beratungstermin direkt im Erstgespräch fest einbuchen, Erinnerung am Vortag.",
  closingRate: "Einwandbehandlung trainieren, Verlustgründe je Closer ansehen (Modul 18–20).",
};

export function morgenBriefing(ds: Dataset, now = new Date()): string {
  const heute = startOfDay(now);
  const gestern = addDays(heute, -1);
  const fG: Filter = { sicht: "ereignis", zeitraum: zr(gestern, heute), now };
  const fMtd: Filter = { sicht: "ereignis", zeitraum: zr(new Date(now.getFullYear(), now.getMonth(), 1), addDays(heute, 1)), now };
  const kG = berechne(ds, fG);
  const kM = berechne(ds, fMtd);
  const p = pacing(ds, { now });
  const termineHeute = ds.meetings.filter((m) => { const t = new Date(m.startsAt); return t >= heute && t < addDays(heute, 1) && m.outcome !== "abgesagt"; });
  const eg = termineHeute.filter((m) => m.typ === "erstgespraech").length;
  const bg = termineHeute.length - eg;
  const ads = adTabelle(ds, { sicht: "ereignis", zeitraum: zr(addDays(heute, -7), addDays(heute, 1)), now }).filter((z) => z.ebene === "ad" && z.spend >= 50);
  const top = [...ads].sort((a, b) => (a.kostenShow ?? a.cpl ?? 1e9) - (b.kostenShow ?? b.cpl ?? 1e9))[0];
  const flop = [...ads].sort((a, b) => (b.kostenShow ?? b.cpl ?? 1e9) - (a.kostenShow ?? a.cpl ?? 1e9))[0];
  const w = warnungen(ds, now).slice(0, 3);
  const datum = now.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" });
  const zeilen = [
    `*Morgen-Briefing Compass Energie · ${datum}*`,
    "",
    `*Umsatz gestern:* ${eur(kG.umsatz)} (${kG.abschluesse} Abschlüsse) · *MTD:* ${eur(kM.umsatz)}${p.ziel ? ` von ${eur(p.ziel)}` : ""}`,
    p.ziel ? `*Pacing:* ${pct(p.pacing)} vom Soll · Hochrechnung ${pct(p.prognoseQuote)} vom Ziel · Forecast ${eur(p.forecast)}` : "*Pacing:* kein Monatsziel hinterlegt",
    `*Werbung gestern:* ${eur(kG.spend)} · ${kG.leadsMeta} Meta-Leads · CPL ${eur(kG.cpl)}`,
    `*Termine heute:* ${eg} Erstgespräche · ${bg} Beratungsgespräche`,
  ];
  if (top) zeilen.push(`*Top-Creative (7 T):* ${top.name} – Kosten/Show ${eur(top.kostenShow)}, CPL ${eur(top.cpl)}`);
  if (flop && flop !== top) zeilen.push(`*Flop-Creative (7 T):* ${flop.name} – Kosten/Show ${eur(flop.kostenShow)}, CPL ${eur(flop.cpl)}`);
  zeilen.push("", w.length ? "*Warnungen:*" : "*Keine Warnungen.*", ...w.map((x) => `${x.stufe === "rot" ? "🔴" : "🟡"} ${x.text}`));
  return zeilen.join("\n");
}

export function wochenReport(ds: Dataset, now = new Date()): string {
  const diese = wochenStart(now);
  const letzteVon = addDays(diese, -7);
  const vorVon = addDays(diese, -14);
  const f: Filter = { sicht: "ereignis", zeitraum: zr(letzteVon, diese), now };
  const v: Filter = { sicht: "ereignis", zeitraum: zr(vorVon, letzteVon), now };
  const k = berechne(ds, f), kv = berechne(ds, v);
  const reps = repTabelle(ds, f);
  const setter = [...reps].filter((r) => r.rolle !== "closer").sort((a, b) => b.termine - a.termine).slice(0, 3);
  const closer = [...reps].filter((r) => r.rolle !== "setter").sort((a, b) => b.umsatz - a.umsatz).slice(0, 3);
  const e = engpass(k, ds);
  const medaille = ["🥇", "🥈", "🥉"];
  const kw = `${letzteVon.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}–${addDays(diese, -1).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`;
  return [
    `*Wochenreport Compass Energie · ${kw}*`,
    "",
    `*Umsatz:* ${eur(k.umsatz)}${dlt(k.umsatz, kv.umsatz)} · *Abschlüsse:* ${k.abschluesse}${dlt(k.abschluesse, kv.abschluesse)} · *Cash:* ${eur(k.cash)}`,
    `*Werbung:* ${eur(k.spend)}${dlt(k.spend, kv.spend)} · CPL ${eur(k.cpl)} · Kosten/Show ${eur(k.kostenShow)} · ROAS ${formatWert(k.roas, "faktor")} · CAC ${eur(k.cac)}`,
    `*Leads:* ${k.leads}${dlt(k.leads, kv.leads)} · Buchungsquote ${pct(k.buchungsquote)} · Show-Rate EG ${pct(k.showRateEG)} · Qualifizierung ${pct(k.qualifizierungsquote)}`,
    `*Closing:* Show-Rate BG ${pct(k.showRateBG)} · Closing-Rate ${pct(k.closingRate)} · AOV ${eur(k.aov)}`,
    `*Setting:* Speed-to-Lead ${formatWert(k.speedToLead, "min")} · Erreichbarkeit ${pct(k.erreichbarkeit)} · ${k.anwahlen} Anwahlen`,
    "",
    "*Leaderboard Setter (Termine):* " + (setter.map((r, i) => `${medaille[i]} ${r.name} ${r.termine}`).join(" · ") || "–"),
    "*Leaderboard Closer (Umsatz):* " + (closer.map((r, i) => `${medaille[i]} ${r.name} ${eur(r.umsatz)}`).join(" · ") || "–"),
    "",
    e ? `*Engpass der Woche:* ${e.label} ${pct(e.wert)} (Ziel ${pct(e.ziel)}). Empfehlung: ${EMPFEHLUNG[e.kpi] ?? "Ursache im Funnel prüfen."}` : "*Kein Engpass* – alle Stufen im Ziel oder zu wenig Daten.",
  ].join("\n");
}

/** Versand an Slack. Nur wenn REPORTS_AKTIV=1 und SLACK_WEBHOOK_URL gesetzt. */
export async function sendeSlack(text: string): Promise<{ gesendet: boolean; grund?: string }> {
  if (process.env.REPORTS_AKTIV !== "1") return { gesendet: false, grund: "REPORTS_AKTIV ist nicht 1 (Vorschau-Modus)" };
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return { gesendet: false, grund: "SLACK_WEBHOOK_URL fehlt" };
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  if (!res.ok) throw new Error(`Slack: ${res.status} ${await res.text()}`);
  return { gesendet: true };
}
