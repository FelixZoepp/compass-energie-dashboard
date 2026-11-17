import { NextResponse } from "next/server";
import { cacheLeeren } from "@/lib/data";
import { cronOderAdmin, verboten } from "../_lib/zugang";

export const runtime = "nodejs";

// KPIs werden aus den Rohtabellen berechnet; „Views auffrischen“ = Server-Cache leeren.
async function handler(req: Request) {
  if (!(await cronOderAdmin(req))) return verboten();
  cacheLeeren();
  return NextResponse.json({ ok: true });
}
export { handler as GET, handler as POST };
