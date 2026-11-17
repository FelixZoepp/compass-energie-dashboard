import { NextResponse } from "next/server";
import { apiNutzer, darfVerwalten } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { supabaseKonfiguriert } from "@/lib/supabase/env";
import { fehler, verboten } from "../_lib/zugang";

export const runtime = "nodejs";
const ROLLEN = ["superadmin", "admin", "management", "marketing", "rep"];

export async function GET() {
  if (!(await apiNutzer("admin"))) return verboten();
  if (!supabaseKonfiguriert()) return NextResponse.json([]);
  const { data, error } = await adminClient().from("profiles").select("id,email,name,rolle,rep_id,aktiv,created_at").order("created_at");
  if (error) return fehler(error);
  return NextResponse.json(data);
}

/** Nutzer einladen: Supabase schickt eine Einladungs-Mail mit Link zum Passwort-Setzen. */
export async function POST(req: Request) {
  const ich = await apiNutzer("admin");
  if (!ich) return verboten();
  if (!supabaseKonfiguriert()) return NextResponse.json({ ok: false, fehler: "Demo-Modus" }, { status: 409 });
  try {
    const { email, name, rolle, repId } = (await req.json()) as { email: string; name?: string; rolle: string; repId?: string | null };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email ?? "")) return NextResponse.json({ ok: false, fehler: "E-Mail ungültig" }, { status: 400 });
    if (!ROLLEN.includes(rolle)) return NextResponse.json({ ok: false, fehler: "Rolle ungültig" }, { status: 400 });
    if (!darfVerwalten(ich.rolle, rolle)) return NextResponse.json({ ok: false, fehler: "Diese Stufe darf nur Stufe 1 vergeben." }, { status: 403 });
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const sb = adminClient();
    const { data, error } = await sb.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), { redirectTo: `${origin}/auth/callback?weiter=/passwort` });
    if (error) throw new Error(error.message);
    const { error: e2 } = await sb.from("profiles").upsert({ id: data.user.id, email: email.trim().toLowerCase(), name: name || email, rolle, rep_id: repId || null, aktiv: true });
    if (e2) throw new Error(e2.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fehler(e);
  }
}

export async function PATCH(req: Request) {
  const ich = await apiNutzer("admin");
  if (!ich) return verboten();
  if (!supabaseKonfiguriert()) return NextResponse.json({ ok: false, fehler: "Demo-Modus" }, { status: 409 });
  try {
    const { id, rolle, repId, aktiv, name } = (await req.json()) as { id: string; rolle?: string; repId?: string | null; aktiv?: boolean; name?: string };
    if (id === ich.id && ((rolle && rolle !== ich.rolle) || aktiv === false)) return NextResponse.json({ ok: false, fehler: "Die eigene Stufe kann nicht geändert werden." }, { status: 400 });
    const { data: ziel } = await adminClient().from("profiles").select("rolle").eq("id", id).maybeSingle();
    if (ziel && !darfVerwalten(ich.rolle, ziel.rolle)) return NextResponse.json({ ok: false, fehler: "Personen höherer Stufe kann nur Stufe 1 bearbeiten." }, { status: 403 });
    if (rolle && !darfVerwalten(ich.rolle, rolle)) return NextResponse.json({ ok: false, fehler: "Diese Stufe darf nur Stufe 1 vergeben." }, { status: 403 });
    const upd: Record<string, unknown> = {};
    if (rolle) { if (!ROLLEN.includes(rolle)) return NextResponse.json({ ok: false, fehler: "Rolle ungültig" }, { status: 400 }); upd.rolle = rolle; }
    if (repId !== undefined) upd.rep_id = repId || null;
    if (aktiv !== undefined) upd.aktiv = aktiv;
    if (name !== undefined) upd.name = name;
    const { error } = await adminClient().from("profiles").update(upd).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fehler(e);
  }
}
