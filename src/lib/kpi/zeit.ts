// Zeiträume, Vergleichsperioden, Arbeitstage und Arbeitsminuten (Zeitzone Europe/Berlin).

import type { Settings } from "../types";

export type ZeitraumKey = "heute" | "gestern" | "woche" | "7t" | "monat" | "vormonat" | "quartal" | "30t" | "90t" | "gesamt" | "frei";
export type Vergleich = "vorperiode" | "vorjahr" | "aus";

export interface Zeitraum {
  key: ZeitraumKey;
  von: Date; // inklusiv
  bis: Date; // exklusiv
  label: string;
}

export const ZEITRAUM_LABEL: Record<ZeitraumKey, string> = {
  heute: "Heute",
  gestern: "Gestern",
  woche: "Diese Woche",
  "7t": "Letzte 7 Tage",
  monat: "Dieser Monat",
  vormonat: "Letzter Monat",
  quartal: "Quartal",
  "30t": "Letzte 30 Tage",
  "90t": "Letzte 90 Tage",
  gesamt: "Gesamt",
  frei: "Frei",
};

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function zeitraum(key: ZeitraumKey, now = new Date(), frei?: { von?: string; bis?: string }): Zeitraum {
  const heute = startOfDay(now);
  const morgen = addDays(heute, 1);
  let von: Date, bis: Date;
  switch (key) {
    case "heute": von = heute; bis = morgen; break;
    case "gestern": von = addDays(heute, -1); bis = heute; break;
    case "woche": { const wd = (heute.getDay() + 6) % 7; von = addDays(heute, -wd); bis = morgen; break; }
    case "7t": von = addDays(heute, -6); bis = morgen; break;
    case "30t": von = addDays(heute, -29); bis = morgen; break;
    case "90t": von = addDays(heute, -89); bis = morgen; break;
    case "gesamt": von = frei?.von ? startOfDay(new Date(frei.von)) : addDays(heute, -364); bis = morgen; break;
    case "vormonat": von = new Date(heute.getFullYear(), heute.getMonth() - 1, 1); bis = new Date(heute.getFullYear(), heute.getMonth(), 1); break;
    case "quartal": von = new Date(heute.getFullYear(), Math.floor(heute.getMonth() / 3) * 3, 1); bis = morgen; break;
    case "frei": {
      von = frei?.von ? startOfDay(new Date(frei.von)) : addDays(heute, -29);
      bis = frei?.bis ? addDays(startOfDay(new Date(frei.bis)), 1) : morgen;
      break;
    }
    case "monat":
    default: von = new Date(heute.getFullYear(), heute.getMonth(), 1); bis = morgen; key = "monat";
  }
  const fmt = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  const label = key === "frei" ? `${fmt(von)}–${fmt(addDays(bis, -1))}` : ZEITRAUM_LABEL[key];
  return { key, von, bis, label };
}

export function vergleichsZeitraum(z: Zeitraum, v: Vergleich): Zeitraum | null {
  if (v === "aus") return null;
  if (v === "vorjahr") {
    const von = new Date(z.von); von.setFullYear(von.getFullYear() - 1);
    const bis = new Date(z.bis); bis.setFullYear(bis.getFullYear() - 1);
    return { key: "frei", von, bis, label: "Vorjahr" };
  }
  // Monatsbezogene Zeiträume: gleich lange Strecke im Vormonat (z. B. 1.–17. vs. 1.–17.)
  if (z.key === "monat" || z.key === "quartal") {
    const monate = z.key === "monat" ? 1 : 3;
    const von = new Date(z.von.getFullYear(), z.von.getMonth() - monate, 1);
    const tage = Math.round((z.bis.getTime() - z.von.getTime()) / 86400000);
    const bis = addDays(von, tage);
    return { key: "frei", von, bis, label: z.key === "monat" ? "Vormonat (gleicher Stand)" : "Vorquartal" };
  }
  const dauer = z.bis.getTime() - z.von.getTime();
  return { key: "frei", von: new Date(z.von.getTime() - dauer), bis: new Date(z.von), label: "Vorperiode" };
}

export function istArbeitstag(d: Date, s: Settings) {
  const wd = d.getDay() === 0 ? 7 : d.getDay();
  return s.arbeitszeit.tage.includes(wd);
}

export function arbeitstage(von: Date, bis: Date, s: Settings) {
  let n = 0;
  for (let d = startOfDay(von); d < bis; d = addDays(d, 1)) if (istArbeitstag(d, s)) n++;
  return n;
}

/** Minuten zwischen a und b, die in die Arbeitszeit fallen (für Speed-to-Lead). */
export function arbeitsMinuten(a: Date, b: Date, s: Settings): number {
  if (b <= a) return 0;
  let summe = 0;
  for (let d = startOfDay(a); d < b; d = addDays(d, 1)) {
    if (!istArbeitstag(d, s)) continue;
    const ws = new Date(d); ws.setHours(s.arbeitszeit.start, 0, 0, 0);
    const we = new Date(d); we.setHours(s.arbeitszeit.ende, 0, 0, 0);
    const lo = Math.max(ws.getTime(), a.getTime());
    const hi = Math.min(we.getTime(), b.getTime());
    if (hi > lo) summe += (hi - lo) / 60000;
    if (summe > 60 * 24 * 30) break;
  }
  return summe;
}

export function isoWoche(d: Date): string {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const wd = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - wd);
  const j1 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  const kw = Math.ceil(((x.getTime() - j1.getTime()) / 86400000 + 1) / 7);
  return `${x.getUTCFullYear()}-KW${String(kw).padStart(2, "0")}`;
}

export function wochenStart(d: Date) {
  const x = startOfDay(d);
  return addDays(x, -((x.getDay() + 6) % 7));
}

export const tagKey = (d: Date) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), t = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${t}`;
};
export { addDays, startOfDay };
