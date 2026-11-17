import { NextResponse } from "next/server";
import { apiNutzer } from "@/lib/auth";
import { syncClose } from "@/lib/close/sync";
import { mitSperre } from "@/lib/close/webhook";
import { syncMeta, syncMetaCreatives } from "@/lib/meta/sync";
import { cacheLeeren } from "@/lib/data";
import { supabaseKonfiguriert } from "@/lib/supabase/env";
import { fehler, verboten } from "../../_lib/zugang";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Manueller Sync aus den Einstellungen (nur Admin). */
export async function POST(req: Request) {
  if (!(await apiNutzer("admin"))) return verboten();
  if (!supabaseKonfiguriert()) return NextResponse.json({ ok: false, fehler: "Demo-Modus: Supabase nicht verbunden." }, { status: 409 });
  const { quelle, voll } = (await req.json().catch(() => ({}))) as { quelle?: string; voll?: boolean };
  try {
    let erg: unknown;
    if (quelle === "close") erg = (await mitSperre("close_sync_lock", 600, () => syncClose({ voll }))) ?? { uebersprungen: "läuft bereits" };
    else if (quelle === "meta") { const c = await syncMetaCreatives(); const i = await syncMeta({ tage: voll ? 90 : 28 }); erg = { ...c, ...i }; }
    else return NextResponse.json({ ok: false, fehler: "quelle muss close oder meta sein" }, { status: 400 });
    cacheLeeren();
    return NextResponse.json({ ok: true, erg });
  } catch (e) {
    return fehler(e);
  }
}
