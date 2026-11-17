// Lokaler Erstimport: Close komplett + Meta 90 Tage.
// npm run sync            (beides)
// npm run sync -- --nur=close | --nur=meta   --tage=90
import { flag, wert } from "./_env";
import { syncClose } from "../src/lib/close/sync";
import { syncMeta, syncMetaCreatives } from "../src/lib/meta/sync";

async function main() {
  const nur = wert("nur");
  const tage = Number(wert("tage") ?? "90");
  if (!nur || nur === "close") {
    console.log("Close-Sync (komplett) …");
    console.log(await syncClose({ voll: !flag("inkrementell") }));
  }
  if (!nur || nur === "meta") {
    if (!process.env.META_ACCESS_TOKEN) console.log("Meta übersprungen: META_ACCESS_TOKEN fehlt.");
    else {
      console.log("Meta-Creatives …");
      console.log(await syncMetaCreatives());
      console.log(`Meta-Insights (${tage} Tage) …`);
      console.log(await syncMeta({ tage }));
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
