import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { adminClient } from "../supabase/admin";
import { supabaseKonfiguriert } from "../supabase/env";
import { sessionClient } from "../supabase/server";

import type { Rolle } from "./stufen";
export type { Rolle } from "./stufen";
export { STUFEN, stufeVon, stufenLabel, darfVerwalten } from "./stufen";

export interface Nutzer {
  id: string;
  email: string;
  name: string;
  rolle: Rolle;
  repId: string | null;
  demo: boolean;
}

/** Welche Rolle darf welchen Bereich sehen. */
export const BEREICHE: Record<string, Rolle[]> = {
  "/": ["admin", "management"],
  "/meta": ["admin", "management", "marketing"],
  "/funnel": ["admin", "management", "marketing"],
  "/setting": ["admin", "management"],
  "/closing": ["admin", "management"],
  "/team": ["admin", "management", "rep"],
  "/pipeline": ["admin", "management"],
  "/planung": ["admin", "management", "marketing"],
  "/mein-tag": ["admin", "management", "rep"],
  "/datenqualitaet": ["admin", "management", "rep"],
  "/einstellungen": ["admin"],
};

/** Darf die Rolle den Bereich sehen? Stufe 1 sieht alles. */
export const darf = (rolle: Rolle, pfad: string) => rolle === "superadmin" || (BEREICHE[pfad] ?? ["admin"]).includes(rolle);

export const startseite = (r: Rolle) => (r === "rep" ? "/mein-tag" : r === "marketing" ? "/meta" : "/");

export const nutzer = cache(async (): Promise<Nutzer | null> => {
  if (!supabaseKonfiguriert()) return { id: "demo", email: "demo@compass", name: "Demo-Modus", rolle: "superadmin", repId: null, demo: true };
  const sb = await sessionClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await adminClient().from("profiles").select("email,name,rolle,rep_id,aktiv").eq("id", data.user.id).maybeSingle();
  if (!p) {
    // Erstes Profil überhaupt → Stufe 1 (Inhaber), sonst Vertrieb ohne Zuordnung (Admin vergibt Stufen)
    const { count } = await adminClient().from("profiles").select("id", { count: "exact", head: true });
    const rolle: Rolle = (count ?? 0) === 0 ? "superadmin" : "rep";
    await adminClient().from("profiles").insert({ id: data.user.id, email: data.user.email, name: data.user.email, rolle });
    return { id: data.user.id, email: data.user.email ?? "", name: data.user.email ?? "", rolle, repId: null, demo: false };
  }
  if (!p.aktiv) return null;
  return { id: data.user.id, email: p.email, name: p.name || p.email, rolle: p.rolle, repId: p.rep_id, demo: false };
});

/** Für Seiten: Login + Rolle prüfen, sonst umleiten. */
export async function erfordere(pfad: keyof typeof BEREICHE | string): Promise<Nutzer> {
  const n = await nutzer();
  if (!n) redirect("/login");
  if (!darf(n.rolle, pfad)) redirect(startseite(n.rolle));
  return n;
}

/** Für API-Routen. */
export async function apiNutzer(...rollen: Rolle[]): Promise<Nutzer | null> {
  const n = await nutzer();
  if (!n) return null;
  // Stufe 1 darf alles, was Stufe 2 (admin) darf
  if (rollen.length && !rollen.includes(n.rolle) && !(n.rolle === "superadmin" && rollen.includes("admin"))) return null;
  return n;
}
