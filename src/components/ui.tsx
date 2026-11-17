// Gemeinsame Bausteine. Server-tauglich (keine Hooks).
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArrowUpRight, Info } from "lucide-react";
import { ZeitraumPillen, ZeitraumText } from "./zeitraum";
import { KPIS, ampel as ampelFn, formatWert, zielText, type Ampel, type KpiDef, type KpiId } from "@/lib/kpi/katalog";
import type { Settings } from "@/lib/types";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export function Card({ children, className, titel, untertitel, aktion, id, variante }: {
  children: ReactNode; className?: string; titel?: ReactNode; untertitel?: ReactNode; aktion?: ReactNode; id?: string; variante?: "brand";
}) {
  return (
    <section id={id} className={cx(variante === "brand" ? "card-brand" : "card", "min-w-0 p-5 sm:p-6", className)}>
      {(titel || aktion) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {titel && <h2 className={cx("text-[17px] font-semibold tracking-tight", variante === "brand" ? "text-white" : "text-ink")}>{titel}</h2>}
            {untertitel && <p className={cx("mt-0.5 text-[13px]", variante === "brand" ? "text-white/70" : "text-ink-2")}>{untertitel}</p>}
          </div>
          {aktion}
        </div>
      )}
      {children}
    </section>
  );
}

/** Seitenkopf: großer Titel, Klartext-Antwort, Zeitraum-Zeile, Zeitraum-Pillen rechts. */
export function SeitenKopf({ titel, klartext, children, ohneZeitraum }: { titel: string; klartext?: ReactNode; children?: ReactNode; ohneZeitraum?: boolean }) {
  return (
    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.1]">{titel}</h1>
        {klartext && <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-2">{klartext}</p>}
        {!ohneZeitraum && <Suspense><ZeitraumText /></Suspense>}
      </div>
      <div className="flex w-full min-w-0 flex-col items-start gap-2 xl:w-auto xl:items-end">
        {!ohneZeitraum && <Suspense><ZeitraumPillen /></Suspense>}
        {children}
      </div>
    </div>
  );
}

/** Pfeil-Knopf oben rechts in Karten (wie im Design-Vorbild). */
export function PfeilKnopf({ href, hell }: { href: string; hell?: boolean }) {
  return (
    <Link href={href} aria-label="Details" className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full border transition",
      hell ? "border-white/40 bg-white/90 text-brand-700 shadow-[inset_0_1px_0_#fff] hover:scale-105" : "border-[var(--glass-border)] bg-[var(--glass-strong)] text-ink shadow-[inset_0_1px_0_var(--glass-edge),0_2px_6px_rgba(17,26,21,0.06)] hover:scale-105 hover:text-accent")}>
      <ArrowUpRight className="h-4 w-4" />
    </Link>
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
    <span className={cx("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", AMPEL_KLASSE[a])}>
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

function Sparkline({ werte, hell }: { werte: number[]; hell?: boolean }) {
  if (werte.length < 2 || werte.every((w) => w === 0)) return null;
  const max = Math.max(...werte), min = Math.min(...werte);
  const w = 120, h = 22;
  const pts = werte.map((v, i) => `${(i / (werte.length - 1)) * w},${h - 2 - ((v - min) / (max - min || 1)) * (h - 4)}`).join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="overflow-visible" aria-hidden>
      <polyline points={pts} fill="none" stroke={hell ? "rgba(255,255,255,.85)" : "var(--brand-400)"} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
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

/** KPI-Kachel: Wert, Δ Vorperiode, Ziel, Ampel, Mini-Trend, Definition. `hervor` = dunkelgrüne Highlight-Karte. */
export function Kachel({
  id, wert, vorher, basis, settings, href, spark, gross, zielOverride, untertitel, hervor, label,
}: {
  id: KpiId; wert: number | null | undefined; vorher?: number | null; basis?: number; settings?: Settings; href?: string;
  spark?: number[]; gross?: boolean; zielOverride?: string | null; untertitel?: string; hervor?: boolean; label?: string;
}) {
  const def = KPIS[id] as KpiDef;
  const a = ampelFn(id, wert, basis, settings);
  const d = vorher != null && wert != null && vorher !== 0 ? (wert - vorher) / Math.abs(vorher) : null;
  const ziel = zielOverride !== undefined ? zielOverride : zielText(id, settings);
  return (
    <div className={cx(hervor ? "card-brand" : "card", "flex h-full min-w-0 flex-col p-5 sm:p-6")}>
      <div className="flex items-start justify-between gap-2">
        <span className={cx("flex items-center gap-1.5 text-[15px] font-medium", hervor ? "text-white/90" : "text-ink")}>
          {label ?? def.label} {!hervor && <InfoTip def={def} />}
        </span>
        {href ? <PfeilKnopf href={href} hell={hervor} /> : !hervor && <AmpelPill a={a} />}
      </div>
      <span className={cx("mt-4 whitespace-nowrap font-semibold tracking-tight tabular", gross ? "text-[44px] leading-none" : "text-[36px] leading-none", !hervor && a === "grau" && "text-muted")}>
        {formatWert(wert, def.einheit, true)}
      </span>
      {spark && <div className={cx("mt-3", hervor && "opacity-80")}><Sparkline werte={spark} hell={hervor} /></div>}
      <div className={cx("mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-[13px]", hervor ? "text-white/75" : "text-ink-2")}>
        {untertitel && <span>{untertitel}</span>}
        {vorher !== undefined && (hervor ? <span className="tabular">{d == null ? "–" : `${d >= 0 ? "▲" : "▼"} ${Math.abs(d * 100).toLocaleString("de-DE", { maximumFractionDigits: 0 })} % ggü. Vorperiode`}</span> : <DeltaText d={d} richtung={def.richtung} label="ggü. Vorperiode" />)}
        {ziel && <span className={hervor ? "" : "text-muted"}>Ziel {ziel}</span>}
        {href && !hervor && a !== "neutral" && <AmpelPill a={a} />}
      </div>
    </div>
  );
}

export function Leer({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{children}</div>;
}

export function Grid({ children, cols = 3, className }: { children: ReactNode; cols?: 2 | 3 | 4 | 6; className?: string }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4", 6: "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" }[cols];
  return <div className={cx("grid grid-cols-1 gap-4", c, className)}>{children}</div>;
}

export const closeLink = (leadId: string) => `https://app.close.com/lead/${leadId}/`;

export function CloseLink({ leadId, children }: { leadId: string; children: ReactNode }) {
  if (leadId.startsWith("lead_demo")) return <span>{children}</span>;
  return <a href={closeLink(leadId)} target="_blank" rel="noreferrer" className="text-accent hover:underline">{children}</a>;
}

export { formatWert };
