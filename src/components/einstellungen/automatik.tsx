"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export interface LogZeile { id: number; at: string; lead_id: string | null; regel: string; beschreibung: string | null; ok: boolean; trocken: boolean; fehler: string | null }

const GRUPPEN = [
  { id: "lead", label: "0 · Neuer Lead", text: "Neuer Lead in Close → Status „Neu“ + Aufgabe „sofort anrufen“ für den Setter" },
  { id: "erstkontakt", label: "1 · Erstkontakt (Terminierung)", text: "Nicht erreicht → Sperre · Erstgespräch terminiert → Opp „Setting“ · Rückruf → Aufgabe" },
  { id: "erstgespraech", label: "2 · Erstgespräch (Setting)", text: "Beratung terminiert → Opp „Closing terminiert“ · No-Show → Rückholaufgabe · Follow-up → Aufgabe" },
  { id: "closing", label: "3 · Beratung (Closing)", text: "Angebot → Opp „Angebot“ + Nachfassen Tag 1/3/7 · Gewonnen → Kunde · Verloren → Verlustgrund, Sperre" },
  { id: "followup", label: "4 · Follow-up", text: "Weiter Follow-up → Sperre + Aufgabe · Gewonnen/Verloren wie Closing" },
];

function Schalter({ an, onChange, disabled, label }: { an: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={an} aria-label={label} disabled={disabled} onClick={() => onChange(!an)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${an ? "bg-brand-600" : "bg-grey-soft border border-line"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${an ? "left-6" : "left-1"}`} />
    </button>
  );
}

export function AutomatikEinstellungen({ start, log, live }: { start: { aktiv: boolean; regeln: Record<string, boolean> }; log: LogZeile[]; live: boolean }) {
  const router = useRouter();
  const [a, setA] = useState(start);
  const [msg, setMsg] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  async function speichern(neu: { aktiv?: boolean; regeln?: Record<string, boolean> }) {
    setLaedt(true); setMsg(null);
    const res = await fetch("/api/automatik", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(neu) });
    const json = await res.json().catch(() => ({}));
    setLaedt(false);
    if (!res.ok || !json.ok) return setMsg(json.fehler ?? `Fehler ${res.status}`);
    setA(json.automatik); router.refresh();
  }
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-[17px] font-semibold">Close-Automatik</h2>
          <p className="mt-1 text-[13px] text-ink-2">Wenn ein Protokoll in Close abgehakt wird, setzt das Dashboard Lead-Status, Opportunity, Sperre und Aufgaben. Es gehen <strong>keine Nachrichten an Leads</strong> raus. Solange die Automatik aus ist, wird nur protokolliert, was passieren würde (Probelauf unten).</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[14px] font-semibold ${a.aktiv ? "text-good-ink" : "text-muted"}`}>{a.aktiv ? "Automatik AN" : "Automatik AUS"}</span>
          <Schalter an={a.aktiv} disabled={!live || laedt} onChange={(v) => { if (!v || confirm("Automatik einschalten? Ab jetzt ändert das Dashboard Leads und Opportunities in Close.")) speichern({ aktiv: v }); }} label="Automatik gesamt" />
        </div>
      </div>
      <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {GRUPPEN.map((g) => {
          const an = a.regeln[g.id] !== false;
          return (
            <li key={g.id} className="flex items-start justify-between gap-3 rounded-2xl bg-surface-2 p-4">
              <div><div className="text-[14px] font-medium">{g.label}</div><div className="mt-1 text-[12px] text-ink-2">{g.text}</div></div>
              <Schalter an={an} disabled={!live || laedt} onChange={(v) => speichern({ regeln: { [g.id]: v } })} label={g.label} />
            </li>
          );
        })}
      </ul>
      {msg && <p className="mt-3 text-sm text-bad-ink">{msg}</p>}
      {!live && <p className="mt-3 text-[13px] text-muted">Demo-Modus: Schalten ist erst nach der Supabase-Anbindung möglich.</p>}
      <h3 className="mt-6 text-[14px] font-semibold">Letzte Protokolle ({log.length})</h3>
      {log.length === 0 ? <p className="mt-2 text-[13px] text-muted">Noch keine Protokolle eingegangen (Close-Webhook muss registriert sein).</p> : (
        <div className="scroll-x mt-2">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead><tr className="text-left text-[12px] text-muted"><th className="pb-2 pr-3 font-medium">Zeit</th><th className="pb-2 pr-3 font-medium">Regel</th><th className="pb-2 pr-3 font-medium">Was passiert(e)</th><th className="pb-2 font-medium">Status</th></tr></thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id} className="border-t border-line">
                  <td className="py-2 pr-3 whitespace-nowrap text-ink-2">{new Date(l.at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="py-2 pr-3 font-medium">{l.regel}</td>
                  <td className="py-2 pr-3">{l.beschreibung}{l.lead_id && <> · <a className="text-accent" href={`https://app.close.com/lead/${l.lead_id}/`} target="_blank" rel="noreferrer">Lead</a></>}</td>
                  <td className="py-2 whitespace-nowrap">{l.fehler ? <span className="text-bad-ink">Fehler</span> : l.trocken ? <span className="text-muted">Probelauf</span> : <span className="text-good-ink">ausgeführt</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
