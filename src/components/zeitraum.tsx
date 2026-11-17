"use client";
// Zeitraum-Pillen (Heute · Woche · Monat · 30 Tage · Gesamt), „Weitere …“ und Filter-Popover.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { zeitraum, ZEITRAUM_LABEL, type ZeitraumKey } from "@/lib/kpi/zeit";

export interface DatenInfo {
  start: string | null; // frühestes Datum in den Daten (für „Gesamt“)
  kampagnen: { id: string; name: string }[];
  reps: { id: string; name: string }[];
  zeigeRep: boolean;
}
const Ctx = createContext<DatenInfo>({ start: null, kampagnen: [], reps: [], zeigeRep: false });
export function DatenProvider({ wert, children }: { wert: DatenInfo; children: ReactNode }) {
  return <Ctx.Provider value={wert}>{children}</Ctx.Provider>;
}
export const useDatenInfo = () => useContext(Ctx);

const HAUPT: ZeitraumKey[] = ["heute", "woche", "monat", "30t", "gesamt"];
const WEITERE: ZeitraumKey[] = ["gestern", "7t", "vormonat", "90t", "quartal", "frei"];
const KURZ: Partial<Record<ZeitraumKey, string>> = { woche: "Woche", monat: "Monat", "30t": "30 Tage" };

function useSetzen() {
  const router = useRouter();
  const pfad = usePathname();
  const sp = useSearchParams();
  const [laedt, start] = useTransition();
  const set = (werte: Record<string, string>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(werte)) { if (v) p.set(k, v); else p.delete(k); }
    p.delete("frisch");
    start(() => router.push(`${pfad}?${p.toString()}`, { scroll: false }));
  };
  return { sp, set, laedt };
}

const datum = (d: Date) => d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

export function ZeitraumText() {
  const sp = useSearchParams();
  const info = useDatenInfo();
  const key = (sp.get("z") as ZeitraumKey) || "monat";
  const z = zeitraum(key, new Date(), { von: key === "gesamt" ? info.start ?? undefined : sp.get("von") ?? undefined, bis: sp.get("bis") ?? undefined });
  const bis = new Date(z.bis.getTime() - 86400000);
  const prefix = key === "gesamt" ? "Seit Start" : ZEITRAUM_LABEL[key];
  return <p className="mt-3 text-[13px] font-semibold text-ink">{prefix}: {datum(z.von)}{+z.von !== +bis ? ` bis ${datum(bis)}` : ""}</p>;
}

const sel = "h-10 rounded-full border border-[var(--glass-border)] bg-[var(--glass-strong)] px-4 text-[14px] text-ink outline-none shadow-[inset_0_1px_0_var(--glass-edge)] backdrop-blur focus:border-accent";

