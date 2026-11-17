// Legt die Close-Struktur an, die das Dashboard erwartet (idempotent).
// Trockenlauf:  npx tsx scripts/close-setup.ts
// Anlegen:      npx tsx scripts/close-setup.ts --anwenden
/* eslint-disable @typescript-eslint/no-explicit-any */
import { flag } from "./_env";
import { CloseClient } from "../src/lib/close/client";
import { LEAD_FELDER, MEETING_OUTCOMES, OPP_FELDER, PIPELINE_NAME, PIPELINE_STATUS, type FeldDef } from "../src/lib/close/felder";

const ERWARTETE_ORG = "Compass Energie GmbH";
const anwenden = flag("anwenden");

async function main() {
  const cl = new CloseClient();
  const me = await cl.get("me/");
  const orgs = (me.organizations ?? []).map((o: any) => o.name);
  console.log(`Close-Org: ${orgs.join(", ")} (Login ${me.email})`);
  if (!orgs.includes(ERWARTETE_ORG) && !flag("org-ok")) {
    console.error(`Abbruch: erwartet „${ERWARTETE_ORG}“. Mit --org-ok trotzdem fortfahren.`);
    process.exit(1);
  }
  console.log(anwenden ? "Modus: ANWENDEN\n" : "Modus: Trockenlauf (nichts wird geändert, --anwenden zum Anlegen)\n");
  const todo: string[] = [];

  // Pipeline + Status
  const pipelines = await cl.alle("pipeline/");
  let pipe = pipelines.find((p: any) => p.name === PIPELINE_NAME);
  const statusAlle = await cl.alle("status/opportunity/");
  if (!pipe) {
    todo.push(`Pipeline „${PIPELINE_NAME}“`);
    if (anwenden) pipe = await cl.post("pipeline/", { name: PIPELINE_NAME });
  } else console.log(`✓ Pipeline „${PIPELINE_NAME}“ vorhanden`);
  for (const s of PIPELINE_STATUS) {
    const da = statusAlle.find((x: any) => x.pipeline_id === pipe?.id && x.label.toLowerCase() === s.label.toLowerCase());
    if (da) { console.log(`✓ Status ${s.label}`); continue; }
    todo.push(`Opp-Status „${s.label}“ (${s.type})`);
    if (anwenden && pipe) await cl.post("status/opportunity/", { label: s.label, type: s.type, pipeline_id: pipe.id });
  }

  // Felder
  const felder = async (objekt: "lead" | "opportunity", defs: Record<string, FeldDef>) => {
    const vorhanden = await cl.alle(`custom_field/${objekt}/`);
    for (const d of Object.values(defs)) {
      const f = vorhanden.find((x: any) => x.name.toLowerCase() === d.name.toLowerCase());
      if (f) {
        if (f.type !== d.type) console.warn(`! ${objekt}-Feld „${d.name}“ hat Typ ${f.type}, erwartet ${d.type}`);
        const fehlend = (d.choices ?? []).filter((c) => !(f.choices ?? []).includes(c));
        if (fehlend.length) {
          todo.push(`${objekt}-Feld „${d.name}“: Auswahl ergänzen (${fehlend.join(", ")})`);
          if (anwenden) await cl.put(`custom_field/${objekt}/${f.id}/`, { choices: [...(f.choices ?? []), ...fehlend] });
        } else console.log(`✓ ${objekt}-Feld ${d.name}`);
        continue;
      }
      todo.push(`${objekt}-Feld „${d.name}“ (${d.type}${d.choices ? `: ${d.choices.join("/")}` : ""})`);
      if (anwenden) await cl.post(`custom_field/${objekt}/`, { name: d.name, type: d.type, ...(d.choices ? { choices: d.choices } : {}), ...(d.description ? { description: d.description } : {}), accepts_multiple_values: false });
    }
  };
  await felder("lead", LEAD_FELDER);
  await felder("opportunity", OPP_FELDER);

  // Meeting-Ergebnisse
  const outcomes = await cl.alle("outcome/");
  for (const name of MEETING_OUTCOMES) {
    if (outcomes.some((o: any) => o.name.toLowerCase() === name.toLowerCase())) { console.log(`✓ Outcome ${name}`); continue; }
    todo.push(`Meeting-Outcome „${name}“`);
    if (anwenden) await cl.post("outcome/", { name, applies_to: ["meetings"], type: "custom" });
  }

  console.log(`\n${todo.length ? (anwenden ? "Angelegt" : "Fehlt") : "Alles vorhanden."}${todo.length ? ` (${todo.length}):` : ""}`);
  for (const t of todo) console.log(`  ${anwenden ? "+" : "-"} ${t}`);
  if (!anwenden && todo.length) console.log("\n→ Mit --anwenden anlegen.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
