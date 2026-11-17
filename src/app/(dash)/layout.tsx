import { Suspense } from "react";
import { redirect } from "next/navigation";
import { BEREICHE, nutzer } from "@/lib/auth";
import { ladeDataset } from "@/lib/data";
import { FilterLeiste } from "@/components/filter-leiste";
import { Navigation } from "@/components/navigation";

export const dynamic = "force-dynamic";

function standText(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (new Date(iso).getTime() <= 0) return "noch kein Sync";
  if (min < 1) return "Stand: gerade eben";
  if (min < 120) return `Stand: vor ${min} Min.`;
  return `Stand: ${new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}`;
}

function istVeraltet(iso: string) {
  return Date.now() - new Date(iso).getTime() > 3 * 3600000;
}

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const n = await nutzer();
  if (!n) redirect("/login");
  const ds = await ladeDataset();
  const erlaubt = Object.entries(BEREICHE).filter(([, r]) => r.includes(n.rolle)).map(([p]) => p);
  const kampagnen = [...new Map(ds.ads.map((a) => [a.campaignId, { id: a.campaignId, name: a.campaignName }])).values()];
  const veraltet = ds.quelle === "supabase" && istVeraltet(ds.stand);
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Suspense><Navigation erlaubt={erlaubt} name={n.name} rolle={n.rolle} demo={n.demo} /></Suspense>
      <main className="min-w-0 flex-1 px-4 pb-16 sm:px-6">
        {ds.syncFehler && <div className="-mx-4 mb-0 bg-bad px-4 py-2 text-sm font-medium text-white sm:-mx-6 sm:px-6">Sync-Fehler: {ds.syncFehler}</div>}
        {ds.quelle === "demo" && (
          <div className="-mx-4 bg-warn-soft px-4 py-2 text-[13px] text-warn-ink sm:-mx-6 sm:px-6">
            <strong>Demo-Daten.</strong> Noch keine echten Daten angebunden – alle Zahlen sind simuliert. Sobald Supabase, Close und Meta verbunden sind, erscheinen hier die echten Werte.
          </div>
        )}
        {veraltet && <div className="-mx-4 bg-bad-soft px-4 py-2 text-[13px] text-bad-ink sm:-mx-6 sm:px-6">Letzter erfolgreicher Sync ist über 3 Stunden her.</div>}
        <Suspense>
          <FilterLeiste optionen={{ kampagnen, reps: ds.reps.filter((r) => r.aktiv).map((r) => ({ id: r.id, name: r.name })), zeigeRep: n.rolle !== "rep" }} standText={standText(ds.stand)} />
        </Suspense>
        {children}
      </main>
    </div>
  );
}
