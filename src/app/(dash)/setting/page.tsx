import { seite, type SP } from "@/lib/seite";
import { berechne, repTabelle } from "@/lib/kpi/engine";
import { ampel, formatWert, type KpiId } from "@/lib/kpi/katalog";
import { COACHING_MODULE, erreichbarkeitHeatmap, HEAT_STUNDEN, HEAT_TAGE, unbearbeiteteLeads, versucheBisErstkontakt } from "@/lib/kpi/sales";
import { AmpelZelle, Card, CloseLink, Grid, Kachel, Leer, SeitenKopf, cx } from "@/components/ui";
import { BalkenV } from "@/components/charts";
import { ErreichbarkeitHeatmap } from "@/components/sales/heatmap";
import { Tabelle, Td } from "@/components/sales/tabelle";

const pct = (x: number | null | undefined) => formatWert(x, "pct");

const QUELLE: Record<string, string> = { meta: "Meta", linkedin: "LinkedIn", empfehlung: "Empfehlung", kaltakquise: "Kaltakquise", organisch: "Organisch", sonstige: "Sonstige" };

function wartezeit(min: number) {
  if (min < 60) return `${Math.floor(min)} Min.`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} Std. ${Math.floor(min % 60)} Min.`;
  return `${Math.floor(min / 1440)} Tg. ${Math.floor((min % 1440) / 60)} Std.`;
}

export default async function SettingSeite({ searchParams }: { searchParams: SP }) {
  const { ds, f, vf } = await seite("/setting", searchParams);
  const k = berechne(ds, f);
  const v = vf ? berechne(ds, vf) : null;
  const heat = erreichbarkeitHeatmap(ds, f);
  const versuche = versucheBisErstkontakt(ds, f);
  const offen = unbearbeiteteLeads(ds, f);
  const setter = repTabelle(ds, f).filter((r) => r.rolle === "setter" || r.rolle === "beides");
  const st = ds.settings;

  // Beste Anrufzeit (mit Mindestmenge)
  let beste: { tag: string; stunde: number; quote: number } | null = null;
  for (let d = 0; d < heat.length; d++) {
    for (let h = 0; h < heat[d].length; h++) {
      const c = heat[d][h];
      if (c.calls >= 5 && c.quote != null && (!beste || c.quote > beste.quote)) beste = { tag: HEAT_TAGE[d], stunde: HEAT_STUNDEN[h], quote: c.quote };
    }
  }
  const rot = offen.filter((x) => x.wartezeitMin >= 10).length;

  const saetze: string[] = [];
  if (k.speedToLead != null && k.speedBasis >= 5) saetze.push(`Speed-to-Lead liegt bei ${formatWert(k.speedToLead, "min")} (Ziel < 5 Min.), ${pct(k.unter5)} der Leads werden in unter 5 Minuten angerufen.`);
  if (rot) saetze.push(`${rot} ${rot === 1 ? "Lead wartet" : "Leads warten"} seit über 10 Minuten auf den ersten Anruf.`);
  if (beste) saetze.push(`Beste Erreichbarkeit: ${beste.tag} ${beste.stunde}–${beste.stunde + 1} Uhr mit ${pct(beste.quote)}.`);

  return (
    <>
      <SeitenKopf titel="Setting" klartext={saetze.join(" ") || "Noch zu wenig Anrufdaten im Zeitraum."} />

      <Grid cols={4}>
        <Kachel id="speedToLead" wert={k.speedToLead} vorher={v?.speedToLead} basis={k.speedBasis} settings={st} untertitel="Median, Arbeitszeit" />
        <Kachel id="unter5" wert={k.unter5} vorher={v?.unter5} basis={k.speedBasis} settings={st} />
        <Kachel id="anwahlen" wert={k.anwahlen} vorher={v?.anwahlen} settings={st} untertitel={k.anwahlenProLead != null ? `${formatWert(k.anwahlenProLead, "faktor")} pro Lead` : undefined} />
        <Kachel id="erreichbarkeit" wert={k.erreichbarkeit} vorher={v?.erreichbarkeit} basis={k.leadsAngerufen} settings={st} untertitel={`${k.leadsErreicht} von ${k.leadsAngerufen} Leads`} />
      </Grid>
      <Grid cols={4} className="mt-3">
        <Kachel id="buchungsquote" wert={k.buchungsquote} vorher={v?.buchungsquote} basis={k.leads} settings={st} untertitel={`${k.egGebucht} Erstgespräche gebucht`} />
        <Kachel id="showRateEG" wert={k.showRateEG} vorher={v?.showRateEG} basis={k.egFaellig} settings={st} untertitel={`${k.egShows} von ${k.egFaellig} fälligen`} />
        <Kachel id="qualifizierungsquote" wert={k.qualifizierungsquote} vorher={v?.qualifizierungsquote} basis={k.egShows} settings={st} />
        <Kachel id="noShowRecovery" wert={k.noShowRecovery} vorher={v?.noShowRecovery} basis={k.noShowBasis} settings={st} untertitel={`${k.egNoShows} No-Shows`} />
      </Grid>

      <Card className="mt-3" titel={`Unbearbeitete neue Leads (${offen.length})`} aktion={<span className="text-xs text-muted">ohne ersten Anruf, letzte 3 Tage · rot ab 10 Min.</span>}>
        {offen.length === 0 ? <Leer>Alle neuen Leads wurden angerufen.</Leer> : (
          <Tabelle kopf={["Lead", "Quelle", "Kundentyp", "Setter", "Eingetragen", "Wartezeit"]} minBreite={600}>
            {offen.slice(0, 25).map(({ lead, wartezeitMin }) => (
              <tr key={lead.id} className={cx(wartezeitMin >= 10 && "bg-bad-soft")}>
                <Td links><CloseLink leadId={lead.id}>{lead.name}</CloseLink></Td>
                <Td>{QUELLE[lead.quelle] ?? lead.quelle}</Td>
                <Td>{lead.kundentyp ?? "–"}</Td>
                <Td>{ds.reps.find((r) => r.id === lead.setterId)?.name ?? "nicht zugewiesen"}</Td>
                <Td>{new Date(lead.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</Td>
                <Td className={cx("font-semibold", wartezeitMin >= 10 ? "text-bad-ink" : "text-ink")}>
                  {wartezeitMin >= 10 && <span aria-label="überfällig">⚠ </span>}{wartezeit(wartezeitMin)}
                </Td>
              </tr>
            ))}
          </Tabelle>
        )}
      </Card>

      <Card className="mt-3" titel="Erreichbarkeit nach Wochentag und Uhrzeit" aktion={<span className="text-xs text-muted">Anteil angenommener Anwahlen</span>}>
        <ErreichbarkeitHeatmap zellen={heat} />
      </Card>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <Card titel="Setter im Vergleich">
          {setter.length === 0 ? <Leer>Keine Setter angelegt.</Leer> : (
            <Tabelle kopf={["Setter", "Anwahlen", "Gesprächszeit", "Erreichbarkeit", "Termine", "Show-Rate", "Quali-Quote", "Speed-to-Lead"]} minBreite={720}>
              {setter.map((r) => {
                const z = (id: KpiId, w: number | null) => <AmpelZelle a={ampel(id, w, undefined, st)}>{formatWert(w, id === "speedToLead" ? "min" : "pct")}</AmpelZelle>;
                const ziel = st.repZiele[r.repId];
                const hinweis = r.erreichbarkeit != null && r.erreichbarkeit < (st.schwellen.erreichbarkeit?.gelb ?? 0.45) ? `Erreichbarkeit → ${COACHING_MODULE.erreichbarkeit}`
                  : r.qualiQuote != null && r.qualiQuote < (st.schwellen.qualifizierungsquote?.gelb ?? 0.35) ? `Qualifizierung → ${COACHING_MODULE.qualifizierungsquote}` : null;
                return (
                  <tr key={r.repId}>
                    <Td links><div className="font-medium">{r.name}</div>{hinweis && <div className="text-[11px] text-warn-ink">Coaching: {hinweis}</div>}</Td>
                    <Td>{formatWert(r.anwahlen, "zahl")}{ziel?.anwahlen ? <span className="text-[11px] text-muted"> / {ziel.anwahlen}</span> : null}</Td>
                    <Td>{formatWert(r.gespraechsMin, "min")}</Td>
                    <Td>{z("erreichbarkeit", r.erreichbarkeit)}</Td>
                    <Td>{r.termine}{ziel?.termine ? <span className="text-[11px] text-muted"> / {ziel.termine}</span> : null}</Td>
                    <Td>{z("showRateEG", r.showRate)}</Td>
                    <Td>{z("qualifizierungsquote", r.qualiQuote)}</Td>
                    <Td>{z("speedToLead", r.speedToLead)}</Td>
                  </tr>
                );
              })}
            </Tabelle>
          )}
          <p className="mt-2 text-xs text-muted">Werte nach dem Schrägstrich sind Monatsziele aus den Einstellungen.</p>
        </Card>
        <Card titel="Anwahlversuche bis zum Erstkontakt">
          {versuche.erreicht < 5 ? <Leer>Zu wenig erreichte Leads im Zeitraum.</Leer> : (
            <>
              <BalkenV daten={versuche.daten} x="versuch" reihen={[{ key: "erreicht", name: "Erstkontakte" }]} hoehe={200} />
              <p className="mt-2 text-xs text-ink-2">
                {versuche.erreicht} von {versuche.angerufen} angerufenen Leads erreicht, {versuche.nie} bisher nie.
                {versuche.grenze && <> Ab Versuch {versuche.grenze} kommen weniger als 5 % der Erstkontakte dazu.</>}
                {" "}{pct(versuche.daten[2]?.kumuliert)} der Erstkontakte fallen auf die ersten drei Versuche.
              </p>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
