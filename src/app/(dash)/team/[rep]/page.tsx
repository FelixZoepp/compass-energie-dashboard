import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { seite, type SP } from "@/lib/seite";
import { aktivitaetProTag, repWochenTrend, scorecard } from "@/lib/kpi/team";
import { ampel, formatWert, type KpiId } from "@/lib/kpi/katalog";
import { AmpelPill, AmpelZelle, Card, SeitenKopf } from "@/components/ui";
import { BalkenV, ChartRahmen, KombiChart } from "@/components/charts";
import { ScoreRadar } from "@/components/team/radar";
import type { RepZeile } from "@/lib/kpi/engine";

const ROLLE: Record<string, string> = { setter: "Setter", closer: "Closer", beides: "Setter + Closer" };

type Zeile = { label: string; kpi?: KpiId; wert: (r: RepZeile) => number | null; einheit: "zahl" | "eur" | "pct" | "min" | "tage"; rolle: "setter" | "closer" };
const ZEILEN: Zeile[] = [
  { label: "Anwahlen", kpi: "anwahlen", wert: (r) => r.anwahlen, einheit: "zahl", rolle: "setter" },
  { label: "Gesprächszeit", kpi: "gespraechszeit", wert: (r) => r.gespraechsMin, einheit: "min", rolle: "setter" },
  { label: "Erreichbarkeit", kpi: "erreichbarkeit", wert: (r) => r.erreichbarkeit, einheit: "pct", rolle: "setter" },
  { label: "Speed-to-Lead", kpi: "speedToLead", wert: (r) => r.speedToLead, einheit: "min", rolle: "setter" },
  { label: "Termine gebucht", wert: (r) => r.termine, einheit: "zahl", rolle: "setter" },
  { label: "Show-Rate Erstgespräch", kpi: "showRateEG", wert: (r) => r.showRate, einheit: "pct", rolle: "setter" },
  { label: "Qualifizierungsquote", kpi: "qualifizierungsquote", wert: (r) => r.qualiQuote, einheit: "pct", rolle: "setter" },
  { label: "Beratungen fällig", wert: (r) => r.bg, einheit: "zahl", rolle: "closer" },
  { label: "Beratungen stattgefunden", wert: (r) => r.bgShows, einheit: "zahl", rolle: "closer" },
  { label: "Abschlüsse", kpi: "abschluesse", wert: (r) => r.abschluesse, einheit: "zahl", rolle: "closer" },
  { label: "Closing-Rate", kpi: "closingRate", wert: (r) => r.closingRate, einheit: "pct", rolle: "closer" },
  { label: "Umsatz", kpi: "umsatz", wert: (r) => r.umsatz, einheit: "eur", rolle: "closer" },
  { label: "Ø Auftragswert", kpi: "aov", wert: (r) => r.aov, einheit: "eur", rolle: "closer" },
  { label: "Offene Angebote", wert: (r) => r.offeneAngebote, einheit: "zahl", rolle: "closer" },
  { label: "Ø Tage im Angebot", wert: (r) => r.tageImAngebot, einheit: "tage", rolle: "closer" },
];