export function ZeitraumPillen() {
  const { sp, set, laedt } = useSetzen();
  const info = useDatenInfo();
  const [offen, setOffen] = useState(false);
  const z = (sp.get("z") as ZeitraumKey) || "monat";
  const aktiveFilter = ["quelle", "kampagne", "rep", "typ", "sicht", "vgl"].filter((k) => sp.get(k)).length;
  return (
    <div className="no-print relative flex w-full min-w-0 flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
      <div className="glass flex max-w-full overflow-x-auto rounded-full p-1" role="group" aria-label="Zeitraum">
        {HAUPT.map((k) => (
          <button key={k} type="button" onClick={() => set({ z: k === "monat" ? "" : k, von: "", bis: "" })}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-[14px] font-medium transition ${z === k ? "liquid-pill-aktiv" : "text-ink hover:bg-surface-2"}`}>
            {KURZ[k] ?? ZEITRAUM_LABEL[k]}
          </button>
        ))}
      </div>
      <select aria-label="Weitere Zeiträume" className={`${sel} min-w-[140px]`} value={WEITERE.includes(z) ? z : ""} onChange={(e) => set({ z: e.target.value })}>
        <option value="" disabled>Weitere …</option>
        {WEITERE.map((k) => <option key={k} value={k}>{ZEITRAUM_LABEL[k]}</option>)}
      </select>
      <button type="button" onClick={() => setOffen((o) => !o)} aria-expanded={offen}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-strong)] px-4 text-[14px] text-ink shadow-[inset_0_1px_0_var(--glass-edge)] backdrop-blur hover:border-accent">
        <SlidersHorizontal className="h-4 w-4" /> Filter{aktiveFilter ? <span className="rounded-full bg-brand-700 px-1.5 text-[11px] text-white">{aktiveFilter}</span> : null}
      </button>
      {laedt && <span className="text-xs text-muted">lädt …</span>}
      {z === "frei" && (
        <div className="flex w-full gap-2 xl:justify-end">
          <input type="date" aria-label="Von" className={sel} value={sp.get("von") ?? ""} onChange={(e) => set({ von: e.target.value })} />
          <input type="date" aria-label="Bis" className={sel} value={sp.get("bis") ?? ""} onChange={(e) => set({ bis: e.target.value })} />
        </div>
      )}
      {offen && (
        <div className="glass glass-strong absolute right-0 top-12 z-40 w-[min(92vw,360px)] rounded-[28px] p-5 shadow-2xl">
          <div className="mb-3 flex items-center justify-between"><span className="font-semibold">Filter</span>
            <button type="button" aria-label="Schließen" onClick={() => setOffen(false)} className="rounded-full p-1 hover:bg-surface-2"><X className="h-4 w-4" /></button></div>
          <div className="flex flex-col gap-3 text-[13px] text-ink-2">
            <label className="flex flex-col gap-1">Zeitlogik
              <div className="inline-flex rounded-full border border-line p-1">
                {(["ereignis", "kohorte"] as const).map((s) => {
                  const aktiv = (sp.get("sicht") ?? "ereignis") === s;
                  return <button key={s} type="button" onClick={() => set({ sicht: s === "ereignis" ? "" : s })}
                    className={`flex-1 rounded-full px-3 py-1.5 text-[13px] ${aktiv ? "liquid-pill-aktiv" : "text-ink"}`}
                    title={s === "ereignis" ? "Jedes Ereignis zählt an seinem Datum" : "Alles wird dem Eintragungsdatum des Leads zugeordnet"}>
                    {s === "ereignis" ? "Ereignis" : "Kohorte (Lead-Datum)"}</button>;
                })}
              </div>
            </label>
            <label className="flex flex-col gap-1">Vergleich
              <select className={sel} value={sp.get("vgl") ?? ""} onChange={(e) => set({ vgl: e.target.value })}>
                <option value="">Vorperiode</option><option value="vorjahr">Vorjahr</option><option value="aus">aus</option>
              </select></label>
            <label className="flex flex-col gap-1">Quelle
              <select className={sel} value={sp.get("quelle") ?? ""} onChange={(e) => set({ quelle: e.target.value })}>
                <option value="">Alle Quellen</option><option value="meta">Meta</option><option value="linkedin">LinkedIn</option>
                <option value="empfehlung">Empfehlung</option><option value="kaltakquise">Kaltakquise</option><option value="organisch">Organisch</option><option value="sonstige">Sonstige</option>
              </select></label>
            {info.kampagnen.length > 0 && (
              <label className="flex flex-col gap-1">Kampagne
                <select className={sel} value={sp.get("kampagne") ?? ""} onChange={(e) => set({ kampagne: e.target.value })}>
                  <option value="">Alle Kampagnen</option>{info.kampagnen.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select></label>
            )}
            {info.zeigeRep && (
              <label className="flex flex-col gap-1">Mitarbeiter
                <select className={sel} value={sp.get("rep") ?? ""} onChange={(e) => set({ rep: e.target.value })}>
                  <option value="">Alle</option>{info.reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select></label>
            )}
            <label className="flex flex-col gap-1">Kundentyp
              <select className={sel} value={sp.get("typ") ?? ""} onChange={(e) => set({ typ: e.target.value })}>
                <option value="">B2B + B2C</option><option value="B2B">B2B</option><option value="B2C">B2C</option>
              </select></label>
            {aktiveFilter > 0 && <button type="button" onClick={() => set({ quelle: "", kampagne: "", rep: "", typ: "", sicht: "", vgl: "" })} className="text-left text-accent">Alle Filter zurücksetzen</button>}
          </div>
        </div>
      )}
    </div>
  );
}
