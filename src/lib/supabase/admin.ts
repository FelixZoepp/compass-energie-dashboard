import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | null = null;

/** Server-Client mit Service-Role (umgeht RLS). Nur serverseitig verwenden. */
export function adminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error("Supabase ist nicht konfiguriert (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen).");
  client ??= createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Holt alle Zeilen einer Tabelle seitenweise (PostgREST-Limit 1000). */
export async function alleZeilen<T>(tabelle: string, select = "*", filter?: (q: any) => any): Promise<T[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const seite = 1000;
  const res: T[] = [];
  for (let von = 0; ; von += seite) {
    let q = adminClient().from(tabelle).select(select).range(von, von + seite - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabelle}: ${error.message}`);
    res.push(...((data ?? []) as T[]));
    if (!data || data.length < seite) break;
  }
  return res;
}

export async function upsert(tabelle: string, zeilen: Record<string, unknown>[], onConflict?: string) {
  for (let i = 0; i < zeilen.length; i += 500) {
    const { error } = await adminClient().from(tabelle).upsert(zeilen.slice(i, i + 500), onConflict ? { onConflict } : undefined);
    if (error) throw new Error(`${tabelle}: ${error.message}`);
  }
}
