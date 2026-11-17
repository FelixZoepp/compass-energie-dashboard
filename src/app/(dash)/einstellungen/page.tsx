import { erfordere } from "@/lib/auth";
import { ladeDataset } from "@/lib/data";
import { adminClient } from "@/lib/supabase/admin";
import { supabaseKonfiguriert } from "@/lib/supabase/env";
import { KPIS, type KpiDef } from "@/lib/kpi/katalog";
import { SeitenKopf } from "@/components/ui";
import { EinstellungenForm } from "@/components/einstellungen/form";
import { Benutzerverwaltung, type Profil } from "@/components/einstellungen/benutzer";
import { SyncStatus, type SyncRun } from "@/components/einstellungen/sync-status";
import { AutomatikEinstellungen, type LogZeile } from "@/components/einstellungen/automatik";

export default async function Einstellungen() {
  const nutzer = await erfordere("/einstellungen");
  const ds = await ladeDataset();
  const live = supabaseKonfiguriert();
  let profile: Profil[] = [];
  let runs: SyncRun[] = [];
  let log: LogZeile[] = [];
  let automatik = { aktiv: false, regeln: {} as Record<string, boolean> };
  if (live) {
    const [p, r, l, st] = await Promise.all([
      adminClient().from("profiles").select("id,email,name,rolle,rep_id,aktiv").order("created_at"),
      adminClient().from("sync_runs").select("id,quelle,started_at,finished_at,ok,fehler,details").order("started_at", { ascending: false }).limit(40),
      adminClient().from("automatik_log").select("id,at,lead_id,regel,beschreibung,ok,trocken,fehler").order("at", { ascending: false }).limit(25),
      adminClient().from("settings").select("data").eq("id", 1).maybeSingle(),
    ]);
    log = (l.data ?? []) as LogZeile[];
    const a = (st.data?.data as { automatik?: { aktiv?: boolean; regeln?: Record<string, boolean> } } | undefined)?.automatik;
    automatik = { aktiv: a?.aktiv === true, regeln: a?.regeln ?? {} };
    profile = (p.data ?? []) as Profil[];
    runs = (r.data ?? []) as SyncRun[];
  }
  const kpis = Object.values(KPIS as Record<string, KpiDef>).filter((k) => k.richtung && k.gruen != null && k.gelb != null)
    .map((k) => ({ id: k.id, label: k.label, einheit: k.einheit, richtung: k.richtung!, gruen: k.gruen!, gelb: k.gelb! }));
  return (
    <>
      <SeitenKopf titel="Einstellungen" ohneZeitraum klartext={live ? "Ziele, Ampeln und Kosten steuern alle Bewertungen im Dashboard." : "Demo-Modus: Formulare sind sichtbar, Speichern ist erst nach der Supabase-Anbindung möglich."} />
      <div className="flex flex-col gap-4">
        <EinstellungenForm settings={ds.settings} reps={ds.reps} kpis={kpis} live={live} />
        <Benutzerverwaltung profile={profile} reps={ds.reps.map((r) => ({ id: r.id, name: r.name }))} live={live} meineRolle={nutzer.rolle} />
        <AutomatikEinstellungen start={automatik} log={log} live={live} />
        <SyncStatus runs={runs} live={live} />
      </div>
    </>
  );
}
