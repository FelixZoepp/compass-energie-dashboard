import { ampel, formatWert, type KpiId } from "@/lib/kpi/katalog";
import type { FunnelStufe, Kennzahlen } from "@/lib/kpi/engine";
import { funnelBasis } from "@/lib/kpi/sales";
import type { Settings } from "@/lib/types";
import { AmpelPill, cx } from "@/components/ui";

/** Horizontale Funnel-Balken ab „Leads“; Breite relativ zur Lead-Zahl, Engpass hervorgehoben. */
export function FunnelStufen({ stufen, settings, engpassKpi, k }: { stufen: FunnelStufe[]; settings: Settings; engpassKpi?: string | null; k: Kennzahlen }) {
  const ab = stufen.filter((s) => !["impressions", "klicks"].includes(s.key));
  const basis = Math.max(1, ab[0]?.wert ?? 1);
  return (
    <div className="flex flex-col gap-2">
      {ab.map((s, i) => {
        const a = s.kpi && i > 0 ? ampel(s.kpi as KpiId, s.conv, funnelBasis(s.kpi, k), settings) : "neutral";
        const eng = engpassKpi && s.kpi === engpassKpi;
        return (
          <div key={s.key} className="grid grid-cols-[minmax(0,150px)_1fr] items-center gap-3 sm:grid-cols-[190px_1fr_170px]">
            <div className="text-[13px] leading-tight text-ink-2">{s.label}</div>
            <div className="flex min-w-0 items-center gap-2">
              <div className="h-7 flex-1">
                <div className={cx("h-full rounded-r-md", eng ? "bg-[var(--s2)]" : "bg-[var(--s1)]")} style={{ width: `${Math.max(1.5, (s.wert / basis) * 100)}%` }} />
              </div>
              <span className="w-14 text-right text-sm font-semibold tabular">{formatWert(s.wert, "zahl")}</span>
            </div>
            <div className="col-span-2 flex flex-wrap items-center gap-2 text-[11px] sm:col-span-1">
              {i > 0 && s.conv != null ? <AmpelPill a={a} text={`${formatWert(s.conv, "pct")} zur Vorstufe${a === "grau" ? " · zu wenig Daten" : ""}`} /> : i > 0 ? <AmpelPill a="grau" /> : null}
              {s.kosten != null && <span className="text-muted">{formatWert(s.kosten, "eur")}/Stufe</span>}
              {eng && <span className="font-medium text-[var(--s2)]">Engpass</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
