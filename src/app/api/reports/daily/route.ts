import { NextResponse } from "next/server";
import { apiNutzer } from "@/lib/auth";
import { ladeDataset } from "@/lib/data";
import { morgenBriefing, sendeSlack } from "@/lib/reports/briefing";
import { cronOderAdmin, fehler, verboten } from "../../_lib/zugang";

export const runtime = "nodejs";
export const maxDuration = 120;

async function handler(req: Request) {
  const vorschau = new URL(req.url).searchParams.get("vorschau") === "1";
  if (vorschau ? !(await apiNutzer("admin", "management")) : !(await cronOderAdmin(req))) return verboten();
  try {
    const text = morgenBriefing(await ladeDataset({ frisch: true }));
    if (vorschau) return new NextResponse(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    const versand = await sendeSlack(text);
    return NextResponse.json({ ok: true, ...versand, text });
  } catch (e) {
    return fehler(e);
  }
}
export { handler as GET, handler as POST };
