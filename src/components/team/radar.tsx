"use client";
import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { RadarAchse } from "@/lib/kpi/team";

function Tip({ active, payload }: { active?: boolean; payload?: { payload: RadarAchse }[] }) {
  if (!active || !payload?.length) return null;
  const a = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-ink">{a.achse}</div>
      <div className="flex justify-between gap-4 text-ink-2"><span>Ich</span><span className="tabular font-medium text-ink">{a.ichWert} ({a.ich} %)</span></div>
      <div className="flex justify-between gap-4 text-ink-2"><span>Teamschnitt</span><span className="tabular font-medium text-ink">{a.teamWert} ({a.team} %)</span></div>
      <div className="flex justify-between gap-4 text-ink-2"><span>Ziel</span><span className="tabular font-medium text-ink">{a.zielWert}</span></div>
    </div>
  );
}

/** Netzdiagramm, normiert auf Ziel = 100 % (gedeckelt bei 150 %). */
export function ScoreRadar({ daten, name }: { daten: RadarAchse[]; name: string }) {
  return (
    <div style={{ height: 320 }}>
      <ResponsiveContainer>
        <RadarChart data={daten} outerRadius="72%">
          <PolarGrid stroke="var(--grid)" />
          <PolarAngleAxis dataKey="achse" tick={{ fill: "var(--ink-2)", fontSize: 11 }} />
          <PolarRadiusAxis angle={54} domain={[0, 150]} tick={{ fill: "var(--muted)", fontSize: 10 }} tickCount={4} axisLine={false} />
          <Radar isAnimationActive={false} name="Ziel (100 %)" dataKey="ziel" stroke="var(--muted)" strokeDasharray="4 4" fill="none" strokeWidth={1.5} />
          <Radar isAnimationActive={false} name="Teamschnitt" dataKey="team" stroke="var(--s2)" fill="var(--s2)" fillOpacity={0.08} strokeWidth={2} />
          <Radar isAnimationActive={false} name={name} dataKey="ich" stroke="var(--s1)" fill="var(--s1)" fillOpacity={0.2} strokeWidth={2} />
          <Tooltip content={<Tip />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
