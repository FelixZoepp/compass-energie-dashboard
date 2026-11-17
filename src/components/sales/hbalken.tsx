import { cx } from "@/components/ui";

/** Horizontale Balken als reines HTML (server-tauglich). Werte direkt beschriftet. */
export function HBalken({ daten, einheit = "" }: { daten: { name: string; wert: number; hervor?: boolean }[]; einheit?: string }) {
  const max = Math.max(1, ...daten.map((d) => d.wert));
  const summe = daten.reduce((s, d) => s + d.wert, 0);
  return (
    <ul className="flex flex-col gap-1.5">
      {daten.map((d) => (
        <li key={d.name} className="grid grid-cols-[minmax(0,130px)_1fr_auto] items-center gap-2 text-[13px]" title={`${d.name}: ${d.wert}${einheit} (${Math.round((d.wert / Math.max(1, summe)) * 100)} %)`}>
          <span className="truncate text-ink-2">{d.name}</span>
          <span className="h-4">
            <span className={cx("block h-full rounded-r", d.hervor ? "bg-[var(--s2)]" : "bg-[var(--s1)]")} style={{ width: `${Math.max(2, (d.wert / max) * 100)}%` }} />
          </span>
          <span className="w-16 text-right tabular">
            <strong>{d.wert}</strong><span className="text-muted"> · {Math.round((d.wert / Math.max(1, summe)) * 100)} %</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
