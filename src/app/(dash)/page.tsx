import Link from "next/link";
import { AlertTriangle, AlertCircle, ArrowRight } from "lucide-react";
import { seite, type SP } from "@/lib/seite";
import { berechne, engpass, funnel, pacing, sparkline, warnungen, wochenTrend } from "@/lib/kpi/engine";
import { ampel, formatWert, type KpiId } from "@/lib/kpi/katalog";
import { AmpelPill, Card, Grid, Kachel, SeitenKopf, cx } from "@/components/ui";
import { ChartRahmen, KombiChart } from "@/components/charts";

export default async function Cockpit({ searchParams }: { searchParams: SP }) {
  const { ds, f, vf } = await seite("/", searchParams);
  const k = berechne(ds, f);
  const v = vf ? berechne(ds, vf) : null;
  const p = pacing(ds, f);
  const eng = engpass(k, ds);
  const warn = warnungen(ds);
  const trend = wochenTrend(ds, f, 12);
  const sp = (feld: Parameters<typeof sparkline>[2]) => sparkline(ds, f, feld);
  const stufen = funnel(k);
  const pct = (x: number) => `${Math.round(x * 100)} %`;

  const satz = p.ziel
    ? `Bei aktuellem Tempo landen wir bei ${pct(p.prognoseQuote ?? 0)} vom Monatsziel.` +
      (p.fehlendeAbschluesse > 0 && p.fehlendeBG && p.fehlendeEG
        ? ` Es fehlen ${p.fehlendeAbschluesse} Abschlüsse = ca. ${p.fehlendeBG} Beratungsgespräche = ca. ${p.fehlendeEG} Erstgespräche.`
        : p.fehlendeAbschluesse === 0 ? " Das Ziel ist auf Kurs." : "")
    : "Für diesen Monat ist noch kein Umsatzziel hinterlegt (Einstellungen).";

  return (
    <>
      <SeitenKopf titel="Cockpit" klartext={eng ? <>Engpass: <strong className="text-ink">{eng.label} {pct(eng.wert)}</strong> (Ziel {pct(eng.ziel)}). {satz}</> : satz} />

      {/* Zeile 1: Kernkacheln */}
      <Grid cols={6}>
        <Kachel id="umsatz" wert={k.umsatz} vorher={v?.umsatz} settings={ds.settings} spark={sp("umsatz")} href="/closing" zielOverride={p.ziel ? formatWert(p.ziel, "eur", true) + " / Monat" : null} />
        <Kachel id="cash" wert={k.cash} vorher={v?.cash} settings={ds.settings} spark={sp("cash")} untertitel={k.cashQuote != null ? `Cash-Quote ${pct(k.cashQuote)}` : undefined} />
        <Kachel id="abschluesse" wert={k.abschluesse} vorher={v?.abschluesse} settings={ds.settings} spark={sp("abschluesse")} href="/closing" />
        <Kachel id="spend" wert={k.spend} vorher={v?.spend} settings={ds.settings} spark={sp("spend")} href="/meta" />
        <Kachel id="roas" wert={k.roas} vorher={v?.roas} settings={ds.settings} spark={sp("roas")} href="/meta" untertitel="Kohorte" />
        <Kachel id="cac" wert={k.cac} vorher={v?.cac} settings={ds.settings} spark={sp("cac")} href="/meta"
          zielOverride={k.aov ? `≤ ${formatWert(k.aov * 0.3, "eur", true)} (30 % AOV)` : null} />
      </Grid>

      {/* Zeile 2: Pacing */}
      <Card className="mt-3" titel="Monatsziel-Pacing" aktion={<Link href="/planung" className="text-xs text-accent hover:underline">Planungsrechner →</Link>}>
        {p.ziel ? (
          <>
            <div className="relative mt-1 h-7 overflow-hidden rounded-lg bg-surface-2">
              <div className="h-full rounded-lg bg-[var(--s1)]" style={{ width: `${Math.min(100, (p.umsatz / p.ziel) * 100)}%` }} />
              {p.forecast > p.umsatz && <div className="absolute top-0 h-full bg-[var(--s1)] opacity-25" style={{ left: `${Math.min(100, (p.umsatz / p.ziel) * 100)}%`, width: `${Math.max(0, Math.min(100, (p.forecast / p.ziel) * 100) - (p.umsatz / p.ziel) * 100)}%` }} />}
              {p.sollHeute != null && <div className="absolute top-0 h-full w-0.5 bg-ink" style={{ left: `${Math.min(100, (p.sollHeute / p.ziel) * 100)}%` }} title="Soll heute" />}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span><span className="text-muted">Ist </span><strong>{formatWert(p.umsatz, "eur")}</strong></span>
              <span><span className="text-muted">Soll heute </span><strong>{formatWert(p.sollHeute, "eur")}</strong></span>
              <span><span className="text-muted">Forecast Monatsende </span><strong>{formatWert(p.forecast, "eur")}</strong></span>
              <span><span className="text-muted">Ziel </span><strong>{formatWert(p.ziel, "eur")}</strong></span>
              <span><span className="text-muted">Pacing </span><strong>{p.pacing != null ? pct(p.pacing) : "–"}</strong></span>
              <span className="text-muted">Arbeitstag {p.atVergangen} von {p.atGesamt}</span>
            </div>
            <p className="mt-2 text-sm text-ink-2">{satz}</p>
          </>
        ) : <p className="text-sm text-muted">Kein Ziel hinterlegt. <Link className="text-accent" href="/einstellungen">Ziel setzen →</Link></p>}
      </Card>

      {/* Zeile 3: Funnel */}
      <Card className="mt-3" titel="Der Funnel als Ganzes" aktion={<Link href="/funnel" className="text-xs text-accent hover:underline">Details →</Link>}>
        <div className="scroll-x">
          <div className="grid min-w-[760px] grid-cols-8 gap-2">
            {stufen.map((s) => {
              const a = s.kpi ? ampel(s.kpi as KpiId, s.conv, undefined, ds.settings) : "neutral";
              const istEng = eng && s.kpi === eng.kpi;
              return (
                <div key={s.key} className={cx("rounded-lg border p-3", istEng ? "border-bad bg-bad-soft" : "border-line bg-surface-2")}>
                  <div className="text-[11px] leading-tight text-ink-2">{s.label}</div>
                  <div className="mt-1 text-xl font-semibold tabular">{formatWert(s.wert, "zahl")}</div>
                  <div className="mt-1 flex flex-col gap-1 text-[11px]">
                    {s.conv != null ? <AmpelPill a={a} text={`${formatWert(s.conv, "pct")} Conv.`} /> : <span className="text-muted">–</span>}
                    <span className="text-muted">{s.kosten != null ? `${formatWert(s.kosten, "eur")} / Stufe` : " "}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">Werbeausgaben im Zeitraum: {formatWert(k.spend, "eur")}. Conversion jeweils zur Vorstufe; Shows bezogen auf fällige Termine.</p>
      </Card>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Zeile 4: Warnungen */}
        <Card className="lg:col-span-2" titel={`Warnungen (${warn.length})`}>
          {warn.length === 0 ? <p className="text-sm text-good-ink">Keine aktiven Warnungen.</p> : (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {warn.map((w, i) => (
                <li key={i}>
                  <Link href={w.link} className="flex items-start gap-2 py-2 text-sm hover:text-accent">
                    {w.stufe === "rot" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-label="kritisch" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-label="Warnung" />}
                    <span className="flex-1">{w.text}</span><ArrowRight className="mt-0.5 h-3.5 w-3.5 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {/* Zeile 5: Trend */}
        <div className="lg:col-span-3">
          <ChartRahmen titel="Umsatz und Werbeausgaben pro Woche (12 Wochen)">
            <KombiChart daten={trend} x="label" format="eur" reihen={[{ key: "umsatz", name: "Umsatz", typ: "bar" }, { key: "spend", name: "Werbeausgaben", typ: "line", farbe: "var(--s2)" }]} />
          </ChartRahmen>
        </div>
      </div>
    </>
  );
}
