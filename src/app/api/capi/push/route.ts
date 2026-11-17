import { NextResponse } from "next/server";
import { pushCapi } from "@/lib/capi/push";
import { supabaseKonfiguriert } from "@/lib/supabase/env";
import { cronOderAdmin, fehler, verboten } from "../../_lib/zugang";

export const runtime = "nodejs";
export const maxDuration = 120;

async function handler(req: Request) {
  if (!(await cronOderAdmin(req))) return verboten();
  const url = new URL(req.url);
  const trocken = url.searchParams.get("trocken") === "1";
  // Standardmäßig AUS – nur Trockenlauf (Vorschau) erlaubt
  if (process.env.CAPI_AKTIV !== "1" && !trocken) return NextResponse.json({ aktiv: false, hinweis: "CAPI_AKTIV=1 setzen, um Ereignisse an Meta zu senden. ?trocken=1 zeigt, was gesendet würde." });
  if (!supabaseKonfiguriert()) return NextResponse.json({ ok: false, fehler: "Supabase nicht konfiguriert" }, { status: 503 });
  try {
    const erg = await pushCapi({ testEventCode: url.searchParams.get("test_event_code"), trocken });
    return NextResponse.json({ ok: true, aktiv: process.env.CAPI_AKTIV === "1", trocken, ...erg });
  } catch (e) {
    return fehler(e);
  }
}
export { handler as GET, handler as POST };
