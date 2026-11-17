// CEO-Cockpit-Bausteine im Compass-Design (Server-Komponenten, außer wo markiert).
import type { ReactNode } from "react";
import { AmpelPill, cx, formatWert } from "./ui";
import type { Ampel } from "@/lib/kpi/katalog";
import type { Verteilung } from "@/lib/kpi/cockpit";

export interface TrichterStufe { label: string; wert: number; basisText?: string; quote: number | null; ziel?: number | null; kosten?: number | null }

/** „Trichter: wo du Leads verlierst“ – Balken relativ zur ersten Stufe, größtes Leck rot markiert. */
export function Trichter({ stufen }: { stufen: TrichterStufe[] }) {
  const max = Math.max(1, stufen[0]?.wert ?? 1);
  // Größtes Leck = Stufe mit dem größten Abstand zum Ziel (sonst niedrigste Quote)
  let leck = -1, schlechteste = Infinity;
  stufen.forEach((s, i) => {
    if (i === 0 || s.quote == null) return;
    const mass = s.ziel ? s.quote / s.ziel : s.quote;
    if (mass < schlechteste) { schlechteste = mass; leck = i; }
  });
  const l = leck > 0 ? stufen[leck] : null;
  return (
    <div className="flex flex-col gap-4">
      {stufen.map((s, i) => {
        const istLeck = i === leck && (s.ziel == null || (s.quote ?? 1) < s.ziel);
        return (
          <div key={s.label}>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-[15px] font-medium">{s.label}</span>
              <span className="flex items-baseline gap-2">
                <span className="text-[19px] font-semibold tabular">{formatWert(s.wert, "zahl")}</span>
                {i > 0 && s.quote != null && (
                  <span className={cx("text-[13px]", istLeck ? "font-semibold text-bad-ink" : "text-ink-2")}>
                    {Math.round(s.quote * 100)} % {s.basisText ?? "der Vorstufe"} · {Math.max(0, 100 - Math.round(s.quote * 100))} % weg
                  </span>
                )}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-2">
              <div className={cx("h-full rounded-full", istLeck ? "bg-[var(--s3)]" : i === stufen.length - 1 ? "bg-brand-400" : "bg-brand-700")}
                style={{ width: `${Math.max(2, (s.wert / max) * 100)}%` }} />
            </div>
          </div>
        );
      })}
      {l && (l.ziel == null || (l.quote ?? 1) < l.ziel) && (
        <div className="rounded-2xl border border-[var(--warn)]/40 bg-warn-soft px-4 py-3 text-[14px] text-warn-ink">
          <strong className="text-bad-ink">Größtes Leck:</strong> {stufen[leck - 1].label} → {l.label}. Hier gehen {Math.max(0, 100 - Math.round((l.quote ?? 0) * 100))} % verloren
          {l.ziel ? <> (Soll ≥ {Math.round(l.ziel * 100)} %)</> : null}.
        </div>
      )}
    </div>
  );
}

