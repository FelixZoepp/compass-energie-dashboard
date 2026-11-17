"use client";
// Recharts-Bausteine. Eine y-Achse pro Diagramm (keine Doppelachsen), Farben aus den Palette-Tokens,
// Tooltips immer an, Legende ab 2 Reihen.
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import type { ReactNode } from "react";

export const SERIEN = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)", "var(--s6)", "var(--s7)", "var(--s8)"];

export type Format = "eur" | "zahl" | "pct" | "faktor";
export const fmt = (v: number | null | undefined, f: Format = "zahl") => {
  if (v == null || !Number.isFinite(v)) return "–";
  if (f === "eur") return v.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 });
  if (f === "pct") return `${(v * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
  if (f === "faktor") return v.toLocaleString("de-DE", { maximumFractionDigits: 2 });
  return v.toLocaleString("de-DE", { maximumFractionDigits: 0 });
};
const achse = (f: Format) => (v: number) => (f === "eur" ? (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} T€` : `${v} €`) : f === "pct" ? `${Math.round(v * 100)} %` : v.toLocaleString("de-DE"));

function TipBox({ active, payload, label, format }: { active?: boolean; payload?: { name: string; value: number; color: string; dataKey: string }[]; label?: string; format: Record<string, Format> | Format }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-ink">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-ink-2">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}</span>
          <span className="tabular font-medium text-ink">{fmt(p.value, typeof format === "string" ? format : format[p.dataKey] ?? "zahl")}</span>
        </div>
      ))}
    </div>
  );
}

const achsenProps = { tickLine: false, axisLine: { stroke: "var(--axis)" }, tick: { fill: "var(--muted)", fontSize: 11 } } as const;

export interface Reihe { key: string; name: string; typ?: "bar" | "line"; farbe?: string; gestrichelt?: boolean }

/** Kombi aus Balken und Linien – alle Reihen in derselben Einheit (eine Achse). */
export function KombiChart({ daten, x, reihen, format = "zahl", hoehe = 240 }: { daten: Record<string, unknown>[]; x: string; reihen: Reihe[]; format?: Format; hoehe?: number }) {
  return (
    <div style={{ height: hoehe }}>
      <ResponsiveContainer>
        <ComposedChart data={daten} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis dataKey={x} {...achsenProps} minTickGap={12} />
          <YAxis {...achsenProps} axisLine={false} width={56} tickFormatter={achse(format)} />
          <Tooltip content={<TipBox format={format} />} cursor={{ fill: "var(--surface-2)" }} />
          {reihen.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} />}
          {reihen.map((r, i) => r.typ === "line"
            ? <Line isAnimationActive={false} key={r.key} dataKey={r.key} name={r.name} stroke={r.farbe ?? SERIEN[i]} strokeWidth={2} dot={false} strokeDasharray={r.gestrichelt ? "5 4" : undefined} activeDot={{ r: 4 }} />
            : <Bar isAnimationActive={false} key={r.key} dataKey={r.key} name={r.name} fill={r.farbe ?? SERIEN[i]} radius={[4, 4, 0, 0]} maxBarSize={28} />)}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LinienChart({ daten, x, reihen, format = "zahl", hoehe = 220 }: { daten: Record<string, unknown>[]; x: string; reihen: Reihe[]; format?: Format; hoehe?: number }) {
  return (
    <div style={{ height: hoehe }}>
      <ResponsiveContainer>
        <LineChart data={daten} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={x} {...achsenProps} minTickGap={12} />
          <YAxis {...achsenProps} axisLine={false} width={56} tickFormatter={achse(format)} />
          <Tooltip content={<TipBox format={format} />} />
          {reihen.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
          {reihen.map((r, i) => <Line isAnimationActive={false} key={r.key} dataKey={r.key} name={r.name} stroke={r.farbe ?? SERIEN[i]} strokeWidth={2} dot={false} strokeDasharray={r.gestrichelt ? "5 4" : undefined} connectNulls activeDot={{ r: 4 }} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontale Balken (z. B. Verlustgründe). */
export function BalkenH({ daten, format = "zahl", farbe = "var(--s1)", hoehe }: { daten: { name: string; wert: number; hervor?: boolean }[]; format?: Format; farbe?: string; hoehe?: number }) {
  const h = hoehe ?? Math.max(120, daten.length * 34 + 20);
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer>
        <BarChart data={daten} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" {...achsenProps} axisLine={false} width={130} />
          <Tooltip content={<TipBox format={{ wert: format }} />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar isAnimationActive={false} dataKey="wert" name="Wert" radius={[0, 4, 4, 0]} maxBarSize={20} label={{ position: "right", fill: "var(--ink-2)", fontSize: 11, formatter: (v: unknown) => fmt(Number(v), format) }}>
            {daten.map((d, i) => <Cell key={i} fill={d.hervor ? "var(--s2)" : farbe} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BalkenV({ daten, x, reihen, format = "zahl", hoehe = 220, gestapelt }: { daten: Record<string, unknown>[]; x: string; reihen: Reihe[]; format?: Format; hoehe?: number; gestapelt?: boolean }) {
  return (
    <div style={{ height: hoehe }}>
      <ResponsiveContainer>
        <BarChart data={daten} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={x} {...achsenProps} />
          <YAxis {...achsenProps} axisLine={false} width={56} tickFormatter={achse(format)} />
          <Tooltip content={<TipBox format={format} />} cursor={{ fill: "var(--surface-2)" }} />
          {reihen.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
          {reihen.map((r, i) => <Bar isAnimationActive={false} key={r.key} dataKey={r.key} name={r.name} stackId={gestapelt ? "a" : undefined} fill={r.farbe ?? SERIEN[i]} radius={gestapelt ? 0 : [4, 4, 0, 0]} maxBarSize={32} stroke={gestapelt ? "var(--surface)" : undefined} strokeWidth={gestapelt ? 2 : 0} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartRahmen({ titel, children, aktion }: { titel: string; children: ReactNode; aktion?: ReactNode }) {
  return (
    <div className="card min-w-0 p-4">
      <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">{titel}</h3>{aktion}</div>
      {children}
    </div>
  );
}
