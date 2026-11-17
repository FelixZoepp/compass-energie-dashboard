// Legt einen Supabase-Login mit Rolle admin an (Passwort wird generiert und einmal ausgegeben).
// npx tsx scripts/admin-anlegen.ts felix@example.de "Felix Zoepp"
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { args } from "./_env";

async function main() {
  const [email, ...nameTeile] = args.filter((a) => !a.startsWith("--"));
  if (!email?.includes("@")) { console.error('Aufruf: npx tsx scripts/admin-anlegen.ts <email> "<Name>"'); process.exit(1); }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen (.env.local, z. B. per `vercel env pull`)."); process.exit(1); }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const passwort = randomBytes(12).toString("base64url");
  const { data, error } = await sb.auth.admin.createUser({ email: email.toLowerCase(), password: passwort, email_confirm: true });
  if (error) { console.error(`Anlegen fehlgeschlagen: ${error.message}`); process.exit(1); }
  const { error: e2 } = await sb.from("profiles").upsert({ id: data.user.id, email: email.toLowerCase(), name: nameTeile.join(" ") || email, rolle: process.argv.includes("--stufe2") ? "admin" : "superadmin", aktiv: true });
  if (e2) { console.error(`Profil fehlgeschlagen: ${e2.message} (schema.sql eingespielt?)`); process.exit(1); }
  console.log(`Admin angelegt: ${email}\nPasswort (nur jetzt sichtbar): ${passwort}\nNach dem ersten Login unter /passwort ändern.`);
}
main();
