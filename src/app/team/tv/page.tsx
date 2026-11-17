import { erfordere } from "@/lib/auth";
import { ladeDataset } from "@/lib/data";
import { berechne, funnel, pacing } from "@/lib/kpi/engine";
import { leaderboard } from "@/lib/kpi/team";
import { zeitraum } from "@/lib/kpi/zeit";
import { TvAnsicht } from "@/components/team/tv";

export const metadata = { title: "Compass Energie · TV" };

const jetzt = () => new Date();

export default async function TvSeite() {
  await erfordere("/team");
  const ds = await ladeDataset();
  const now = jetzt();
  const heute = leaderboard(ds, "heute", now);
  const monat = leaderboard(ds, "monat", now);
  const p = pacing(ds, { now });
  const k = berechne(ds, { zeitraum: zeitraum("monat", now), sicht: "ereignis", now });
  const stufen = funnel(k).filter((s) => s.key !== "impressions" && s.key !== "klicks").map((s) => ({ label: s.label, wert: s.wert, conv: s.conv }));
  const ohneFunktion = (l: ReturnType<typeof leaderboard>) => ({ termine: l.termine, abschluesse: l.abschluesse, umsatz: l.umsatz });
  return (
    <TvAnsicht
      heute={ohneFunktion(heute)}
      monat={ohneFunktion(monat)}
      pacing={{ ziel: p.ziel, umsatz: p.umsatz, sollHeute: p.sollHeute, forecast: p.forecast, prognoseQuote: p.prognoseQuote, atVergangen: p.atVergangen, atGesamt: p.atGesamt, abschluesse: k.abschluesse }}
      funnel={stufen}
      demo={ds.quelle === "demo"}
      stand={now.toISOString()}
    />
  );
}
