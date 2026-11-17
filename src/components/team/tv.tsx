"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Maximize2 } from "lucide-react";
import type { LeaderEintrag } from "@/lib/kpi/team";
import { Rangliste } from "./leaderboard";

interface Boards { termine: LeaderEintrag[]; abschluesse: LeaderEintrag[]; umsatz: LeaderEintrag[] }
interface Props {
  heute: Boards; monat: Boards;
  pacing: { ziel: number | null; umsatz: number; sollHeute: number | null; forecast: number; prognoseQuote: number | null; atVergangen: number; atGesamt: number; abschluesse: number };
  funnel: { label: string; wert: number; conv: number | null }[];
  demo: boolean; stand: string;
}

const eur = (v: number | null) => (v == null ? "–" : v.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }));
const ROTATION_MS = 20_000;
const REFRESH_MS = 5 * 60_000;

export function TvAnsicht(p: Props) {
  const router = useRouter();
  const [folie, setFolie] = useState(0);
  const folien = ["Leaderboard heute", "Leaderboard Monat", "Monatsziel", "Funnel diesen Monat"];

  // TV läuft immer dunkel; vorheriges Theme beim Verlassen wiederherstellen
  useEffect(() => {
    const el = document.documentElement;
    const vorher = el.dataset.theme;
    el.dataset.theme = "dark";
    return () => { if (vorher) el.dataset.theme = vorher; else delete el.dataset.theme; };
  }, []);
  useEffect(() => {
    const r = setInterval(() => setFolie((f) => (f + 1) % 4), ROTATION_MS);
    const a = setInterval(() => router.refresh(), REFRESH_MS);
    return () => { clearInterval(r); clearInterval(a); };
  }, [router]);

  const vollbild = () => { document.documentElement.requestFullscreen?.().catch(() => {}); };
  const pct = p.pacing.ziel ? Math.min(100, (p.pacing.umsatz / p.pacing.ziel) * 100) : 0;
  const soll = p.pacing.ziel && p.pacing.sollHeute != null ? Math.min(100, (p.pacing.sollHeute / p.pacing.ziel) * 100) : null;
  const stand = new Date(p.stand).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex min-h-screen flex-col bg-page px-8 py-6 text-ink">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-lg font-bold text-white">CE</span>
          <div><div className="text-2xl font-semibold">Compass Energie</div><div className="text-base text-muted">{folien[folie]}{p.demo && " · Demo-Daten"}</div></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2" aria-label="Folien">
            {folien.map((f, i) => (
              <button key={f} type="button" onClick={() => setFolie(i)} aria-label={f} className={`h-2.5 rounded-full transition-all ${i === folie ? "w-10 bg-accent" : "w-2.5 bg-surface-2"}`} />
            ))}
          </div>
          <span className="text-base text-muted">Stand {stand}</span>
          <button type="button" onClick={vollbild} aria-label="Vollbild" className="rounded-lg p-2 text-muted hover:bg-surface-2"><Maximize2 className="h-5 w-5" /></button>
        </div>
      </header>

      <main className="flex-1">
        {(folie === 0 || folie === 1) && (() => {
          const b = folie === 0 ? p.heute : p.monat;
          return (
            <div className="grid h-full grid-cols-1 gap-6 xl:grid-cols-3">
              <Rangliste titel="📅 Termine gebucht" eintraege={b.termine} format="zahl" link={false} gross />
              <Rangliste titel="🤝 Abschlüsse" eintraege={b.abschluesse} format="zahl" link={false} gross />
              <Rangliste titel="💶 Umsatz" eintraege={b.umsatz} format="eur" link={false} gross />
            </div>
          );
        })()}

        {folie === 2 && (
          <div className="card flex h-full flex-col justify-center p-10">
            {p.pacing.ziel ? (
              <>
                <div className="flex items-end justify-between gap-6">
                  <div><div className="text-2xl text-muted">Umsatz diesen Monat</div><div className="text-8xl font-semibold tabular">{eur(p.pacing.umsatz)}</div></div>
                  <div className="text-right"><div className="text-2xl text-muted">Ziel</div><div className="text-5xl font-semibold tabular">{eur(p.pacing.ziel)}</div></div>
                </div>
                <div className="relative mt-10 h-14 overflow-hidden rounded-2xl bg-surface-2">
                  <div className="h-full rounded-2xl bg-[var(--s1)]" style={{ width: `${pct}%` }} />
                  {soll != null && <div className="absolute top-0 h-full w-1 bg-ink" style={{ left: `${soll}%` }} />}
                </div>
                <div className="mt-6 grid grid-cols-2 gap-6 text-2xl lg:grid-cols-4">
                  <div><div className="text-muted">Soll heute</div><div className="font-semibold tabular">{eur(p.pacing.sollHeute)}</div></div>
                  <div><div className="text-muted">Forecast Monatsende</div><div className="font-semibold tabular">{eur(p.pacing.forecast)}</div></div>
                  <div><div className="text-muted">Tempo-Hochrechnung</div><div className="font-semibold tabular">{p.pacing.prognoseQuote != null ? `${Math.round(p.pacing.prognoseQuote * 100)} %` : "–"}</div></div>
                  <div><div className="text-muted">Arbeitstag</div><div className="font-semibold tabular">{p.pacing.atVergangen} / {p.pacing.atGesamt}</div></div>
                </div>
              </>
            ) : <div className="text-3xl text-muted">Für diesen Monat ist noch kein Umsatzziel hinterlegt.</div>}
          </div>
        )}

        {folie === 3 && (
          <div className="grid h-full grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {p.funnel.map((s, i) => (
              <div key={s.label} className="card flex flex-col justify-between p-6">
                <div className="text-xl text-muted">{s.label}</div>
                <div className="mt-4 text-6xl font-semibold tabular">{s.wert.toLocaleString("de-DE")}</div>
                <div className="mt-4 text-xl text-ink-2">{i > 0 && s.conv != null ? `${Math.round(s.conv * 100)} % Conversion` : " "}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
