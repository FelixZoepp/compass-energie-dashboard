// Rollen als Stufen (1 = höchste). Client-tauglich (keine Server-Imports).
export type Rolle = "superadmin" | "admin" | "management" | "marketing" | "rep";

export const STUFEN: { rolle: Rolle; stufe: number; label: string; beschreibung: string }[] = [
  { rolle: "superadmin", stufe: 1, label: "Inhaber", beschreibung: "Alles, inkl. Admins verwalten und Stufe 1 vergeben" },
  { rolle: "admin", stufe: 2, label: "Geschäftsführung", beschreibung: "Alles inkl. Einstellungen, Ziele und Benutzer (ohne Stufe 1)" },
  { rolle: "management", stufe: 3, label: "Führung", beschreibung: "Alle Zahlen lesen: Cockpit, Marketing, Sales, Team" },
  { rolle: "marketing", stufe: 4, label: "Marketing", beschreibung: "Meta Ads, Funnel, Planung" },
  { rolle: "rep", stufe: 5, label: "Vertrieb", beschreibung: "Eigene Zahlen, Mein Tag, Leaderboard" },
];

export const stufeVon = (r: string) => STUFEN.find((s) => s.rolle === r) ?? STUFEN[STUFEN.length - 1];
export const stufenLabel = (r: string) => { const s = stufeVon(r); return `Stufe ${s.stufe} · ${s.label}`; };
/** Darf `ich` die Rolle `ziel` vergeben bzw. eine Person mit Rolle `ziel` bearbeiten? */
export const darfVerwalten = (ich: string, ziel: string) => stufeVon(ich).stufe <= 2 && stufeVon(ich).stufe <= stufeVon(ziel).stufe;
