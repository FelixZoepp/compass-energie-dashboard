import { NextResponse } from "next/server";
import { apiNutzer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { supabaseKonfiguriert } from "@/lib/supabase/env";
import { fehler, verboten } from "../_lib/zugang";

export const runtime = "nodejs";

/** Schalter der Close-Automatik (settings.data.automatik) – nur Stufe 1/2. */
export async function POST(req: Request) {
  if (!(await apiNutzer("admin"))) return verboten();
  if (!supabaseKonfiguriert()) return NextResponse.json({ ok: false, fehler: "Demo-Modus: Speichern erst nach Supabase-Anbindung möglich." }, { status: 409 });
  try {
    const { aktiv, regeln } = (await req.json()) as { aktiv?: boolean; regeln?: Record<string, boolean> };
    const sb = adminClient();
    const { data } = await sb.from("settings").select("data").eq("id", 1).maybeSingle();
    const alt = (data?.data ?? {}) as Record<string, unknown>;
    const altA = (alt.automatik ?? {}) as { aktiv?: boolean; regeln?: Record<string, boolean> };
    const automatik = {
      aktiv: aktiv ?? altA.aktiv ?? false,
      regeln: { ...(altA.regeln ?? {}), ...Object.fromEntries(Object.entries(regeln ?? {}).map(([k, v]) => [k, !!v])) },
    };
    const { error } = await sb.from("settings").upsert({ id: 1, data: { ...alt, automatik }, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, automatik });
  } catch (e) {
    return fehler(e);
  }
}
