import Link from "next/link";
import { seite, type SP } from "@/lib/seite";
import { repTabelle } from "@/lib/kpi/engine";
import { basisFilter, coaching, leaderboard, PERIODEN, type LeaderPeriode } from "@/lib/kpi/team";
import { formatWert } from "@/lib/kpi/katalog";
import { AmpelPill, Card, SeitenKopf, cx } from "@/components/ui";
import { Rangliste } from "@/components/team/leaderboard";

export default async function TeamSeite({ searchParams }: { searchParams: SP }) {
  const { ds, nutzer, params, f } = await seite("/team", searchParams);
  const periode = (PERIODEN.find((p) => p.key === params.p)?.key ?? "woche") as LeaderPeriode;
  const lb = leaderboard(ds, periode);
  const istRep = nutzer.rolle === "rep";
  const qs = (p: LeaderPeriode) => {
    const u = new URLSearchParams(params);
    u.set("p", p);
    u.delete("frisch");
    return `?${u}`;
  };
  const fuehrend = lb.umsatz[0]?.wert ? lb.umsatz[0] : null;
  const zeilen = istRep ? [] : repTabelle(ds, basisFilter(f.zeitraum));

  return (
    <>
      <SeitenKopf titel="Team und Leaderboard"
        klartext={fuehrend ? <>{PERIODEN.find((p) => p.key === periode)!.label} vorne beim Umsatz: <strong className="text-ink">{fuehrend.name}</strong> mit {formatWert(fuehrend.wert, "eur")}.</> : "Noch keine Abschlüsse in diesem Zeitraum."}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-8 overflow-hidden rounded-lg border border-line text-[13px]" role="group" aria-label="Zeitraum Leaderboard">
            {PERIODEN.map((p) => (
              <Link key={p.key} href={qs(p.key)} scroll={false} className={cx("px-3 leading-8", periode === p.key ? "bg-accent text-white" : "bg-surface text-ink-2 hover:bg-surface-2")}>{p.label}</Link>
            ))}
          </div>
          <Link href="/team/tv" className="h-8 rounded-lg border border-line bg-surface px-3 text-[13px] leading-8 text-ink-2 hover:bg-surface-2">TV-Modus</Link>
          {istRep && nutzer.repId && <Link href={`/team/${nutzer.repId}`} className="h-8 rounded-lg bg-accent px-3 text-[13px] leading-8 text-white">Meine Scorecard</Link>}
        </div>
      </SeitenKopf>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Rangliste titel="Termine gebucht (Setter)" eintraege={lb.termine} format="zahl" link={!istRep} hervor={nutzer.repId} />
        <Rangliste titel="Abschlüsse (Closer)" eintraege={lb.abschluesse} format="zahl" link={!istRep} hervor={nutzer.repId} />
        <Rangliste titel="Umsatz (Closer)" eintraege={lb.umsatz} format="eur" link={!istRep} hervor={nutzer.repId} />
      </div>

      {!istRep && (
        <Card className="mt-3" titel={`Coaching-Ampel · ${f.zeitraum.label}`}>
          <div className="scroll-x">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-medium">Rep</th><th className="py-2 pr-3 font-medium">Rolle</th>
                  <th className="py-2 pr-3 text-right font-medium">Anwahlen</th><th className="py-2 pr-3 text-right font-medium">Termine</th>
                  <th className="py-2 pr-3 text-right font-medium">Abschlüsse</th><th className="py-2 pr-3 text-right font-medium">Umsatz</th>
                  <th className="py-2 font-medium">Coaching-Hinweis</th>
                </tr>
              </thead>
              <tbody>
                {zeilen.map((z) => {
                  const rep = ds.reps.find((r) => r.id === z.repId)!;
                  const c = coaching(ds, rep, z)[0];
                  return (
                    <tr key={z.repId} className="border-b border-line last:border-0">
                      <td className="py-2 pr-3"><Link href={`/team/${z.repId}`} className="font-medium text-accent hover:underline">{z.name}</Link></td>
                      <td className="py-2 pr-3 text-ink-2">{rep.rolle === "beides" ? "Setter + Closer" : rep.rolle === "setter" ? "Setter" : "Closer"}</td>
                      <td className="tabular py-2 pr-3 text-right">{rep.rolle !== "closer" ? formatWert(z.anwahlen, "zahl") : <span className="text-muted">–</span>}</td>
                      <td className="tabular py-2 pr-3 text-right">{rep.rolle !== "closer" ? formatWert(z.termine, "zahl") : <span className="text-muted">–</span>}</td>
                      <td className="tabular py-2 pr-3 text-right">{rep.rolle !== "setter" ? formatWert(z.abschluesse, "zahl") : <span className="text-muted">–</span>}</td>
                      <td className="tabular py-2 pr-3 text-right">{rep.rolle !== "setter" ? formatWert(z.umsatz, "eur") : <span className="text-muted">–</span>}</td>
                      <td className="py-2">
                        <span className="flex flex-wrap items-center gap-2">
                          <AmpelPill a={c.stufe} text={c.stufe === "gruen" ? "ok" : c.stufe === "gelb" ? "beobachten" : "Coaching"} />
                          <span className="text-ink-2">{c.text}</span>
                          {c.modul && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">TRIAS {c.modul}</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
