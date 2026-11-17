"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Columns3, X } from "lucide-react";
import { ampel, formatWert, type Einheit, type KpiId } from "@/lib/kpi/katalog";
import type { AdZeile } from "@/lib/kpi/engine";
import type { LeadKurz } from "@/lib/kpi/meta";
import type { Settings } from "@/lib/types";
import { AmpelZelle, CloseLink, cx } from "@/components/ui";

type SpaltenKey = "status" | "spend" | "cpm" | "hook" | "hold" | "ctr" | "cpc" | "leads" | "cpl" | "termine" | "kostenTermin" | "shows" | "kostenShow" | "abschluesse" | "umsatz" | "roas";

interface Spalte { key: SpaltenKey; label: string; einheit?: Einheit; kpi?: KpiId; basis?: (z: AdZeile) => number }

const SPALTEN: Spalte[] = [
  { key: "status", label: "Status" },
  { key: "spend", label: "Spend", einheit: "eur" },
  { key: "cpm", label: "CPM", einheit: "eur" },
  { key: "hook", label: "Hook", einheit: "pct", kpi: "hookRate", basis: (z) => z.impressions },
  { key: "hold", label: "Hold", einheit: "pct", kpi: "holdRate", basis: (z) => z.v3 },
  { key: "ctr", label: "CTR", einheit: "pct", kpi: "ctr", basis: (z) => z.impressions },
  { key: "cpc", label: "CPC", einheit: "eur", kpi: "cpc", basis: (z) => z.linkClicks },
  { key: "leads", label: "Leads", einheit: "zahl" },
  { key: "cpl", label: "CPL", einheit: "eur", kpi: "cpl", basis: (z) => z.leads },
  { key: "termine", label: "Termine", einheit: "zahl" },
  { key: "kostenTermin", label: "Kosten/Termin", einheit: "eur", kpi: "kostenTermin", basis: (z) => z.termine },
  { key: "shows", label: "Shows", einheit: "zahl" },
  { key: "kostenShow", label: "Kosten/Show", einheit: "eur", kpi: "kostenShow", basis: (z) => z.shows },
  { key: "abschluesse", label: "Abschlüsse", einheit: "zahl" },
  { key: "umsatz", label: "Umsatz", einheit: "eur" },
  { key: "roas", label: "ROAS", einheit: "faktor", kpi: "roas", basis: (z) => (z.spend >= 100 ? 99 : 0) },
];

const STANDARD: SpaltenKey[] = SPALTEN.map((s) => s.key);
const SPEICHER = "meta-tabelle-spalten";
const STATUS_TEXT: Record<string, string> = { ACTIVE: "Aktiv", PAUSED: "Pausiert", ARCHIVED: "Archiviert" };

function ladeAnsicht(): SpaltenKey[] | null {
  try {
    const v = localStorage.getItem(SPEICHER);
    if (!v) return null;
    const arr = JSON.parse(v) as SpaltenKey[];
    return Array.isArray(arr) ? arr.filter((k) => STANDARD.includes(k)) : null;
  } catch { return null; }
}

