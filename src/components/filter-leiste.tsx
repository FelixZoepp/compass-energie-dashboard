"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { ZEITRAUM_LABEL, type ZeitraumKey } from "@/lib/kpi/zeit";

export interface FilterOptionen {
  kampagnen: { id: string; name: string }[];
  reps: { id: string; name: string }[];
  zeigeRep: boolean;
}

const ZEITRAEUME: ZeitraumKey[] = ["heute", "gestern", "woche", "7t", "monat", "vormonat", "30t", "90t", "quartal", "frei"];

const sel = "h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink outline-none focus:border-accent";

export function FilterLeiste({ optionen, standText }: { optionen: FilterOptionen; standText: string }) {
  const router = useRouter();
  const pfad = usePathname();
  const sp = useSearchParams();
  const [laedt, start] = useTransition();
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v); else p.delete(k);
    p.delete("frisch");
    start(() => router.push(`${pfad}?${p.toString()}`, { scroll: false }));
  };
  const z = sp.get("z") || "monat";
  return (
    <div className="no-print sticky top-0 z-20 -mx-4 mb-4 border-b border-line bg-page/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Zeitraum" className={sel} value={z} onChange={(e) => set("z", e.target.value)}>
          {ZEITRAEUME.map((k) => <option key={k} value={k}>{ZEITRAUM_LABEL[k]}</option>)}
        </select>
        {z === "frei" && (
          <>
            <input type="date" aria-label="Von" className={sel} value={sp.get("von") ?? ""} onChange={(e) => set("von", e.target.value)} />
            <input type="date" aria-label="Bis" className={sel} value={sp.get("bis") ?? ""} onChange={(e) => set("bis", e.target.value)} />
          </>
        )}
        <select aria-label="Vergleich" className={sel} value={sp.get("vgl") ?? "vorperiode"} onChange={(e) => set("vgl", e.target.value === "vorperiode" ? "" : e.target.value)}>
          <option value="vorperiode">Vergleich: Vorperiode</option>
          <option value="vorjahr">Vergleich: Vorjahr</option>
          <option value="aus">Vergleich: aus</option>
        </select>
        <select aria-label="Quelle" className={sel} value={sp.get("quelle") ?? ""} onChange={(e) => set("quelle", e.target.value)}>
          <option value="">Alle Quellen</option>
          <option value="meta">Meta</option>
          <option value="linkedin">LinkedIn</option>
          <option value="empfehlung">Empfehlung</option>
          <option value="kaltakquise">Kaltakquise</option>
          <option value="organisch">Organisch</option>
          <option value="sonstige">Sonstige</option>
        </select>
        {optionen.kampagnen.length > 0 && (
          <select aria-label="Kampagne" className={`${sel} max-w-[200px]`} value={sp.get("kampagne") ?? ""} onChange={(e) => set("kampagne", e.target.value)}>
            <option value="">Alle Kampagnen</option>
            {optionen.kampagnen.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        )}
        {optionen.zeigeRep && (
          <select aria-label="Rep" className={sel} value={sp.get("rep") ?? ""} onChange={(e) => set("rep", e.target.value)}>
            <option value="">Alle Reps</option>
            {optionen.reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        <select aria-label="Kundentyp" className={sel} value={sp.get("typ") ?? ""} onChange={(e) => set("typ", e.target.value)}>
          <option value="">B2B + B2C</option>
          <option value="B2B">B2B</option>
          <option value="B2C">B2C</option>
        </select>
        <div className="inline-flex h-8 overflow-hidden rounded-lg border border-line text-[13px]" role="group" aria-label="Zeitlogik">
          {(["ereignis", "kohorte"] as const).map((s) => {
            const aktiv = (sp.get("sicht") ?? "ereignis") === s;
            return (
              <button key={s} type="button" onClick={() => set("sicht", s === "ereignis" ? "" : s)}
                className={`px-2.5 ${aktiv ? "bg-accent text-white" : "bg-surface text-ink-2 hover:bg-surface-2"}`}
                title={s === "ereignis" ? "Jedes Ereignis zählt an seinem Datum" : "Alles wird dem Eintragungsdatum des Leads zugeordnet"}>
                {s === "ereignis" ? "Ereignis" : "Kohorte"}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted">
          {laedt && <span>lädt …</span>}
          <span>{standText}</span>
          <button type="button" aria-label="Neu laden" onClick={() => { const p = new URLSearchParams(sp.toString()); p.set("frisch", "1"); start(() => router.replace(`${pfad}?${p}`)); }}
            className="rounded p-1 hover:bg-surface-2"><RefreshCw className={`h-3.5 w-3.5 ${laedt ? "animate-spin" : ""}`} /></button>
        </div>
      </div>
    </div>
  );
}
