import { NextResponse } from "next/server";
import { supabaseKonfiguriert } from "@/lib/supabase/env";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const konfig = {
    supabase: supabaseKonfiguriert(),
    close: !!process.env.CLOSE_API_KEY,
    closeWebhook: !!process.env.CLOSE_WEBHOOK_SECRET,
    meta: !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID),
    capi: process.env.CAPI_AKTIV === "1",
    reports: process.env.REPORTS_AKTIV === "1",
    cronSecret: !!process.env.CRON_SECRET,
  };
  let letzteSyncs: unknown = null;
  if (konfig.supabase) {
    const { data, error } = await adminClient().from("sync_runs").select("quelle,started_at,finished_at,ok").order("started_at", { ascending: false }).limit(10);
    letzteSyncs = error ? { fehler: error.message } : data;
  }
  return NextResponse.json({ ok: true, modus: konfig.supabase ? "live" : "demo", konfig, letzteSyncs, zeit: new Date().toISOString() });
}
