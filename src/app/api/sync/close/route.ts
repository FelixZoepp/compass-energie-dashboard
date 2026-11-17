import { NextResponse } from "next/server";
import { syncClose } from "@/lib/close/sync";
import { cacheLeeren } from "@/lib/data";
import { supabaseKonfiguriert } from "@/lib/supabase/env";
import { cronOderAdmin, fehler, verboten } from "../../_lib/zugang";
import { mitSperre } from "@/lib/close/webhook";

export const runtime = "nodejs";
export const maxDuration = 300;

async function handler(req: Request) {
  if (!(await cronOderAdmin(req))) return verboten();
  if (!supabaseKonfiguriert() || !process.env.CLOSE_API_KEY) return NextResponse.json({ ok: false, fehler: "Supabase oder CLOSE_API_KEY nicht konfiguriert" }, { status: 503 });
  const voll = new URL(req.url).searchParams.get("voll") === "1";
  try {
    const erg = await mitSperre("close_sync_lock", 600, () => syncClose({ voll }));
    cacheLeeren();
    return NextResponse.json({ ok: true, ...(erg ?? { uebersprungen: "läuft bereits" }) });
  } catch (e) {
    return fehler(e);
  }
}
export { handler as GET, handler as POST };
