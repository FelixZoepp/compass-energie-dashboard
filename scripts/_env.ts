// Lädt .env.local (und .env) für lokale Skripte.
import { existsSync } from "node:fs";
import { resolve } from "node:path";

for (const f of [".env.local", ".env"]) {
  const p = resolve(process.cwd(), f);
  if (existsSync(p)) process.loadEnvFile(p);
}

export const args = process.argv.slice(2);
export const flag = (name: string) => args.includes(`--${name}`);
export const wert = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
