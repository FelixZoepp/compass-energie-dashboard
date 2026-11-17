// Gemeinsame Bausteine. Server-tauglich (keine Hooks).
import Link from "next/link";
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { KPIS, ampel as ampelFn, formatWert, zielText, type Ampel, type KpiDef, type KpiId } from "@/lib/kpi/katalog";
import type { Settings } from "@/lib/types";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export function Card({ children, className, titel, aktion, id }: { children: ReactNode; className?: string; titel?: ReactNode; aktion?: ReactNode; id?: string }) {
  return (
    <section id={id} className={cx("card p-4 sm:p-5 min-w-0", className)}>
      {(titel || aktion) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {titel && <h2 className="text-sm font-semibold text-ink">{titel}</h2>}
          {aktion}
        </div>
      )}
      {children}
    </section>
  );
}

/** Seitenkopf mit Klartext-Antwort („Antworten statt Zahlenfriedhof“). */
export function SeitenKopf({ titel, klartext, children }: { titel: string; klartext?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{titel}</h1>
        {klartext && <p className="mt-1 text-[15px] text-ink-2">{klartext}</p>}
      </div>
      {children}
    </div>
  );
}

const AMPEL_KLASSE: Record<Ampel, string> = {
  gruen: "bg-good-soft text-good-ink",
  gelb: "bg-warn-soft text-warn-ink",
  rot: "bg-bad-soft text-bad-ink",
  grau: "bg-grey-soft text-muted",
  neutral: "bg-grey-soft text-ink-2",
};
const AMPEL_PUNKT: Record<Ampel, string> = { gruen: "bg-good", gelb: "bg-warn", rot: "bg-bad", grau: "bg-muted", neutral: "bg-muted" };
const AMPEL_TEXT: Record<Ampel, string> = { gruen: "im Ziel", gelb: "knapp", rot: "unter Ziel", grau: "zu wenig Daten", neutral: "" };

/** Ampel immer mit Text, nie nur Farbe. */
export function AmpelPill({ a, text }: { a: Ampel; text?: string }) {
  if (a === "neutral" && !text) return null;
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", AMPEL_KLASSE[a])}>
      <span className={cx("h-1.5 w-1.5 rounded-full", AMPEL_PUNKT[a])} aria-hidden />
      {text ?? AMPEL_TEXT[a]}
    </span>
  );
}

export function AmpelZelle({ a, children }: { a: Ampel; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded px-1.5 py-0.5", a === "neutral" ? "" : AMPEL_KLASSE[a])} title={AMPEL_TEXT[a] || undefined}>
      {a !== "neutral" && a !== "grau" && <span className={cx("h-1.5 w-1.5 rounded-full", AMPEL_PUNKT[a])} aria-hidden />}
      {children}
    </span>
  );
}

export function InfoTip({ def }: { def: KpiDef }) {
  return (
    <span className="group relative inline-flex">
      <Info className="h-3.5 w-3.5 text-muted" aria-label={`Definition ${def.label}`} />
      <span className="pointer-events-none absolute left-1/2 top-5 z-30 hidden w-64 -translate-x-1/2 rounded-lg border border-line bg-surface p-3 text-left text-xs font-normal text-ink-2 shadow-lg group-hover:block">
        <span className="block font-semibold text-ink">{def.label}</span>
        <span className="mt-1 block">Formel: {def.formel}</span>
        <span className="mt-0.5 block">Quelle: {def.quelle}</span>
        {def.minBasis != null && <span className="mt-0.5 block">Mindestbasis: {def.minBasis}</span>}
      </span>
    </span>
  );
}

function Sparkline({ werte }: { werte: number[] }) {
  if (werte.length < 2 || werte.every((w) => w === 0)) return null;
  const max = Math.max(...werte), min = Math.min(...werte);
  const w = 120, h = 22;
  const pts = werte.map((v, i) => `${(i / (werte.length - 1)) * w},${h - 2 - ((v - min) / (max - min || 1)) * (h - 4)}`).join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="overflow-visible" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--s1)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function DeltaText({ d, richtung = "hoch", label }: { d: number | null; richtung?: "hoch" | "niedrig"; label?: string }) {
  if (d == null) return <span className="text-xs text-muted">{label ? `${label}: –` : "–"}</span>;
  const gut = richtung === "hoch" ? d >= 0 : d <= 0;
  const pfeil = d > 0.005 ? "▲" : d < -0.005 ? "▼" : "■";
  return (
    <span className={cx("text-xs font-medium tabular", Math.abs(d) < 0.005 ? "text-muted" : gut ? "text-good-ink" : "text-bad-ink")}>
      {pfeil} {Math.abs(d * 100).toLocaleString("de-DE", { maximumFractionDigits: 0 })} %{label && <span className="font-normal text-muted"> {label}</span>}
    </span>
  );
}

/** KPI-Kachel: Wert, Δ Vorperiode, Ziel, Ampel, Mini-Trend, Definition. */
export function Kachel({
  id, wert, vorher, basis, settings, href, spark, gross, zielOverride, untertitel,
}: {
  id: KpiId; wert: number | null | undefined; vorher?: number | null; basis?: number; settings?: Settings; href?: string;
  spark?: number[]; gross?: boolean; zielOverride?: string | null; untertitel?: string;
}) {
  const def = KPIS[id] as KpiDef;
  const a = ampelFn(id, wert, basis, settings);
  const d = vorher != null && wert != null && vorher !== 0 ? (wert - vorher) / Math.abs(vorher) : null;
  const ziel = zielOverride !== undefined ? zielOverride : zielText(id, settings);
  const inhalt = (
    <div className={cx("card flex h-full flex-col gap-1.5 p-4 transition", href && "hover:border-accent")}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-2">{def.label} <InfoTip def={def} /></span>
        <AmpelPill a={a} />
      </div>
      <span className={cx("whitespace-nowrap font-semibold tracking-tight tabular", gross ? "text-3xl" : "text-2xl", a === "grau" && "text-muted")}>{formatWert(wert, def.einheit, true)}</span>
      {spark && <Sparkline werte={spark} />}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        {vorher !== undefined && <DeltaText d={d} richtung={def.richtung} label="ggü. Vorperiode" />}
        {ziel && <span className="text-xs text-muted">Ziel {ziel}</span>}
        {untertitel && <span className="text-xs text-muted">{untertitel}</span>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{inhalt}</Link> : inhalt;
}

export function Leer({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">{children}</div>;
}

export function Grid({ children, cols = 3, className }: { children: ReactNode; cols?: 2 | 3 | 4 | 6; className?: string }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4", 6: "grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" }[cols];
  return <div className={cx("grid gap-3", cols === 6 ? "" : "grid-cols-1", c, className)}>{children}</div>;
}

export const closeLink = (leadId: string) => `https://app.close.com/lead/${leadId}/`;

export function CloseLink({ leadId, children }: { leadId: string; children: ReactNode }) {
  if (leadId.startsWith("lead_demo")) return <span>{children}</span>;
  return <a href={closeLink(leadId)} target="_blank" rel="noreferrer" className="text-accent hover:underline">{children}</a>;
}

export { formatWert };
