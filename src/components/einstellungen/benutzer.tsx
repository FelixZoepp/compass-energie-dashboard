"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Abschnitt, Feld, eingabe } from "./feld";

export interface Profil { id: string; email: string; name: string | null; rolle: string; rep_id: string | null; aktiv: boolean }

import { STUFEN, darfVerwalten } from "@/lib/auth/stufen";

const ALLE_ROLLEN = STUFEN.map((s) => ({ id: s.rolle, label: `Stufe ${s.stufe} · ${s.label} – ${s.beschreibung}`, kurz: `Stufe ${s.stufe} · ${s.label}` }));

export function Benutzerverwaltung({ profile, reps, live, meineRolle = "admin" }: { profile: Profil[]; reps: { id: string; name: string }[]; live: boolean; meineRolle?: string }) {
  const ROLLEN = ALLE_ROLLEN.filter((r) => darfVerwalten(meineRolle, r.id));
  const router = useRouter();
  const [neu, setNeu] = useState({ email: "", name: "", rolle: "rep", repId: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [laedt, setLaedt] = useState(false);

  async function senden(method: "POST" | "PATCH", body: unknown) {
    setLaedt(true); setMsg(null);
    const res = await fetch("/api/benutzer", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setLaedt(false);
    if (!res.ok || !json.ok) { setMsg({ ok: false, text: json.fehler ?? `Fehler ${res.status}` }); return false; }
    router.refresh();
    return true;
  }

  async function einladen(e: React.FormEvent) {
    e.preventDefault();
    if (await senden("POST", neu)) { setMsg({ ok: true, text: `Einladung an ${neu.email} verschickt.` }); setNeu({ email: "", name: "", rolle: "rep", repId: "" }); }
  }

  return (
    <section className="card p-4 sm:p-5">
      <Abschnitt titel="Benutzer und Stufen" beschreibung="Eingeladene Personen bekommen eine E-Mail von Supabase und legen ihr Passwort selbst fest. Reps sehen nur ihre eigenen Zahlen – dafür den passenden Close-User zuordnen.">
        {!live ? <p className="text-sm text-muted">Im Demo-Modus gibt es keine Benutzer. Nach der Supabase-Anbindung wird der erste angemeldete Nutzer automatisch Stufe 1 (Inhaber) (oder per <code>npx tsx scripts/admin-anlegen.ts</code>).</p> : (
          <div className="scroll-x">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="pb-2 pr-2 font-medium">Name / E-Mail</th><th className="pb-2 pr-2 font-medium">Stufe</th><th className="pb-2 pr-2 font-medium">Close-User (Rep)</th><th className="pb-2 font-medium">Aktiv</th></tr></thead>
              <tbody>
                {profile.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-2 pr-2"><div className="font-medium">{p.name || p.email}</div><div className="text-xs text-muted">{p.email}</div></td>
                    <td className="py-2 pr-2">
                      {darfVerwalten(meineRolle, p.rolle) ? (
                        <select className={eingabe} disabled={laedt} value={p.rolle} onChange={(e) => senden("PATCH", { id: p.id, rolle: e.target.value })}>
                          {ROLLEN.map((r) => <option key={r.id} value={r.id}>{r.kurz}</option>)}
                        </select>
                      ) : <span className="text-sm font-medium">{ALLE_ROLLEN.find((r) => r.id === p.rolle)?.kurz ?? p.rolle}</span>}
                    </td>
                    <td className="py-2 pr-2">
                      <select className={eingabe} disabled={laedt} value={p.rep_id ?? ""} onChange={(e) => senden("PATCH", { id: p.id, repId: e.target.value || null })}>
                        <option value="">– keiner –</option>
                        {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </td>
                    <td className="py-2"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" disabled={laedt} checked={p.aktiv} onChange={(e) => senden("PATCH", { id: p.id, aktiv: e.target.checked })} aria-label={`${p.email} aktiv`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form onSubmit={einladen} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <Feld label="E-Mail"><input type="email" required className={eingabe} value={neu.email} onChange={(e) => setNeu({ ...neu, email: e.target.value })} disabled={!live} /></Feld>
          <Feld label="Name"><input className={eingabe} value={neu.name} onChange={(e) => setNeu({ ...neu, name: e.target.value })} disabled={!live} /></Feld>
          <Feld label="Stufe">
            <select className={eingabe} value={neu.rolle} onChange={(e) => setNeu({ ...neu, rolle: e.target.value })} disabled={!live}>
              {ROLLEN.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Feld>
          <Feld label="Close-User (für Reps)">
            <select className={eingabe} value={neu.repId} onChange={(e) => setNeu({ ...neu, repId: e.target.value })} disabled={!live}>
              <option value="">– keiner –</option>
              {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Feld>
          <button disabled={!live || laedt} className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-50">Einladen</button>
        </form>
        {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-good-ink" : "text-bad-ink"}`}>{msg.text}</p>}
      </Abschnitt>
    </section>
  );
}
