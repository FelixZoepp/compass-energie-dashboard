"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OppStage, Rep, Settings } from "@/lib/types";
import { Abschnitt, Feld, ZahlFeld, eingabe } from "./feld";

interface KpiZeile { id: string; label: string; einheit: string; richtung: "hoch" | "niedrig"; gruen: number; gelb: number }

const STAGES: { id: OppStage; label: string }[] = [
  { id: "setting", label: "Setting" }, { id: "closing_terminiert", label: "Closing terminiert" }, { id: "closing_fu", label: "Closing FU" },
  { id: "angebot", label: "Angebot" }, { id: "cc2", label: "CC2" },
];
const TAGE = [["1", "Mo"], ["2", "Di"], ["3", "Mi"], ["4", "Do"], ["5", "Fr"], ["6", "Sa"], ["7", "So"]] as const;

/** Prozentwerte werden als 0–100 angezeigt, intern 0–1 gespeichert. */
const inPct = (v: number | null | undefined) => (v == null ? null : Math.round(v * 1000) / 10);
const ausPct = (v: number | null) => (v == null ? null : v / 100);

function monate(): string[] {
  const d = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const x = new Date(d.getFullYear(), d.getMonth() - 1 + i, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  });
}
const monatLabel = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString("de-DE", { month: "long", year: "numeric" });

