import { NextResponse } from "next/server";
import { syncMeta } from "@/lib/meta/sync";
import { cacheLeeren } from "@/lib/data";
import { supabaseKonfiguriert } from "@/lib/supabase/env";
import { cronOderAdmin, fehler, verboten } from "../../_lib/zugang";

export const runtime = "nodejs";
export const maxDuration = 300;

async function handler(req: Request) {
  if (!(await cronOderAdmin(req))) return verboten();
  if (!supabaseKonfiguriert() || !process.env.META_ACCESS_TOKEN) return NextResponse.json({ ok: false, fehler: "Supabase oder META_ACCESS_TOKEN nicht konfiguriert" }, { status: 503 });
  const tage = Math.min(400, Math.max(1, Number(new URL(req.url).searchParams.get("tage") ?? "28") || 28));
  try {
    const erg = await syncMeta({ tage });
    cacheLeeren();
    return NextResponse.json({ ok: true, ...erg });
  } catch (e) {
    return fehler(e);
  }
}
export { handler as GET, handler as POST };
