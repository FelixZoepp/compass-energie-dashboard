// Registriert den Close-Webhook für das Dashboard und gibt das Signatur-Secret aus.
// npx tsx scripts/close-webhook.ts https://<domain>/api/webhooks/close
/* eslint-disable @typescript-eslint/no-explicit-any */
import { args } from "./_env";
import { CloseClient } from "../src/lib/close/client";

const OBJEKTE = ["lead", "opportunity", "activity.meeting", "activity.call", "activity.opportunity_status_change", "activity.custom_activity", "task.lead"];

async function main() {
  const url = args.find((a) => a.startsWith("https://"));
  if (!url) { console.error("Bitte die Webhook-URL angeben (https://…/api/webhooks/close)."); process.exit(1); }
  const cl = new CloseClient();
  const vorhanden = (await cl.alle("webhook/")).find((w: any) => w.url === url);
  if (vorhanden) {
    console.log(`Webhook existiert bereits: ${vorhanden.id} (Status ${vorhanden.status}). Secret steht nur bei der Anlage zur Verfügung – ggf. löschen und neu anlegen.`);
    return;
  }
  const events = OBJEKTE.flatMap((object_type) => ["created", "updated", "deleted"].map((action) => ({ object_type, action })));
  const w = await cl.post("webhook/", { url, events });
  console.log(`Webhook angelegt: ${w.id}`);
  console.log(`\nIn Vercel als CLOSE_WEBHOOK_SECRET eintragen (sensitive):\n${w.signature_key}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