export function EinstellungenForm({ settings, reps, kpis, live }: { settings: Settings; reps: Rep[]; kpis: KpiZeile[]; live: boolean }) {
  const router = useRouter();
  const [s, setS] = useState<Settings>(settings);
  const [repListe, setRepListe] = useState(reps.map((r) => ({ id: r.id, name: r.name, rolle: r.rolle, aktiv: r.aktiv })));
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const [mon] = useState(monate);
  const upd = (patch: Partial<Settings>) => setS((x) => ({ ...x, ...patch }));
  const geaendert = JSON.stringify(s) !== JSON.stringify(settings) || JSON.stringify(repListe) !== JSON.stringify(reps.map((r) => ({ id: r.id, name: r.name, rolle: r.rolle, aktiv: r.aktiv })));

  async function speichern() {
    setSpeichert(true); setStatus(null);
    const res = await fetch("/api/einstellungen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: s, reps: repListe }) });
    const json = await res.json().catch(() => ({}));
    setSpeichert(false);
    if (!res.ok || !json.ok) return setStatus({ ok: false, text: json.fehler ?? `Fehler ${res.status}` });
    setStatus({ ok: true, text: "Gespeichert." });
    router.refresh();
  }

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex flex-col gap-5">
        <Abschnitt titel="Monatsziele (Umsatz)" beschreibung="Grundlage für Pacing, Forecast und Planungsrechner.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {mon.map((m) => (
              <Feld key={m} label={monatLabel(m)}>
                <ZahlFeld wert={s.monatsziel[m] ?? null} schritt={1000} min={0} suffix="€"
                  onChange={(v) => { const z = { ...s.monatsziel }; if (v == null || v <= 0) delete z[m]; else z[m] = v; upd({ monatsziel: z }); }} />
              </Feld>
            ))}
          </div>
        </Abschnitt>

        <Abschnitt titel="Team: Rollen und Ziele je Monat" beschreibung="Rolle steuert, in welchen Tabellen jemand erscheint. Ziele für Leaderboard, Mein Tag und Scorecards.">
          {repListe.length === 0 ? <p className="text-sm text-muted">Noch keine Nutzer aus Close synchronisiert.</p> : (
            <div className="scroll-x">
              <table className="w-full min-w-[760px] text-sm">
                <thead><tr className="text-left text-xs text-muted">
                  <th className="pb-2 pr-2 font-medium">Name</th><th className="pb-2 pr-2 font-medium">Rolle</th><th className="pb-2 pr-2 font-medium">Aktiv</th>
                  <th className="pb-2 pr-2 font-medium">Umsatz</th><th className="pb-2 pr-2 font-medium">Abschlüsse</th><th className="pb-2 pr-2 font-medium">Termine</th><th className="pb-2 font-medium">Anwahlen</th>
                </tr></thead>
                <tbody>
                  {repListe.map((r, i) => {
                    const z = s.repZiele[r.id] ?? {};
                    const setZ = (k: keyof typeof z, v: number | null) => upd({ repZiele: { ...s.repZiele, [r.id]: { ...z, [k]: v ?? undefined } } });
                    return (
                      <tr key={r.id} className="border-t border-line">
                        <td className="py-2 pr-2 font-medium">{r.name}</td>
                        <td className="py-2 pr-2">
                          <select className={eingabe} value={r.rolle} onChange={(e) => setRepListe((l) => l.map((x, j) => (j === i ? { ...x, rolle: e.target.value as Rep["rolle"] } : x)))}>
                            <option value="setter">Setter</option><option value="closer">Closer</option><option value="beides">Beides</option>
                          </select>
                        </td>
                        <td className="py-2 pr-2"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={r.aktiv} onChange={(e) => setRepListe((l) => l.map((x, j) => (j === i ? { ...x, aktiv: e.target.checked } : x)))} aria-label={`${r.name} aktiv`} /></td>
                        <td className="py-2 pr-2"><ZahlFeld wert={z.umsatz} schritt={1000} min={0} suffix="€" onChange={(v) => setZ("umsatz", v)} /></td>
                        <td className="py-2 pr-2"><ZahlFeld wert={z.abschluesse} min={0} onChange={(v) => setZ("abschluesse", v)} /></td>
                        <td className="py-2 pr-2"><ZahlFeld wert={z.termine} min={0} onChange={(v) => setZ("termine", v)} /></td>
                        <td className="py-2"><ZahlFeld wert={z.anwahlen} schritt={50} min={0} onChange={(v) => setZ("anwahlen", v)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Abschnitt>

        <Abschnitt titel="Ampel-Schwellen" beschreibung="Grün ab / gelb ab. Bei „niedriger ist besser“ (z. B. CPL) gilt: grün bis / gelb bis. Leer = Startziel aus der Spezifikation.">
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2 xl:grid-cols-3">
            {kpis.map((k) => {
              const pct = k.einheit === "pct";
              const akt = s.schwellen[k.id];
              const setW = (feld: "gruen" | "gelb", v: number | null) => {
                const neu = { ...s.schwellen };
                const basis = akt ?? { gruen: k.gruen, gelb: k.gelb };
                const wert = pct ? ausPct(v) : v;
                if (wert == null) { delete neu[k.id]; } else neu[k.id] = { ...basis, [feld]: wert };
                upd({ schwellen: neu });
              };
              const suffix = pct ? "%" : k.einheit === "eur" ? "€" : k.einheit === "min" ? "Min" : undefined;
              return (
                <div key={k.id} className="grid grid-cols-[1fr_88px_88px] items-center gap-2">
                  <span className="truncate text-[13px]" title={k.label}>{k.label} <span className="text-muted">{k.richtung === "hoch" ? "↑" : "↓"}</span></span>
                  <ZahlFeld wert={pct ? inPct(akt?.gruen ?? k.gruen) : akt?.gruen ?? k.gruen} schritt={pct ? 1 : 0.5} suffix={suffix} onChange={(v) => setW("gruen", v)} />
                  <ZahlFeld wert={pct ? inPct(akt?.gelb ?? k.gelb) : akt?.gelb ?? k.gelb} schritt={pct ? 1 : 0.5} suffix={suffix} onChange={(v) => setW("gelb", v)} />
                </div>
              );
            })}
          </div>
          <div className="mt-1 grid grid-cols-[1fr_88px_88px] gap-2 text-[11px] text-muted md:w-1/2 xl:w-1/3"><span /><span>grün</span><span>gelb</span></div>
        </Abschnitt>

        <Abschnitt titel="Kosten und Preise" beschreibung="Für CAC (voll), Deckungsbeitrag und Rabattquote.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Feld label="Provisionsquote"><ZahlFeld wert={inPct(s.provisionsquote)} suffix="%" min={0} max={100} onChange={(v) => upd({ provisionsquote: ausPct(v) ?? 0 })} /></Feld>
            <Feld label="Toolkosten / Monat"><ZahlFeld wert={s.toolkostenMonat} suffix="€" min={0} schritt={50} onChange={(v) => upd({ toolkostenMonat: v ?? 0 })} /></Feld>
            <Feld label="Lieferkosten / Teilnehmer"><ZahlFeld wert={s.lieferkostenProTeilnehmer} suffix="€" min={0} schritt={10} onChange={(v) => upd({ lieferkostenProTeilnehmer: v ?? 0 })} /></Feld>
            {Object.entries(s.listenpreise).map(([paket, preis]) => (
              <Feld key={paket} label={`Listenpreis ${paket}`}><ZahlFeld wert={preis} suffix="€" min={0} schritt={100} onChange={(v) => upd({ listenpreise: { ...s.listenpreise, [paket]: v ?? 0 } })} /></Feld>
            ))}
          </div>
        </Abschnitt>

        <Abschnitt titel="Arbeitszeit, ICP und Pipeline" beschreibung="Arbeitszeit zählt für Speed-to-Lead. Wahrscheinlichkeiten für gewichtete Pipeline und Forecast (nach 3 Monaten aus echten Daten kalibrieren).">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <Feld label="Beginn"><ZahlFeld wert={s.arbeitszeit.start} min={0} max={23} suffix="Uhr" onChange={(v) => upd({ arbeitszeit: { ...s.arbeitszeit, start: v ?? 8 } })} /></Feld>
            <Feld label="Ende"><ZahlFeld wert={s.arbeitszeit.ende} min={1} max={24} suffix="Uhr" onChange={(v) => upd({ arbeitszeit: { ...s.arbeitszeit, ende: v ?? 19 } })} /></Feld>
            <Feld label="ICP: min. Vertriebler (B2B)"><ZahlFeld wert={s.icpMinTeam} min={0} onChange={(v) => upd({ icpMinTeam: v ?? 0 })} /></Feld>
            <div className="col-span-2 flex flex-col gap-1 text-[13px] text-ink-2 sm:col-span-4 lg:col-span-3">
              <span>Arbeitstage</span>
              <div className="flex flex-wrap gap-1.5">
                {TAGE.map(([n, l]) => {
                  const an = s.arbeitszeit.tage.includes(Number(n));
                  return (
                    <button key={n} type="button" aria-pressed={an} onClick={() => upd({ arbeitszeit: { ...s.arbeitszeit, tage: an ? s.arbeitszeit.tage.filter((t) => t !== Number(n)) : [...s.arbeitszeit.tage, Number(n)].sort() } })}
                      className={`h-9 w-11 rounded-lg border text-sm ${an ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-muted"}`}>{l}</button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {STAGES.map((st) => (
              <Feld key={st.id} label={`Wahrscheinl. ${st.label}`}>
                <ZahlFeld wert={inPct(s.stageWahrscheinlichkeit[st.id])} suffix="%" min={0} max={100} onChange={(v) => upd({ stageWahrscheinlichkeit: { ...s.stageWahrscheinlichkeit, [st.id]: ausPct(v) ?? 0 } })} />
              </Feld>
            ))}
          </div>
        </Abschnitt>

        <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap items-center justify-end gap-3 rounded-b-[14px] border-t border-line bg-surface px-4 py-3 sm:-mx-5 sm:-mb-5 sm:px-5">
          {status && <span className={`text-sm ${status.ok ? "text-good-ink" : "text-bad-ink"}`}>{status.text}</span>}
          {!live && <span className="text-xs text-muted">Demo-Modus – Speichern nach Supabase-Anbindung</span>}
          <button type="button" disabled={!live || speichert || !geaendert} onClick={speichern} className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-50">
            {speichert ? "Speichert …" : "Speichern"}
          </button>
        </div>
      </div>
    </section>
  );
}
