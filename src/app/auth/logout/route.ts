import { NextResponse } from "next/server";
import { sessionClient } from "@/lib/supabase/server";
import { supabaseKonfiguriert } from "@/lib/supabase/env";

export async function POST(req: Request) {
  if (supabaseKonfiguriert()) await (await sessionClient()).auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
