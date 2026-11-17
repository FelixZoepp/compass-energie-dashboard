"use client";
// „Verlauf“: Säulen mit Kennzahl-Chips und Tage/Wochen/Monate-Umschalter (Daten kommen fertig vom Server).
import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import type { Granularitaet, VerlaufKey, VerlaufPunkt } from "@/lib/kpi/cockpit";

const fmt = (v: number, f: string) => f === "eur" ? v.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : v.toLocaleString("de-DE", { maximumFractionDigits: 0 });

export function Verlauf({ daten, metriken }: { daten: Record<Granularitaet, VerlaufPunkt[]>; metriken: readonly { key: VerlaufKey; label: string; format: string }[] }) {
  const [g, setG] = useState<Granularitaet>("wochen");
  const [m, setM] = useState<VerlaufKey>("leads");
  const [aktiv, setAktiv] = useState<number | null>(null);
  const def = metriken.find((x) => x.key === m)!;
  const reihe = daten[g];
  const summe = reihe.reduce((s, p) => s + (p[m] || 0), 0);
  const gewaehlt = aktiv != null ? reihe[aktiv] : null;
  return (
    <div>
      <div className="mb-3 inline-flex rounded-full border border-[var(--glass-border)] bg-surface-2 p-1">
        {(["tage", "wochen", "monate"] as const).map((x) => (
          <button key={x} type="button" onClick={() => { setG(x); setAktiv(null); }} className={`rounded-full px-4 py-1.5 text-[14px] ${g === x ? "liquid-pill-aktiv" : "text-ink"}`}>
            {x === "tage" ? "Tage" : x === "wochen" ? "Wochen" : "Monate"}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {metriken.map((x) => (
          <button key={x.key} type="button" onClick={() => setM(x.key)}
            className={`rounded-full border px-3.5 py-1.5 text-[14px] transition ${m === x.key ? "border-accent bg-accent-soft text-accent font-medium" : "border-line text-ink-2 hover:border-brand-300"}`}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="h-[260px]">
        <ResponsiveContainer>
          <BarChart data={reihe} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} onClick={(e) => setAktiv(typeof e?.activeTooltipIndex === "number" ? e.activeTooltipIndex : null)}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} minTickGap={16} />
            <YAxis hide />
            <Tooltip cursor={{ fill: "var(--surface-2)", radius: 12 }} content={({ active, payload, label }) => active && payload?.length ? (
              <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg"><div className="font-medium">{label}</div><div className="tabular">{def.label}: <strong>{fmt(Number(payload[0].value), def.format)}</strong></div></div>
            ) : null} />
            <Bar isAnimationActive={false} dataKey={m} radius={[999, 999, 999, 999]} maxBarSize={44} minPointSize={6}>
              {reihe.map((_, i) => <Cell key={i} fill={aktiv === i ? "var(--brand-700)" : "var(--brand-500)"} cursor="pointer" />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-[13px] text-ink-2">
        {gewaehlt
          ? <>{gewaehlt.label}: {metriken.filter((x) => x.key !== "cash").map((x) => `${x.label} ${fmt(gewaehlt[x.key], x.format)}`).join(" · ")}</>
          : <>Summe im Verlauf: <strong className="text-ink">{fmt(summe, def.format)}</strong> · Säule antippen: darunter steht, was in dem Zeitraum passiert ist.</>}
      </p>
    </div>
  );
}