export function FunnelTabelle({ zeilen, leads, settings }: { zeilen: AdZeile[]; leads: Record<string, LeadKurz[]>; settings: Settings }) {
  const [sichtbar, setSichtbar] = useState<SpaltenKey[]>(STANDARD);
  const [menue, setMenue] = useState(false);
  const [sort, setSort] = useState<{ key: SpaltenKey | "name"; ab: boolean }>({ key: "spend", ab: true });
  const [offen, setOffen] = useState<Set<string>>(new Set());
  const [liste, setListe] = useState<{ titel: string; leads: LeadKurz[] } | null>(null);
  const [gespeichert, setGespeichert] = useState(false);

  // Gespeicherte Ansicht nach dem Mounten übernehmen (localStorage gibt es nur im Browser)
  useEffect(() => {
    const v = ladeAnsicht();
    if (v && v.length) queueMicrotask(() => setSichtbar(v));
  }, []);

  const kinder = useMemo(() => {
    const m = new Map<string, AdZeile[]>();
    for (const z of zeilen) if (z.parentId) (m.get(z.parentId) ?? m.set(z.parentId, []).get(z.parentId)!).push(z);
    return m;
  }, [zeilen]);

  const sortiere = (a: AdZeile[]) => [...a].sort((x, y) => {
    if (sort.key === "name") return sort.ab ? y.name.localeCompare(x.name) : x.name.localeCompare(y.name);
    const k = sort.key === "status" ? "spend" : sort.key;
    const vx = (x[k as keyof AdZeile] as number | null) ?? -Infinity, vy = (y[k as keyof AdZeile] as number | null) ?? -Infinity;
    return sort.ab ? vy - vx : vx - vy;
  });

  const kampagnen = sortiere(zeilen.filter((z) => z.ebene === "kampagne"));
  const spalten = SPALTEN.filter((s) => sichtbar.includes(s.key));
  const toggle = (id: string) => setOffen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const alleOffen = () => setOffen(new Set(zeilen.filter((z) => z.ebene !== "ad").map((z) => `${z.ebene}:${z.id}`)));

  const speichern = () => {
    try { localStorage.setItem(SPEICHER, JSON.stringify(sichtbar)); setGespeichert(true); setTimeout(() => setGespeichert(false), 1500); } catch { /* privat */ }
  };

  const zelle = (z: AdZeile, s: Spalte) => {
    if (s.key === "status") {
      const st = z.status ?? (z.ebene === "ad" ? "" : "");
      return st ? <span className={cx("rounded-full px-2 py-0.5 text-[11px]", st === "ACTIVE" ? "bg-good-soft text-good-ink" : "bg-grey-soft text-muted")}>{STATUS_TEXT[st] ?? st}</span> : <span className="text-muted">–</span>;
    }
    const v = z[s.key as keyof AdZeile] as number | null;
    const text = formatWert(v, s.einheit ?? "zahl");
    if (s.key === "leads" && z.leads > 0) {
      const ls = leads[`${z.ebene}:${z.id}`] ?? [];
      return <button type="button" onClick={() => setListe({ titel: z.name, leads: ls })} className="font-medium text-accent hover:underline">{text}</button>;
    }
    if (!s.kpi) return text;
    const a = ampel(s.kpi, v, s.basis?.(z), settings);
    return <AmpelZelle a={a}>{text}</AmpelZelle>;
  };

  const zeile = (z: AdZeile, tiefe: number): React.ReactNode => {
    const key = `${z.ebene}:${z.id}`;
    const hatKinder = z.ebene !== "ad" && (kinder.get(z.id)?.length ?? 0) > 0;
    const auf = offen.has(key);
    return (
      <Fragment key={key}>
        <tr className={cx("border-t border-line", z.ebene === "kampagne" ? "bg-surface-2/60 font-medium" : "", "hover:bg-surface-2")}>
          <td className="sticky left-0 z-[1] max-w-[280px] bg-surface py-2 pr-3" style={{ paddingLeft: 8 + tiefe * 16 }}>
            <div className="flex items-center gap-1.5">
              {hatKinder ? (
                <button type="button" onClick={() => toggle(key)} aria-label={auf ? "Zuklappen" : "Aufklappen"} className="rounded p-0.5 hover:bg-surface-2">
                  {auf ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              ) : <span className="w-5" />}
              <span className="truncate" title={z.name}>{z.name}</span>
            </div>
            <div className="pl-6 text-[10px] font-normal uppercase tracking-wide text-muted">{z.ebene === "kampagne" ? "Kampagne" : z.ebene === "adset" ? "Anzeigengruppe" : "Anzeige"}</div>
          </td>
          {spalten.map((s) => <td key={s.key} className="whitespace-nowrap px-2 py-2 text-right tabular">{zelle(z, s)}</td>)}
        </tr>
        {auf && sortiere(kinder.get(z.id) ?? []).map((k) => zeile(k, tiefe + 1))}
      </Fragment>
    );
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <button type="button" onClick={alleOffen} className="rounded-lg border border-line px-2 py-1 hover:bg-surface-2">Alle aufklappen</button>
        <button type="button" onClick={() => setOffen(new Set())} className="rounded-lg border border-line px-2 py-1 hover:bg-surface-2">Alle zuklappen</button>
        <div className="relative">
          <button type="button" onClick={() => setMenue((m) => !m)} className="flex items-center gap-1 rounded-lg border border-line px-2 py-1 hover:bg-surface-2"><Columns3 className="h-3.5 w-3.5" /> Spalten</button>
          {menue && (
            <div className="absolute left-0 top-8 z-30 w-56 rounded-lg border border-line bg-surface p-2 shadow-lg">
              <div className="grid grid-cols-2 gap-1">
                {SPALTEN.map((s) => (
                  <label key={s.key} className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-surface-2">
                    <input type="checkbox" checked={sichtbar.includes(s.key)} onChange={(e) => setSichtbar((v) => e.target.checked ? STANDARD.filter((k) => v.includes(k) || k === s.key) : v.filter((k) => k !== s.key))} />
                    {s.label}
                  </label>
                ))}
              </div>
              <div className="mt-2 flex gap-2 border-t border-line pt-2">
                <button type="button" onClick={speichern} className="rounded bg-accent px-2 py-1 text-white">{gespeichert ? "Gespeichert ✓" : "Als Ansicht speichern"}</button>
                <button type="button" onClick={() => setSichtbar(STANDARD)} className="rounded px-2 py-1 hover:bg-surface-2">Alle</button>
              </div>
            </div>
          )}
        </div>
        <span className="text-muted">Ampel gegen Ziel · grau = zu wenig Daten · Klick auf Leads öffnet die Liste</span>
      </div>
      <div className="scroll-x rounded-lg border border-line">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-ink-2">
            <tr>
              <th className="sticky left-0 z-[2] bg-surface-2 px-2 py-2 text-left">
                <button type="button" onClick={() => setSort((s) => ({ key: "name", ab: s.key === "name" ? !s.ab : false }))}>Name</button>
              </th>
              {spalten.map((s) => (
                <th key={s.key} className="whitespace-nowrap px-2 py-2 text-right">
                  <button type="button" onClick={() => setSort((x) => ({ key: s.key, ab: x.key === s.key ? !x.ab : true }))} className={cx(sort.key === s.key && "text-accent")}>
                    {s.label}{sort.key === s.key ? (sort.ab ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{kampagnen.map((k) => zeile(k, 0))}</tbody>
        </table>
      </div>
      {liste && <LeadListe titel={liste.titel} leads={liste.leads} zu={() => setListe(null)} />}
    </div>
  );
}

function LeadListe({ titel, leads, zu }: { titel: string; leads: LeadKurz[]; zu: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && zu();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [zu]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={zu} role="dialog" aria-modal="true" aria-label={`Leads aus ${titel}`}>
      <div className="flex h-full w-full max-w-md flex-col bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line p-4">
          <div className="min-w-0"><div className="text-xs text-muted">Leads ({leads.length})</div><div className="truncate font-semibold">{titel}</div></div>
          <button type="button" onClick={zu} aria-label="Schließen" className="rounded p-1 hover:bg-surface-2"><X className="h-4 w-4" /></button>
        </div>
        <ul className="flex-1 divide-y divide-[var(--border)] overflow-y-auto">
          {leads.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <CloseLink leadId={l.id}>{l.name}</CloseLink>
                <div className="text-xs text-muted">{new Date(l.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })} · {l.status}</div>
              </div>
              <div className="flex shrink-0 gap-1 text-[10px]">
                {l.termin && <span className="rounded bg-grey-soft px-1.5 py-0.5 text-ink-2">Termin</span>}
                {l.show && <span className="rounded bg-grey-soft px-1.5 py-0.5 text-ink-2">Show</span>}
                {l.gewonnen && <span className="rounded bg-good-soft px-1.5 py-0.5 text-good-ink">Gewonnen</span>}
              </div>
            </li>
          ))}
          {!leads.length && <li className="p-4 text-sm text-muted">Keine Leads im Zeitraum.</li>}
        </ul>
      </div>
    </div>
  );
}
