import { Suspense } from "react";
import { redirect } from "next/navigation";
import { BEREICHE, darf, nutzer, stufenLabel } from "@/lib/auth";
import { ladeDataset } from "@/lib/data";
import { datenStart } from "@/lib/seite";
import { Kopfleiste, Sidebar } from "@/components/navigation";
import { DatenProvider } from "@/components/zeitraum";

const TZ = "Europe/Berlin";

function zeitText(iso: string) {
  return new Date(iso).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ });
}
function istVeraltet(iso: string) {
  return Date.now() - new Date(iso).getTime() > 3 * 3600000;
}

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const n = await nutzer();
  if (!n) redirect("/login");
  const ds = await ladeDataset();
  const erlaubt = Object.keys(BEREICHE).filter((p) => darf(n.rolle, p));
  const kampagnen = [...new Map(ds.ads.map((a) => [a.campaignId, { id: a.campaignId, name: a.campaignName }])).values()];
  const keinSync = new Date(ds.stand).getTime() <= 0;
  const veraltet = ds.quelle === "supabase" && !keinSync && istVeraltet(ds.stand);
  const stand = keinSync ? "noch kein Sync" : zeitText(ds.stand) + " Uhr";
  const standZeit = keinSync ? "–" : new Date(ds.stand).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) + " Uhr";
  const initialen = n.name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "CE";
  return (
    <DatenProvider wert={{ start: datenStart(ds), kampagnen, reps: ds.reps.filter((r) => r.aktiv).map((r) => ({ id: r.id, name: r.name })), zeigeRep: n.rolle !== "rep" }}>
      <div className="flex min-h-screen">
        <Suspense><Sidebar erlaubt={erlaubt} demo={ds.quelle === "demo"} quellenText={ds.quelle === "demo" ? "Simuliert" : "Close · Meta"} standZeit={standZeit} /></Suspense>
        <div className="min-w-0 flex-1 p-3 sm:p-4">
          <Suspense>
            <Kopfleiste standText={ds.quelle === "demo" ? `Demo-Daten · noch keine echten Zahlen angebunden` : `Zahlen live · Stand ${stand}`}
              name={n.demo ? "Demo-Modus" : n.name} stufe={n.demo ? "ohne Login" : stufenLabel(n.rolle)} initialen={n.demo ? "CE" : initialen} erlaubt={erlaubt} demo={n.demo} />
          </Suspense>
          {ds.syncFehler && <div className="mb-4 rounded-2xl bg-bad px-5 py-3 text-sm font-medium text-white">Sync-Fehler: {ds.syncFehler}</div>}
          {veraltet && <div className="mb-4 rounded-2xl bg-bad-soft px-5 py-3 text-sm text-bad-ink">Letzter erfolgreicher Sync ist über 3 Stunden her.</div>}
          <main className="min-h-[calc(100vh-8rem)] rounded-[34px] border border-[var(--glass-border)] bg-panel px-4 py-6 shadow-[inset_0_1px_0_var(--glass-edge)] sm:px-8 sm:py-9">{children}</main>
        </div>
      </div>
    </DatenProvider>
  );
}
