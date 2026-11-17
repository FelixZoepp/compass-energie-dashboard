import { NextResponse } from "next/server";
import { syncMetaCreatives } from "@/lib/meta/sync";
import { cacheLeeren } from "@/lib/data";
import { supabaseKonfiguriert } from "@/lib/supabase/env";
import { cronOderAdmin, fehler, verboten } from "../../_lib/zugang";

export const runtime = "nodejs";
export const maxDuration = 300;

async function handler(req: Request) {
  if (!(await cronOderAdmin(req))) return verboten();
  if (!supabaseKonfiguriert() || !process.env.META_ACCESS_TOKEN) return NextResponse.json({ ok: false, fehler: "Supabase oder META_ACCESS_TOKEN nicht konfiguriert" }, { status: 503 });
  try {
    const erg = await syncMetaCreatives();
    cacheLeeren();
    return NextResponse.json({ ok: true, ...erg });
  } catch (e) {
    return fehler(e);
  }
}
export { handler as GET, handler as POST };
