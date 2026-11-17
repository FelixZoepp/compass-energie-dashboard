"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Abschnitt } from "./feld";

export interface SyncRun { id: number; quelle: string; started_at: string; finished_at: string | null; ok: boolean | null; fehler: string | null; details: Record<string, unknown> | null }

const QUELLEN = [
  { id: "close", label: "Close CRM" },
  { id: "meta", label: "Meta Insights" },
  { id: "meta-creatives", label: "Meta Creatives" },
  { id: "webhook", label: "Close-Webhook (Fehler)" },
];
const zeit = (iso: string) => new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });

export function SyncStatus({ runs, live }: { runs: SyncRun[]; live: boolean }) {
  const router = useRouter();
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function starten(quelle: "close" | "meta", voll = false) {
    setLaeuft(quelle); setMsg(null);
    const res = await fetch("/api/admin/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quelle, voll }) });
    const json = await res.json().catch(() => ({}));
    setLaeuft(null);
    setMsg(res.ok && json.ok ? { ok: true, text: `${quelle === "close" ? "Close" : "Meta"} synchronisiert: ${JSON.stringify(json.erg)}` } : { ok: false, text: json.fehler ?? `Fehler ${res.status}` });
    router.refresh();
  }

  return (
    <section className="card p-4 sm:p-5">
      <Abschnitt titel="Sync-Status" beschreibung="Close alle 15 Min. + Webhook in Echtzeit, Meta stündlich (heute) und täglich 05:00 (letzte 28 Tage neu).">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUELLEN.map((q) => {
            const r = runs.find((x) => x.quelle === q.id);
            const letzterOk = runs.find((x) => x.quelle === q.id && x.ok);
            return (
              <div key={q.id} className="rounded-lg border border-line bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-2 text-sm font-medium">
                  {q.label}
                  {!r ? <span className="text-xs text-muted">noch nie</span> : r.ok ? <CheckCircle2 className="h-4 w-4 text-good" aria-label="ok" /> : r.finished_at ? <XCircle className="h-4 w-4 text-bad" aria-label="Fehler" /> : <Loader2 className="h-4 w-4 animate-spin text-muted" aria-label="läuft" />}
                </div>
                <div className="mt-1 text-xs text-muted">{r ? `Zuletzt: ${zeit(r.started_at)}${r.ok === false ? " – Fehler" : ""}` : "–"}</div>
                {letzterOk && r && !r.ok && <div className="text-xs text-muted">Letzter Erfolg: {zeit(letzterOk.started_at)}</div>}
                {r?.fehler && <div className="mt-1 line-clamp-3 text-xs text-bad-ink" title={r.fehler}>{r.fehler}</div>}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!live || !!laeuft} onClick={() => starten("close")} className="h-9 rounded-lg border border-line bg-surface px-3 text-sm hover:bg-surface-2 disabled:opacity-50">{laeuft === "close" ? "Close läuft …" : "Close jetzt synchronisieren"}</button>
          <button type="button" disabled={!live || !!laeuft} onClick={() => starten("close", true)} className="h-9 rounded-lg border border-line bg-surface px-3 text-sm hover:bg-surface-2 disabled:opacity-50">Close komplett neu laden</button>
          <button type="button" disabled={!live || !!laeuft} onClick={() => starten("meta")} className="h-9 rounded-lg border border-line bg-surface px-3 text-sm hover:bg-surface-2 disabled:opacity-50">{laeuft === "meta" ? "Meta läuft …" : "Meta jetzt synchronisieren"}</button>
          <a href="/api/reports/daily?vorschau=1" target="_blank" className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm hover:bg-surface-2">Morgen-Briefing (Vorschau)</a>
          <a href="/api/reports/weekly?vorschau=1" target="_blank" className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm hover:bg-surface-2">Wochenreport (Vorschau)</a>
        </div>
        {!live && <p className="mt-2 text-xs text-muted">Demo-Modus: Sync ist nach der Supabase-Anbindung verfügbar.</p>}
        {msg && <p className={`mt-2 break-all text-sm ${msg.ok ? "text-good-ink" : "text-bad-ink"}`}>{msg.text}</p>}
        {runs.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs text-muted">Letzte {runs.length} Läufe</summary>
            <div className="scroll-x mt-2">
              <table className="w-full min-w-[600px] text-xs tabular">
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <td className="py-1 pr-2">{zeit(r.started_at)}</td><td className="py-1 pr-2">{r.quelle}</td>
                      <td className="py-1 pr-2">{r.ok ? "ok" : r.finished_at ? "Fehler" : "läuft"}</td>
                      <td className="py-1 text-muted">{r.fehler ?? (r.details ? JSON.stringify(r.details) : "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </Abschnitt>
    </section>
  );
}
