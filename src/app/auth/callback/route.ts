import { NextResponse } from "next/server";
import { sessionClient } from "@/lib/supabase/server";

// Ziel für Einladungs- und Passwort-Links aus Supabase-Mails
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) await (await sessionClient()).auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(url.searchParams.get("weiter") || "/passwort", req.url));
}
