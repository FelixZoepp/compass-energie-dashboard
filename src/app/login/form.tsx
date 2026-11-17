"use client";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

const feld = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-accent";

export function LoginForm({ weiter }: { weiter?: string }) {
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  async function anmelden(e: React.FormEvent) {
    e.preventDefault();
    setLaedt(true); setFehler(null);
    const { error } = await browserClient().auth.signInWithPassword({ email, password: passwort });
    setLaedt(false);
    if (error) return setFehler(error.message === "Invalid login credentials" ? "E-Mail oder Passwort falsch." : error.message);
    window.location.href = weiter || "/";
  }
  async function vergessen() {
    if (!email) return setFehler("Bitte zuerst die E-Mail eintragen.");
    const { error } = await browserClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?weiter=/passwort` });
    if (error) setFehler(error.message); else setInfo("Link zum Zurücksetzen ist unterwegs.");
  }
  return (
    <form onSubmit={anmelden} className="flex flex-col gap-3">
      <label className="text-sm">E-Mail<input className={`${feld} mt-1`} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="text-sm">Passwort<input className={`${feld} mt-1`} type="password" autoComplete="current-password" required value={passwort} onChange={(e) => setPasswort(e.target.value)} /></label>
      {fehler && <p className="text-sm text-bad-ink">{fehler}</p>}
      {info && <p className="text-sm text-good-ink">{info}</p>}
      <button disabled={laedt} className="h-10 rounded-lg bg-accent text-sm font-medium text-white disabled:opacity-60">{laedt ? "Anmelden …" : "Anmelden"}</button>
      <button type="button" onClick={vergessen} className="text-xs text-muted hover:text-ink">Passwort vergessen?</button>
    </form>
  );
}
