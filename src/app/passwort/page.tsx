"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";

export default function PasswortSetzen() {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10) return setMsg("Mindestens 10 Zeichen.");
    const { error } = await browserClient().auth.updateUser({ password: pw });
    if (error) return setMsg(error.message);
    router.replace("/");
  }
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={speichern} className="card flex w-full max-w-sm flex-col gap-3 p-6">
        <h1 className="font-semibold">Neues Passwort festlegen</h1>
        <input type="password" autoComplete="new-password" className="h-10 rounded-lg border border-line bg-surface px-3 text-sm" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="mind. 10 Zeichen" />
        {msg && <p className="text-sm text-bad-ink">{msg}</p>}
        <button className="h-10 rounded-lg bg-accent text-sm font-medium text-white">Speichern</button>
      </form>
    </div>
  );
}
