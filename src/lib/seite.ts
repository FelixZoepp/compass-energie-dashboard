import "server-only";
import { erfordere, type Nutzer } from "./auth";
import { ladeDataset } from "./data";
import { vergleichsZeitraum, zeitraum, type Vergleich, type ZeitraumKey } from "./kpi/zeit";
import type { Filter, Sicht } from "./kpi/engine";
import type { Dataset, Kundentyp, Quelle } from "./types";

export type SP = Promise<Record<string, string | string[] | undefined>>;

export interface SeitenKontext {
  ds: Dataset;
  f: Filter;
  vf: Filter | null; // Vergleichsfilter
  nutzer: Nutzer;
  params: Record<string, string>;
}

const eins = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Standard-Einstieg jeder Dashboard-Seite: Rechte prüfen, Filter lesen, Daten laden. */
export async function seite(pfad: string, sp: SP, defaults: { zeitraum?: ZeitraumKey } = {}): Promise<SeitenKontext> {
  const nutzer = await erfordere(pfad);
  const raw = await sp;
  const params = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, eins(v)]));
  const ds = await ladeDataset({ frisch: params.frisch === "1" });
  const z = zeitraum((params.z as ZeitraumKey) || defaults.zeitraum || "monat", new Date(), { von: params.von, bis: params.bis });
  const f: Filter = {
    zeitraum: z,
    sicht: (params.sicht as Sicht) === "kohorte" ? "kohorte" : "ereignis",
    quelle: (params.quelle as Quelle) || null,
    kampagne: params.kampagne || null,
    rep: nutzer.rolle === "rep" ? nutzer.repId ?? "__keiner__" : params.rep || null,
    kundentyp: (params.typ as Kundentyp) || null,
  };
  const vz = vergleichsZeitraum(z, (params.vgl as Vergleich) || "vorperiode");
  return { ds, f, vf: vz ? { ...f, zeitraum: vz } : null, nutzer, params };
}

export function delta(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return (a - b) / Math.abs(b);
}