/** Donut mit Legende (SVG, ohne Client-JS). */
export function Donut({ teile, mitte, mitteText }: { teile: Verteilung[]; mitte: string; mitteText: string }) {
  const summe = teile.reduce((s, t) => s + t.anzahl, 0);
  const r = 62, u = 2 * Math.PI * r, gap = summe > 0 && teile.filter((t) => t.anzahl > 0).length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-5">
      <svg viewBox="0 0 160 160" className="h-[170px] w-[170px] -rotate-90" role="img" aria-label={`${mitte} ${mitteText}`}>
        <defs>
          <pattern id="schraffur" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--surface)" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--axis)" strokeWidth="3" /></pattern>
        </defs>
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="18" />
        {summe > 0 && teile.filter((t) => t.anzahl > 0).map((t) => {
          const len = (t.anzahl / summe) * u;
          const el = <circle key={t.key} cx="80" cy="80" r={r} fill="none" stroke={t.schraffiert ? "url(#schraffur)" : t.farbe} strokeWidth="18"
            strokeDasharray={`${Math.max(0, len - gap)} ${u}`} strokeDashoffset={-offset}><title>{`${t.label}: ${t.anzahl}`}</title></circle>;
          offset += len;
          return el;
        })}
        <g className="rotate-90" style={{ transformOrigin: "80px 80px" }}>
          <text x="80" y="80" textAnchor="middle" className="fill-[var(--ink)]" style={{ fontSize: 26, fontWeight: 600 }}>{mitte}</text>
          <text x="80" y="98" textAnchor="middle" className="fill-[var(--muted)]" style={{ fontSize: 11 }}>{mitteText}</text>
        </g>
      </svg>
      <ul className="w-full space-y-2">
        {teile.map((t) => (
          <li key={t.key} className="flex items-center justify-between gap-3 text-[14px]">
            <span className="flex items-center gap-2.5">
              <span className={cx("h-3 w-3 rounded-full", t.schraffiert && "schraffur")} style={t.schraffiert ? undefined : { background: t.farbe }} aria-hidden />{t.label}
            </span>
            <span className="tabular"><strong>{t.anzahl}</strong> <span className="text-muted">{summe ? Math.round((t.anzahl / summe) * 100) : 0} %</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Halbkreis-Tacho „X/Y Quoten erreicht“. */
export function Kompass({ erreicht, knapp, verfehlt, gesamt }: { erreicht: number; knapp: number; verfehlt: number; gesamt: number }) {
  const r = 80, u = Math.PI * r;
  const anteil = gesamt ? (erreicht + knapp * 0.5) / gesamt : 0;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 112" className="w-full max-w-[260px]" role="img" aria-label={`${erreicht} von ${gesamt} Quoten erreicht`}>
        <defs><pattern id="kompass-s" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="var(--axis)" strokeWidth="3" /></pattern></defs>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#kompass-s)" strokeWidth="26" />
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--brand-700)" strokeWidth="26" strokeDasharray={`${anteil * u} ${u}`} />
        <text x="100" y="92" textAnchor="middle" style={{ fontSize: 34, fontWeight: 600 }} className="fill-[var(--ink)]">{erreicht}/{gesamt}</text>
      </svg>
      <div className="-mt-1 text-[13px] text-ink-2">Quoten erreicht</div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px]">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-400" />erreicht <strong>{erreicht}</strong></span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--warn)]" />knapp <strong>{knapp}</strong></span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-bad" />verfehlt <strong>{verfehlt}</strong></span>
      </div>
    </div>
  );
}

export function QuotenListe({ quoten }: { quoten: { label: string; wert: number | null; a: Ampel; soll: string | null; einheit: "pct" | "eur" }[] }) {
  return (
    <ul className="divide-y divide-[var(--border)]">
      {quoten.map((q) => (
        <li key={q.label} className="flex items-center justify-between gap-3 py-2.5">
          <span className="min-w-0">
            <span className="block text-[13px] leading-snug text-ink-2">{q.label}</span>
            <span className="text-[17px] font-semibold tabular">{formatWert(q.wert, q.einheit)}</span>
            {q.soll && <span className="ml-1.5 text-[13px] text-muted">Soll {q.soll}</span>}
          </span>
          <AmpelPill a={q.a} />
        </li>
      ))}
    </ul>
  );
}

/** Kleine Kennzahl-Zelle für dichte Raster (Marketing-/Sales-Blöcke). */
export function MiniKpi({ label, wert, sub, a, href }: { label: string; wert: string; sub?: ReactNode; a?: Ampel; href?: string }) {
  const inhalt = (
    <div className={cx("h-full rounded-2xl bg-surface-2 p-4 transition", href && "hover:bg-brand-100")}>
      <div className="text-[13px] leading-snug text-ink-2">{label}</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={cx("text-[24px] font-semibold leading-none tracking-tight tabular", a === "grau" && "text-muted")}>{wert}</span>
        {a && a !== "neutral" && <AmpelPill a={a} />}
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-muted">{sub}</div>}
    </div>
  );
  return href ? <a href={href} className="block">{inhalt}</a> : inhalt;
}

export function Abschnitt({ titel, untertitel, aktion, children }: { titel: string; untertitel?: string; aktion?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[24px] font-semibold tracking-tight">{titel}</h2>
          {untertitel && <p className="mt-0.5 text-[14px] text-ink-2">{untertitel}</p>}
        </div>
        {aktion}
      </div>
      {children}
    </section>
  );
}
