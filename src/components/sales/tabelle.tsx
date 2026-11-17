import type { ReactNode } from "react";
import { cx } from "@/components/ui";

export function Tabelle({ kopf, children, minBreite = 640 }: { kopf: ReactNode[]; children: ReactNode; minBreite?: number }) {
  return (
    <div className="scroll-x">
      <table className="w-full text-[13px] tabular" style={{ minWidth: minBreite }}>
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
            {kopf.map((k, i) => <th key={i} className={cx("px-2 py-2 font-medium", i > 0 && "text-right")}>{k}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, links, className }: { children: ReactNode; links?: boolean; className?: string }) {
  return <td className={cx("px-2 py-2", links ? "whitespace-nowrap" : "text-right", className)}>{children}</td>;
}
