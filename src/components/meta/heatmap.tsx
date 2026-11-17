// Heatmap Alter × Geschlecht: CPL, sequentielle blaue Rampe (günstig = dunkel), Wert in jeder Zelle.
import { formatWert } from "@/lib/kpi/katalog";

// Ordinale Rampe ab Step 250 (Kontrast ≥ 2:1 auf hellem Grund)
const RAMPE = ["#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95"];

type Zelle = { spend: number; leads: number; cpl: number | null };

export function AlterGeschlechtHeatmap({ zeilen }: { zeilen: { alter: string; m: Zelle; w: Zelle }[] }) {
  const werte = zeilen.flatMap((z) => [z.m.cpl, z.w.cpl]).filter((v): v is number => v != null);
  if (!werte.length) return <p className="text-sm text-muted">Noch keine Breakdown-Daten.</p>;
  const min = Math.min(...werte), max = Math.max(...werte);
  // Niedriger CPL = besser = dunkler
  const farbe = (v: number | null) => {
    if (v == null) return { bg: "var(--surface-2)", fg: "var(--muted)" };
    const t = max === min ? 1 : 1 - (v - min) / (max - min);
    const i = Math.min(RAMPE.length - 1, Math.round(t * (RAMPE.length - 1)));
    return { bg: RAMPE[i], fg: i >= 3 ? "#ffffff" : "#0b0b0b" };
  };
  const zelle = (z: Zelle, label: string) => {
    const c = farbe(z.cpl);
    return (
      <td className="p-0.5">
        <div className="rounded-md px-2 py-2 text-center" style={{ background: c.bg, color: c.fg }} title={`${label}: ${formatWert(z.spend, "eur")} Spend, ${z.leads} Leads`}>
          <div className="text-sm font-semibold tabular">{formatWert(z.cpl, "eur")}</div>
          <div className="text-[10px] opacity-80">{z.leads} Leads</div>
        </div>
      </td>
    );
  };
  return (
    <div>
      <table className="w-full table-fixed text-xs">
        <thead><tr className="text-muted"><th className="w-16 py-1 text-left font-normal">Alter</th><th className="font-normal">Männer</th><th className="font-normal">Frauen</th></tr></thead>
        <tbody>
          {zeilen.map((z) => (
            <tr key={z.alter}>
              <td className="py-0.5 text-ink-2">{z.alter}</td>
              {zelle(z.m, `${z.alter} Männer`)}
              {zelle(z.w, `${z.alter} Frauen`)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
        <span>CPL hoch</span>
        <span className="h-2 flex-1 rounded" style={{ background: `linear-gradient(90deg, ${RAMPE[0]}, ${RAMPE[RAMPE.length - 1]})` }} />
        <span>CPL niedrig</span>
      </div>
    </div>
  );
}
