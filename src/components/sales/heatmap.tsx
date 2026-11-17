import { HEAT_STUNDEN, HEAT_TAGE } from "@/lib/kpi/sales";
import { sequenz } from "./sequenz";

type Zelle = { calls: number; erreicht: number; quote: number | null };

/** Heatmap Erreichbarkeit Wochentag × Uhrzeit. Zellen unter Mindestmenge bleiben grau. */
export function ErreichbarkeitHeatmap({ zellen, minCalls = 5 }: { zellen: Zelle[][]; minCalls?: number }) {
  const werte = zellen.flat().filter((z) => z.calls >= minCalls).map((z) => z.quote ?? 0);
  const max = Math.max(0.0001, ...werte);
  const min = werte.length ? Math.min(...werte) : 0;
  return (
    <div className="scroll-x">
      <table className="w-full min-w-[620px] border-separate text-center text-[12px] tabular" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="w-10" />
            {HEAT_STUNDEN.map((h) => <th key={h} className="pb-1 font-normal text-muted">{h} Uhr</th>)}
          </tr>
        </thead>
        <tbody>
          {zellen.map((zeile, d) => (
            <tr key={d}>
              <th className="pr-2 text-left font-medium text-ink-2">{HEAT_TAGE[d]}</th>
              {zeile.map((z, h) => {
                const genug = z.calls >= minCalls;
                const stil = genug ? sequenz(z.quote, max, min) : undefined;
                return (
                  <td key={h} className="rounded-md" style={stil ?? { background: "var(--surface-2)", color: "var(--muted)" }}
                    title={`${HEAT_TAGE[d]} ${HEAT_STUNDEN[h]}–${HEAT_STUNDEN[h] + 1} Uhr: ${z.erreicht} von ${z.calls} Anwahlen erreicht${genug ? "" : " (zu wenig Daten)"}`}>
                    <div className="py-1.5 leading-tight">
                      <div className="font-medium">{genug && z.quote != null ? `${Math.round(z.quote * 100)} %` : "–"}</div>
                      <div className="text-[10px] opacity-75">n={z.calls}</div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
        <span>niedrig</span>
        <span className="h-2 w-28 rounded" style={{ background: "linear-gradient(90deg,#cde2fb,#5598e7,#0d366b)" }} />
        <span>hoch</span>
        <span className="ml-3">Grau = weniger als {minCalls} Anwahlen</span>
      </div>
    </div>
  );
}
