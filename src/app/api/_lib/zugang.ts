import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { apiNutzer } from "@/lib/auth";

/** Cron-Aufruf (Vercel sendet Authorization: Bearer CRON_SECRET) oder eingeloggter Admin. */
export async function cronOderAdmin(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (secret && auth.startsWith("Bearer ")) {
    const a = Buffer.from(auth.slice(7));
    const b = Buffer.from(secret);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return !!(await apiNutzer("admin"));
}

export const verboten = () => NextResponse.json({ fehler: "nicht berechtigt" }, { status: 401 });
export const fehler = (e: unknown, status = 500) => NextResponse.json({ ok: false, fehler: (e as Error).message }, { status });
