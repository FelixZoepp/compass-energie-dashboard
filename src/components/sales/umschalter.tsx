import Link from "next/link";
import { cx } from "@/components/ui";

/** Lokaler Umschalter, der die übrigen URL-Parameter (globale Filter) erhält. */
export function Umschalter({ pfad, params, name, optionen, aktiv }: { pfad: string; params: Record<string, string>; name: string; optionen: { key: string; label: string }[]; aktiv: string }) {
  return (
    <div className="inline-flex h-8 overflow-hidden rounded-lg border border-line text-[13px]" role="group">
      {optionen.map((o) => {
        const p = new URLSearchParams(params);
        p.delete("frisch");
        p.set(name, o.key);
        return (
          <Link key={o.key} href={`${pfad}?${p}`} scroll={false} aria-current={aktiv === o.key ? "true" : undefined}
            className={cx("flex items-center px-2.5", aktiv === o.key ? "bg-accent text-white" : "bg-surface text-ink-2 hover:bg-surface-2")}>
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
