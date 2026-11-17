import Link from "next/link";
import { seite, type SP } from "@/lib/seite";
import { meinTag } from "@/lib/kpi/team";
import { formatWert } from "@/lib/kpi/katalog";
import { AmpelPill, Card, CloseLink, Leer, SeitenKopf, cx } from "@/components/ui";
import type { RepZeile } from "@/lib/kpi/engine";

const TYP: Record<string, string> = { erstgespraech: "Erstgespräch", beratung: "Beratungsgespräch", cc2: "CC2" };
const OUTCOME: Record<string, string> = { stattgefunden: "stattgefunden", no_show: "No Show", verschoben: "verschoben", abgesagt: "abgesagt" };
const vorEinerStunde = () => Date.now() - 3600000;
const uhr = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
const datum = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

function Fortschritt({ titel, zeilen }: { titel: string; zeilen: { label: string; ist: number; ziel: number | null; format: "zahl" | "eur" }[] }) {
  return (
    <Card titel={titel}>
      <ul className="flex flex-col gap-3">
        {zeilen.map((z) => {
          const q = z.ziel ? z.ist / z.ziel : null;
          return (
            <li key={z.label}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-ink-2">{z.label}</span>
                <span className="tabular"><strong className="text-base">{formatWert(z.ist, z.format === "eur" ? "eur" : "zahl")}</strong>{z.ziel != null && <span className="text-muted"> / {formatWert(z.ziel, z.format === "eur" ? "eur" : "zahl")}</span>}</span>
              </div>
              {q != null && (
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-[var(--s1)]" style={{ width: `${Math.min(100, q * 100)}%` }} /></div>
                  <AmpelPill a={q >= 1 ? "gruen" : q >= 0.7 ? "gelb" : "rot"} text={`${Math.round(q * 100)} %`} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {zeilen.every((z) => z.ziel == null) && <p className="mt-2 text-xs text-muted">Keine persönlichen Ziele hinterlegt (Einstellungen → Ziele je Rep).</p>}
    </Card>
  );
}

function KurzListe<T extends { id: string }>({ items, render, sichtbar = 8 }: { items: T[]; render: (x: T) => React.ReactNode; sichtbar?: number }) {
  const zeile = (x: T) => <li key={x.id} className="flex items-center justify-between gap-2 py-2">{render(x)}</li>;
  return (
    <>
      <ul className="divide-y divide-[var(--border)] text-sm">{items.slice(0, sichtbar).map(zeile)}</ul>
      {items.length > sichtbar && (
        <details className="group">
          <summary className="cursor-pointer list-none py-2 text-xs font-medium text-accent group-open:hidden">{items.length - sichtbar} weitere anzeigen</summary>
          <ul className="divide-y divide-[var(--border)] border-t border-line text-sm">{items.slice(sichtbar, 200).map(zeile)}</ul>
        </details>
      )}
    </>
  );
}

const VERGLEICH: { label: string; wert: (r: RepZeile) => number | null; einheit: "zahl" | "pct" | "eur" | "min"; hoch: boolean; rolle: "setter" | "closer" }[] = [
  { label: "Anwahlen", wert: (r) => r.anwahlen, einheit: "zahl", hoch: true, rolle: "setter" },
  { label: "Erreichbarkeit", wert: (r) => r.erreichbarkeit, einheit: "pct", hoch: true, rolle: "setter" },
  { label: "Termine gebucht", wert: (r) => r.termine, einheit: "zahl", hoch: true, rolle: "setter" },
  { label: "Show-Rate", wert: (r) => r.showRate, einheit: "pct", hoch: true, rolle: "setter" },
  { label: "Speed-to-Lead", wert: (r) => r.speedToLead, einheit: "min", hoch: false, rolle: "setter" },
  { label: "Beratungen stattgefunden", wert: (r) => r.bgShows, einheit: "zahl", hoch: true, rolle: "closer" },
  { label: "Abschlüsse", wert: (r) => r.abschluesse, einheit: "zahl", hoch: true, rolle: "closer" },
  { label: "Closing-Rate", wert: (r) => r.closingRate, einheit: "pct", hoch: true, rolle: "closer" },
  { label: "Umsatz", wert: (r) => r.umsatz, einheit: "eur", hoch: true, rolle: "closer" },
];

export default async function MeinTagSeite({ searchParams }: { searchParams: SP }) {
  const { ds, nutzer, f } = await seite("/mein-tag", searchParams);
  const aktive = ds.reps.filter((r) => r.aktiv);
  const repId = nutzer.rolle === "rep" ? nutzer.repId : f.rep ?? aktive[0]?.id ?? null;
  const rep = ds.reps.find((r) => r.id === repId);
  if (!rep) {
    return (
      <>
        <SeitenKopf titel="Mein Tag" />
        <Leer>{nutzer.rolle === "rep" ? "Deinem Login ist noch kein Close-User zugeordnet. Bitte den Admin, das in den Einstellungen zu hinterlegen." : "Noch keine Reps vorhanden."}</Leer>
      </>
    );
  }
  const m = meinTag(ds, rep.id);
  const grenze = vorEinerStunde();
  const vorname = rep.name.split(" ")[0];
  const offen = m.noShows.length + m.followUps.length;

  return (
    <>
      <SeitenKopf titel={nutzer.rolle === "rep" ? `Mein Tag, ${vorname}` : `Tag von ${rep.name}`}
        klartext={<>Heute {m.termineHeute.length} {m.termineHeute.length === 1 ? "Termin" : "Termine"}{offen > 0 ? <>, {offen} offene Punkte zum Nachfassen</> : ", nichts offen"}.{nutzer.rolle !== "rep" && <span className="text-muted"> Rep oben in der Filterleiste wählen.</span>}</>} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Fortschritt titel="Meine Ziele heute" zeilen={m.heute} />
        <Fortschritt titel="Meine Ziele diese Woche" zeilen={m.woche} />
      </div>

      <Card className="mt-3" titel={`Meine Termine heute (${m.termineHeute.length})`}>
        {m.termineHeute.length === 0 ? <Leer>Heute keine Termine.</Leer> : (
          <ul className="divide-y divide-[var(--border)]">
            {m.termineHeute.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-12 shrink-0 tabular font-semibold">{uhr(t.startsAt)}</span>
                <span className="min-w-0 flex-1"><CloseLink leadId={t.leadId}><span className="font-medium">{t.name}</span></CloseLink><span className="block text-xs text-muted">{TYP[t.typ]}</span></span>
                {t.outcome ? <span className="text-xs text-muted">{OUTCOME[t.outcome]}</span>
                  : new Date(t.startsAt).getTime() < grenze ? <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[11px] text-warn-ink">Outcome fehlt</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card titel={`No-Shows zurückholen (${m.noShows.length})`}>
          {m.noShows.length === 0 ? <Leer>Keine offenen No-Shows der letzten 30 Tage.</Leer> : (
            <KurzListe items={m.noShows} render={(n) => (<>
              <CloseLink leadId={n.leadId}><span className="font-medium">{n.name}</span></CloseLink>
              <span className="text-xs text-muted">{TYP[n.typ]} · {datum(n.startsAt)}</span>
            </>)} />
          )}
        </Card>
        <Card titel={`Fällige Follow-ups (${m.followUps.length})`}>
          {m.followUps.length === 0 ? <Leer>Keine fälligen Aufgaben.</Leer> : (
            <KurzListe items={m.followUps} render={(x) => (<>
              <CloseLink leadId={x.leadId}><span className="font-medium">{x.name}</span></CloseLink>
              <span className={cx("text-xs", x.ueberfaellig ? "font-medium text-bad-ink" : "text-muted")}>{x.ueberfaellig ? "überfällig seit " : "fällig "}{datum(x.due)}</span>
            </>)} />
          )}
        </Card>
      </div>

      <Card className="mt-3" titel="Meine Zahlen vs. Team (diese Woche)" aktion={<Link href={`/team/${rep.id}`} className="text-xs text-accent hover:underline">Scorecard →</Link>}>
        <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {VERGLEICH.filter((v) => rep.rolle === "beides" || v.rolle === rep.rolle).map((v) => {
            const ich = m.ich ? v.wert(m.ich) : null, team = v.wert(m.team);
            const besser = ich != null && team != null ? (v.hoch ? ich >= team : ich <= team) : null;
            return (
              <li key={v.label} className="flex items-center justify-between gap-2 border-b border-line py-2 text-sm">
                <span className="text-ink-2">{v.label}</span>
                <span className="flex items-center gap-2">
                  <strong className="tabular">{formatWert(ich, v.einheit)}</strong>
                  <span className="text-xs text-muted tabular">Team {formatWert(team, v.einheit)}</span>
                  {besser != null && <span className={cx("text-xs", besser ? "text-good-ink" : "text-bad-ink")} aria-label={besser ? "besser als Team" : "schlechter als Team"}>{besser ? "▲" : "▼"}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
