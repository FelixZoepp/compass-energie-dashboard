"use client";
import type { ReactNode } from "react";

export const eingabe = "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-accent disabled:opacity-60";

export function Feld({ label, hilfe, children }: { label: string; hilfe?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[13px] text-ink-2">
      <span>{label}</span>
      {children}
      {hilfe && <span className="text-[11px] text-muted">{hilfe}</span>}
    </label>
  );
}

export function ZahlFeld({ wert, onChange, schritt = 1, min, max, disabled, suffix }: { wert: number | null | undefined; onChange: (v: number | null) => void; schritt?: number; min?: number; max?: number; disabled?: boolean; suffix?: string }) {
  return (
    <div className="relative">
      <input type="number" inputMode="decimal" step={schritt} min={min} max={max} disabled={disabled} className={`${eingabe} tabular ${suffix ? "pr-9" : ""}`}
        value={wert ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      {suffix && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">{suffix}</span>}
    </div>
  );
}

export function Abschnitt({ titel, beschreibung, children }: { titel: string; beschreibung?: string; children: ReactNode }) {
  return (
    <div className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold">{titel}</h3>
      {beschreibung && <p className="mb-3 mt-0.5 text-xs text-muted">{beschreibung}</p>}
      {!beschreibung && <div className="mb-3" />}
      {children}
    </div>
  );
}
