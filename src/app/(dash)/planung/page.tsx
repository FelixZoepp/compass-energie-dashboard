import { seite, type SP } from "@/lib/seite";
import { berechne } from "@/lib/kpi/engine";
import { addDays, startOfDay } from "@/lib/kpi/zeit";
import { SeitenKopf } from "@/components/ui";
import { Planungsrechner, type Quoten } from "@/components/planung/rechner";

// Startwerte, falls eine Quote mangels Daten nicht berechenbar ist (Spezifikation 4.x)
const START: Quoten = { aov: 4000, closingRate: 0.25, showRateBG: 0.8, qualifizierungsquote: 0.5, showRateEG: 0.7, buchungsquote: 0.3, cpl: 60, anwahlenProLead: 7, gespraechsMinProLead: 6 };

export default async function Planung({ searchParams }: { searchParams: SP }) {
  const { ds, f } = await seite("/planung", searchParams);
  const heute = startOfDay(new Date());
  const k = berechne(ds, { ...f, sicht: "ereignis", zeitraum: { key: "90t", von: addDays(heute, -89), bis: addDays(heute, 1), label: "Letzte 90 Tage" } });
  const echt: Partial<Quoten> = {
    aov: k.aov ?? undefined,
    closingRate: k.closingRate ?? undefined,
    showRateBG: k.showRateBG ?? undefined,
    qualifizierungsquote: k.qualifizierungsquote ?? undefined,
    showRateEG: k.showRateEG ?? undefined,
    buchungsquote: k.buchungsquote ?? undefined,
    cpl: k.cpl ?? undefined,
    anwahlenProLead: k.anwahlenProLead ?? undefined,
    gespraechsMinProLead: k.leadsAngerufen ? k.gespraechsMin / k.leadsAngerufen : undefined,
  };
  const quoten = Object.fromEntries(Object.entries(START).map(([key, v]) => [key, echt[key as keyof Quoten] ?? v])) as Quoten;
  const ausStart = Object.keys(START).filter((key) => echt[key as keyof Quoten] == null);
  const monat = new Date().toISOString().slice(0, 7);
  return (
    <>
      <SeitenKopf titel="Planungsrechner" klartext="Vom Umsatzziel rückwärts: Wie viele Leads, Termine, Werbebudget und Vertriebsstunden braucht es – mit den echten Quoten der letzten 90 Tage." />
      <Planungsrechner quoten={quoten} ausStart={ausStart} zielStart={ds.settings.monatsziel[monat] ?? 50000}
        basis={{ abschluesse: k.abschluesse, bgShows: k.bgShows, egShows: k.egShows, leads: k.leads }} />
    </>
  );
}
