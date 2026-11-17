import { NextResponse } from "next/server";
import { signaturGueltig, verarbeiteEvent } from "@/lib/close/webhook";
import { cacheLeeren } from "@/lib/data";
import { adminClient } from "@/lib/supabase/admin";
import { supabaseKonfiguriert } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const raw = await req.text();
  if (!signaturGueltig(raw, req.headers.get("close-sig-timestamp"), req.headers.get("close-sig-hash"))) {
    return NextResponse.json({ fehler: "Signatur ungültig" }, { status: 401 });
  }
  if (!supabaseKonfiguriert() || !process.env.CLOSE_API_KEY) return NextResponse.json({ fehler: "nicht konfiguriert" }, { status: 503 });
  let body: { event?: Record<string, unknown> };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ fehler: "kein JSON" }, { status: 400 }); }
  const ev = body.event ?? {};
  try {
    const was = await verarbeiteEvent(ev);
    cacheLeeren();
    return NextResponse.json({ ok: true, was });
  } catch (e) {
    // Fehler protokollieren, aber 200 zurückgeben, damit Close nicht endlos wiederholt; 15-Min-Sync holt es nach.
    await adminClient().from("sync_runs").insert({ quelle: "webhook", finished_at: new Date().toISOString(), ok: false, fehler: (e as Error).message.slice(0, 500), details: { object_type: ev.object_type, object_id: ev.object_id } });
    return NextResponse.json({ ok: false, fehler: (e as Error).message });
  }
}
