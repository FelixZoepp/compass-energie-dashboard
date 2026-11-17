import Link from "next/link";
import type { LeaderEintrag } from "@/lib/kpi/team";
import { cx } from "@/components/ui";

const MEDAILLE = ["🥇", "🥈", "🥉"];

export function Rangliste({ titel, eintraege, format, link = true, gross, hervor }: {
  titel: string; eintraege: LeaderEintrag[]; format: "zahl" | "eur"; link?: boolean; gross?: boolean; hervor?: string | null;
}) {
  const f = (v: number) => format === "eur"
    ? v.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    : v.toLocaleString("de-DE");
  const max = Math.max(1, ...eintraege.map((e) => e.wert));
  return (
    <div className={cx("card min-w-0", gross ? "p-6" : "p-4")}>
      <h3 className={cx("mb-3 font-semibold", gross ? "text-2xl" : "text-sm")}>{titel}</h3>
      {eintraege.length === 0 ? <p className="text-sm text-muted">Keine Reps in dieser Rolle.</p> : (
        <ol className="flex flex-col gap-2">
          {eintraege.map((e, i) => {
            const platz = e.wert > 0 ? (i < 3 ? MEDAILLE[i] : `${i + 1}.`) : `${i + 1}.`;
            const inhalt = (
              <div className={cx("flex items-center gap-3 rounded-lg px-2 py-1.5", hervor === e.repId ? "bg-accent-soft" : link && "hover:bg-surface-2")}>
                <span className={cx("w-8 shrink-0 text-center", gross ? "text-3xl" : "text-lg")} aria-label={`Platz ${i + 1}`}>{platz}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cx("truncate font-medium", gross ? "text-2xl" : "text-sm")}>{e.name}</span>
                    <span className={cx("tabular font-semibold", gross ? "text-3xl" : "text-base")}>{f(e.wert)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-[var(--s1)]" style={{ width: `${(e.wert / max) * 100}%` }} />
                  </div>
                  {e.zusatz && <div className={cx("mt-0.5 text-muted", gross ? "text-base" : "text-[11px]")}>{e.zusatz}</div>}
                </div>
              </div>
            );
            return <li key={e.repId}>{link ? <Link href={`/team/${e.repId}`}>{inhalt}</Link> : inhalt}</li>;
          })}
        </ol>
      )}
    </div>
  );
}
