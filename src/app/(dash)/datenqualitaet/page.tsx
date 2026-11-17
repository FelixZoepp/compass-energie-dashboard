import { ChevronDown } from "lucide-react";
import { seite, type SP } from "@/lib/seite";
import { hygiene } from "@/lib/kpi/engine";
import { ampel, KPIS } from "@/lib/kpi/katalog";
import { AmpelPill, AmpelZelle, Card, CloseLink, InfoTip, SeitenKopf, cx } from "@/components/ui";

const ERKLAERUNG: Record<string, string> = {
  meeting_outcome: "Termin vorbei, aber kein Ergebnis eingetragen → Show-Rates stimmen nicht.",
  opp_ohne_aufgabe: "Offene Opp ohne nächste Aufgabe → Deal fällt durchs Raster.",
  aufgabe_ueberfaellig: "Aufgabe überfällig und nicht erledigt.",
  lead_ohne_utm: "Meta-Lead ohne Anzeigen-ID → Attribution kaputt.",
  lead_ohne_quelle: "Lead ohne Quelle → Funnel-Vergleich nach Quelle unvollständig.",
  won_ohne_wert: "Gewonnene Opp ohne Wert oder Paket → Umsatz falsch.",
};

const jetzt = () => new Date();

export default async function DatenqualitaetSeite({ searchParams }: { searchParams: SP }) {
  const { ds, nutzer, f } = await seite("/datenqualitaet", searchParams);
  const now = jetzt();
  const repFilter = nutzer.rolle === "rep" ? nutzer.repId ?? "__keiner__" : f.rep;
  const h = hygiene(ds, now, repFilter);
  const a = ampel("dqScore", h.score, undefined, ds.settings);
  const reps = new Map(ds.reps.map((r) => [r.id, r.name]));
  const proRep = nutzer.rolle === "rep" ? [] : ds.reps.filter((r) => r.aktiv).map((r) => ({ rep: r, h: hygiene(ds, now, r.id) }));
  const summe = h.fehler.reduce((s, x) => s + x.anzahl, 0);
  const groesster = [...h.fehler].sort((x, y) => y.anzahl * y.gewicht - x.anzahl * x.gewicht)[0];

  return (
    <>
      <SeitenKopf titel="Datenqualität"
        klartext={summe === 0 ? "Alles sauber gepflegt – die Zahlen im Dashboard sind belastbar." : <>{summe} offene Pflegepunkte. Größter Hebel: <strong className="text-ink">{groesster.label} ({groesster.anzahl})</strong>.</>} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <Card className="flex flex-col items-start justify-center">
          <span className="flex items-center gap-1.5 text-xs font-medium text-ink-2">Datenqualitäts-Score <InfoTip def={KPIS.dqScore} /></span>
          <span className={cx("mt-1 text-5xl font-semibold tabular", a === "rot" ? "text-bad-ink" : a === "gelb" ? "text-warn-ink" : "text-good-ink")}>{h.score}</span>
          <div className="mt-2 flex items-center gap-2"><AmpelPill a={a} /><span className="text-xs text-muted">Ziel &gt; 95</span></div>
          {repFilter && repFilter !== "__keiner__" && <span className="mt-1 text-xs text-muted">nur {reps.get(repFilter) ?? "eigene Daten"}</span>}
        </Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-3">
          {h.fehler.map((x) => (
            <a key={x.typ} href={`#${x.typ}`} className="card block p-3 hover:border-accent">
              <div className="text-xs text-ink-2">{x.label}</div>
              <div className={cx("mt-1 text-2xl font-semibold tabular", x.anzahl === 0 ? "text-good-ink" : "text-ink")}>{x.anzahl}</div>
              <div className="text-[11px] text-muted">von {x.basis} · Gewicht {x.gewicht}</div>
            </a>
          ))}
        </div>
      </div>

      {proRep.length > 0 && (
        <Card className="mt-3" titel="Je Rep">
          <div className="scroll-x">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-medium">Rep</th>
                  <th className="py-2 pr-3 text-right font-medium">Score</th>
                  {h.fehler.map((x) => <th key={x.typ} className="py-2 pr-3 text-right font-medium">{x.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {proRep.map(({ rep, h: rh }) => (
                  <tr key={rep.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3 font-medium">{rep.name}</td>
                    <td className="py-2 pr-3 text-right tabular"><AmpelZelle a={ampel("dqScore", rh.score, undefined, ds.settings)}>{rh.score}</AmpelZelle></td>
                    {rh.fehler.map((x) => <td key={x.typ} className={cx("py-2 pr-3 text-right tabular", x.anzahl === 0 && "text-muted")}>{x.anzahl}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {h.fehler.map((x) => (
          <details key={x.typ} id={x.typ} className="card group p-4" open={x.anzahl > 0 && x.anzahl <= 8}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
              <span>
                <span className="text-sm font-semibold">{x.label}</span>
                <span className="ml-2 text-sm text-muted">{x.anzahl}</span>
                <span className="block text-xs text-muted">{ERKLAERUNG[x.typ]}</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" aria-hidden />
            </summary>
            {x.anzahl === 0 ? <p className="mt-2 text-sm text-good-ink">Nichts zu tun.</p> : (
              <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
                {x.items.slice(0, 100).map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-2 py-1.5">
                    <CloseLink leadId={it.leadId}>{it.text}</CloseLink>
                    <span className="shrink-0 text-xs text-muted">{it.userId ? reps.get(it.userId) ?? "" : ""}</span>
                  </li>
                ))}
                {x.items.length > 100 && <li className="py-1.5 text-xs text-muted">… und {x.items.length - 100} weitere</li>}
              </ul>
            )}
          </details>
        ))}
      </div>
    </>
  );
}
