import { seite, type SP } from "@/lib/seite";
import { index, pacing, pipeline } from "@/lib/kpi/engine";
import { formatWert, STAGE_LABEL } from "@/lib/kpi/katalog";
import { AmpelPill, Card, CloseLink, Grid, Leer, SeitenKopf, cx } from "@/components/ui";
import type { Opportunity } from "@/lib/types";

const tageSeit = (iso: string, now: number) => Math.floor((now - new Date(iso).getTime()) / 86400000);
const jetzt = () => Date.now();

function OppKarte({ o, name, wert, rep, now }: { o: Opportunity; name: string; wert: number; rep?: string; now: number }) {
  const alter = tageSeit(o.stageSince, now);
  return (
    <li className="rounded-lg border border-line bg-surface p-2.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <CloseLink leadId={o.leadId}><span className="font-medium">{name}</span></CloseLink>
        <span className="tabular shrink-0 font-semibold">{formatWert(wert, "eur", true)}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
        <span className={cx(alter > 14 && "font-medium text-bad-ink")}>{alter} {alter === 1 ? "Tag" : "Tage"} im Status</span>
        {rep && <span>· {rep}</span>}
        {o.paket && <span>· {o.paket}</span>}
        {!o.hatNaechsteAufgabe && <span className="rounded bg-warn-soft px-1 text-warn-ink">keine Aufgabe</span>}
      </div>
      {!o.value && <div className="mt-0.5 text-[11px] text-muted">Wert geschätzt</div>}
    </li>
  );
}