export default async function RepScorecard({ params, searchParams }: { params: Promise<{ rep: string }>; searchParams: SP }) {
  const { rep } = await params;
  const { ds, nutzer, f } = await seite("/team", searchParams);
  if (nutzer.rolle === "rep" && nutzer.repId !== rep) redirect(nutzer.repId ? `/team/${nutzer.repId}` : "/team");
  // Rep-Filter der Leiste gilt hier nicht – die Scorecard zeigt immer den gewählten Rep
  const sc = scorecard(ds, rep, { ...f, rep: null });
  if (!sc) notFound();
  const trend = repWochenTrend(ds, rep);
  const aktiv = aktivitaetProTag(ds, rep);
  const zeilen = ZEILEN.filter((z) => sc.rep.rolle === "beides" || z.rolle === sc.rep.rolle);
  const istSetter = sc.rep.rolle !== "closer", istCloser = sc.rep.rolle !== "setter";
  const haupt = sc.coaching[0];

  return (
    <>
      <div className="mb-2 text-xs text-muted"><Link href="/team" className="hover:text-ink">Team</Link> / Scorecard</div>
      <SeitenKopf titel={sc.rep.name} klartext={<>{haupt.stufe === "gruen" ? haupt.text : <>Größter Hebel: <strong className="text-ink">{haupt.text}</strong>{haupt.modul && <> → TRIAS {haupt.modul}</>}</>} <span className="text-muted">({f.zeitraum.label}, {ROLLE[sc.rep.rolle]})</span></>} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        <Card className="lg:col-span-2" titel="Profil gegen Ziel und Team">
          <ScoreRadar daten={sc.radar} name={sc.rep.name} />
          <p className="text-xs text-muted">100 % = Ziel (Mengenziele anteilig für den Zeitraum; ohne hinterlegtes Ziel = Teamschnitt). Gedeckelt bei 150 %.</p>
        </Card>
        <Card className="lg:col-span-3" titel="Alle Kennzahlen">
          <div className="scroll-x">
            <table className="w-full min-w-[460px] text-sm">
              <thead className="text-left text-xs text-muted"><tr className="border-b border-line"><th className="py-2 pr-3 font-medium">Kennzahl</th><th className="py-2 pr-3 text-right font-medium">{sc.rep.name.split(" ")[0]}</th><th className="py-2 pr-3 text-right font-medium">Teamschnitt</th><th className="py-2 text-right font-medium">Bewertung</th></tr></thead>
              <tbody>
                {zeilen.map((z) => {
                  const w = z.wert(sc.zeile), tw = z.wert(sc.team);
                  const a = z.kpi ? ampel(z.kpi, w, undefined, ds.settings) : "neutral";
                  return (
                    <tr key={z.label} className="border-b border-line last:border-0">
                      <td className="py-1.5 pr-3 text-ink-2">{z.label}</td>
                      <td className="tabular py-1.5 pr-3 text-right font-medium"><AmpelZelle a={a}>{formatWert(w, z.einheit)}</AmpelZelle></td>
                      <td className="tabular py-1.5 pr-3 text-right text-ink-2">{formatWert(tw, z.einheit)}</td>
                      <td className="py-1.5 text-right">{a !== "neutral" ? <AmpelPill a={a} /> : w != null && tw != null && tw > 0 ? <span className="text-xs text-muted">{w >= tw ? "über Schnitt" : "unter Schnitt"}</span> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="mt-3" titel="Coaching-Ampel">
        <ul className="flex flex-col gap-2">
          {sc.coaching.map((c, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <AmpelPill a={c.stufe} text={c.stufe === "gruen" ? "ok" : c.stufe === "gelb" ? "beobachten" : "Coaching nötig"} />
              <span>{c.text}</span>
              {c.modul && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">TRIAS {c.modul}</span>}
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartRahmen titel={istCloser && !istSetter ? "Umsatz pro Woche (8 Wochen)" : "Termine pro Woche (8 Wochen)"}>
          {istCloser && !istSetter
            ? <KombiChart daten={trend} x="label" format="eur" reihen={[{ key: "umsatz", name: "Umsatz", typ: "bar" }]} />
            : <KombiChart daten={trend} x="label" reihen={[{ key: "termine", name: "Termine", typ: "bar" }, ...(istCloser ? [{ key: "abschluesse", name: "Abschlüsse", typ: "line" as const, farbe: "var(--s2)" }] : [])]} />}
        </ChartRahmen>
        <ChartRahmen titel="Aktivität pro Tag (14 Tage)">
          <BalkenV daten={aktiv} x="label" reihen={[{ key: "anwahlen", name: "Anwahlen" }, { key: "gespraeche", name: "Gespräche" }]} />
        </ChartRahmen>
      </div>
    </>
  );
}
