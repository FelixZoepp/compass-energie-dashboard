import { NextResponse } from "next/server";
import { apiNutzer } from "@/lib/auth";
import { cacheLeeren, ladeSettings, mergeSettings } from "@/lib/data";
import { adminClient } from "@/lib/supabase/admin";
import { supabaseKonfiguriert } from "@/lib/supabase/env";
import type { Settings } from "@/lib/types";
import { fehler, verboten } from "../_lib/zugang";

export const runtime = "nodejs";

export async function GET() {
  if (!(await apiNutzer("admin"))) return verboten();
  return NextResponse.json(await ladeSettings());
}

const zahl = (v: unknown, def: number, min = -Infinity, max = Infinity) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

/** Validiert und normalisiert eingehende Einstellungen. */
function bereinigen(input: Partial<Settings>): Settings {
  const basis = mergeSettings(input);
  const zahlenMap = (o: Record<string, unknown> | undefined) =>
    Object.fromEntries(Object.entries(o ?? {}).filter(([k, v]) => /^\d{4}-\d{2}$/.test(k) && Number(v) > 0).map(([k, v]) => [k, Number(v)]));
  return {
    ...basis,
    monatsziel: zahlenMap(input.monatsziel as Record<string, unknown>),
    repZiele: Object.fromEntries(Object.entries(basis.repZiele).map(([id, z]) => [id, Object.fromEntries(Object.entries(z ?? {}).filter(([, v]) => v != null && Number(v) >= 0).map(([k, v]) => [k, Number(v)]))])),
    schwellen: Object.fromEntries(Object.entries(basis.schwellen).filter(([, s]) => s && Number.isFinite(Number(s.gruen)) && Number.isFinite(Number(s.gelb))).map(([k, s]) => [k, { gruen: Number(s.gruen), gelb: Number(s.gelb) }])),
    provisionsquote: zahl(basis.provisionsquote, 0.1, 0, 1),
    toolkostenMonat: zahl(basis.toolkostenMonat, 0, 0),
    lieferkostenProTeilnehmer: zahl(basis.lieferkostenProTeilnehmer, 0, 0),
    icpMinTeam: zahl(basis.icpMinTeam, 3, 0),
    arbeitszeit: {
      start: zahl(basis.arbeitszeit.start, 8, 0, 23),
      ende: zahl(basis.arbeitszeit.ende, 19, 1, 24),
      tage: (basis.arbeitszeit.tage ?? []).map(Number).filter((t) => t >= 1 && t <= 7),
    },
    stageWahrscheinlichkeit: Object.fromEntries(Object.entries(basis.stageWahrscheinlichkeit).map(([k, v]) => [k, zahl(v, 0, 0, 1)])) as Settings["stageWahrscheinlichkeit"],
    listenpreise: Object.fromEntries(Object.entries(basis.listenpreise).map(([k, v]) => [k, zahl(v, 0, 0)])),
  };
}

export async function POST(req: Request) {
  if (!(await apiNutzer("admin"))) return verboten();
  if (!supabaseKonfiguriert()) return NextResponse.json({ ok: false, fehler: "Demo-Modus: Speichern erst nach Supabase-Anbindung möglich." }, { status: 409 });
  try {
    const body = (await req.json()) as { settings?: Partial<Settings>; reps?: { id: string; rolle: string; aktiv: boolean }[] };
    const sb = adminClient();
    if (body.settings) {
      // Felder, die andere Bereiche verwalten (z. B. automatik), beim Speichern erhalten
      const { data: alt } = await sb.from("settings").select("data").eq("id", 1).maybeSingle();
      const behalten = { automatik: (alt?.data as Record<string, unknown> | undefined)?.automatik };
      const { error } = await sb.from("settings").upsert({ id: 1, data: { ...bereinigen(body.settings), ...behalten }, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    }
    for (const r of body.reps ?? []) {
      if (!["setter", "closer", "beides"].includes(r.rolle)) continue;
      const { error } = await sb.from("reps").update({ rolle: r.rolle, aktiv: !!r.aktiv, updated_at: new Date().toISOString() }).eq("id", r.id);
      if (error) throw new Error(error.message);
    }
    cacheLeeren();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fehler(e);
  }
}