export default async function PipelineSeite({ searchParams }: { searchParams: SP }) {
  const { ds, f } = await seite("/pipeline", searchParams);
  const now = jetzt();
  const p = pipeline(ds, f);
  const pc = pacing(ds, f);
  const ix = index(ds);
  const reps = new Map(ds.reps.map((r) => [r.id, r.name]));
  const w = ds.settings.stageWahrscheinlichkeit;

  // Szenarien: Wahrscheinlichkeiten ×0,7 / ×1 / ×1,3 (max. 1) auf Opps mit Abschlussdatum in diesem Monat
  const d = new Date(now);
  const monatVon = new Date(d.getFullYear(), d.getMonth(), 1).getTime(), monatBis = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  const imMonat = p.offen.filter((o) => o.closeDate && new Date(o.closeDate).getTime() >= monatVon && new Date(o.closeDate).getTime() < monatBis);
  const szenario = (faktor: number) => pc.umsatz + imMonat.reduce((s, o) => s + p.wert(o) * Math.min(1, (w[o.stage] ?? 0) * faktor), 0);
  const szenarien = [
    { label: "Pessimistisch", faktor: 0.7, wert: szenario(0.7) },
    { label: "Realistisch", faktor: 1, wert: szenario(1) },
    { label: "Optimistisch", faktor: 1.3, wert: szenario(1.3) },
  ];
  const ziel = pc.ziel;

  const name = (o: Opportunity) => ix.leadById.get(o.leadId)?.name ?? o.leadId;

  return (
    <>
      <SeitenKopf titel="Pipeline und Forecast"
        klartext={<>Offen: <strong className="text-ink">{formatWert(p.summe, "eur")}</strong> in {p.offen.length} Opps, gewichtet {formatWert(p.gewichtet, "eur")}. Forecast Monatsende realistisch {formatWert(szenarien[1].wert, "eur")}{ziel ? ` (${Math.round((szenarien[1].wert / ziel) * 100)} % vom Ziel)` : ""}.</>} />

      <Grid cols={4}>
        <Card><div className="text-xs text-ink-2">Offene Pipeline</div><div className="mt-1 text-2xl font-semibold tabular">{formatWert(p.summe, "eur", true)}</div><div className="text-xs text-muted">{p.offen.length} Opps</div></Card>
        <Card><div className="text-xs text-ink-2">Gewichtete Pipeline</div><div className="mt-1 text-2xl font-semibold tabular">{formatWert(p.gewichtet, "eur", true)}</div><div className="text-xs text-muted">Wert × Wahrscheinlichkeit je Status</div></Card>
        <Card><div className="text-xs text-ink-2">Umsatz bisher (Monat)</div><div className="mt-1 text-2xl font-semibold tabular">{formatWert(pc.umsatz, "eur", true)}</div><div className="text-xs text-muted">{ziel ? `Ziel ${formatWert(ziel, "eur", true)}` : "kein Ziel hinterlegt"}</div></Card>
        <Card><div className="text-xs text-ink-2">Forecast Monatsende</div><div className="mt-1 text-2xl font-semibold tabular">{formatWert(pc.forecast, "eur", true)}</div><div className="text-xs text-muted">Umsatz + gewichtete Opps mit Abschluss in diesem Monat</div></Card>
      </Grid>

      <Card className="mt-3" titel="Szenarien Monatsende">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {szenarien.map((s) => {
            const q = ziel ? s.wert / ziel : null;
            return (
              <div key={s.label} className="rounded-lg bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-2 text-xs text-ink-2"><span>{s.label}</span><span className="text-muted">Wahrscheinlichkeit × {s.faktor.toLocaleString("de-DE")}</span></div>
                <div className="mt-1 text-xl font-semibold tabular">{formatWert(s.wert, "eur")}</div>
                {q != null && (
                  <div className="mt-2">
                    <div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-[var(--s1)]" style={{ width: `${Math.min(100, q * 100)}%` }} /></div>
                    <div className="mt-1"><AmpelPill a={q >= 1 ? "gruen" : q >= 0.85 ? "gelb" : "rot"} text={`${Math.round(q * 100)} % vom Ziel`} /></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">Wahrscheinlichkeiten je Status: {Object.entries(w).filter(([s]) => s !== "won" && s !== "lost").map(([s, v]) => `${STAGE_LABEL[s as keyof typeof STAGE_LABEL]} ${Math.round(v * 100)} %`).join(" · ")} (in den Einstellungen anpassbar, nach 3 Monaten aus echten Daten kalibrieren).</p>
      </Card>

      <h2 className="mt-5 mb-2 text-sm font-semibold">Kanban nach Status</h2>
      <div className="scroll-x pb-2">
        <div className="grid min-w-[1000px] grid-cols-5 gap-3">
          {p.proStage.map((s) => (
            <div key={s.stage} className="flex min-w-0 flex-col rounded-xl bg-surface-2 p-2">
              <div className="mb-2 px-1">
                <div className="flex items-center justify-between text-sm font-semibold"><span>{STAGE_LABEL[s.stage]}</span><span className="text-muted">{s.anzahl}</span></div>
                <div className="text-[11px] text-muted tabular">{formatWert(s.wert, "eur", true)} · gewichtet {formatWert(s.gewichtet, "eur", true)}</div>
              </div>
              <ul className="flex max-h-[560px] flex-col gap-2 overflow-y-auto">
                {s.opps.length === 0 ? <li className="px-1 text-xs text-muted">leer</li>
                  : [...s.opps].sort((a, b) => p.wert(b) - p.wert(a)).map((o) => <OppKarte key={o.id} o={o} name={name(o)} wert={p.wert(o)} rep={reps.get(o.userId ?? "")} now={now} />)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card titel={`Ohne nächste Aufgabe (${p.ohneAufgabe.length})`}>
          {p.ohneAufgabe.length === 0 ? <Leer>Jede offene Opp hat eine nächste Aufgabe.</Leer> : (
            <ul className="max-h-[420px] divide-y divide-[var(--border)] overflow-y-auto pr-1 text-sm">
              {p.ohneAufgabe.slice(0, 100).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 py-1.5">
                  <CloseLink leadId={o.leadId}>{name(o)}</CloseLink>
                  <span className="text-xs text-muted">{STAGE_LABEL[o.stage]} · {reps.get(o.userId ?? "") ?? "–"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card titel={`Über 14 Tage im selben Status (${p.stagnierend.length})`}>
          {p.stagnierend.length === 0 ? <Leer>Keine stagnierenden Opps.</Leer> : (
            <ul className="max-h-[420px] divide-y divide-[var(--border)] overflow-y-auto pr-1 text-sm">
              {[...p.stagnierend].sort((a, b) => a.stageSince.localeCompare(b.stageSince)).slice(0, 100).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 py-1.5">
                  <CloseLink leadId={o.leadId}>{name(o)}</CloseLink>
                  <span className="text-xs text-muted">{STAGE_LABEL[o.stage]} · {tageSeit(o.stageSince, now)} Tage · {formatWert(p.wert(o), "eur", true)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
