import { AlertTriangle } from "lucide-react";
import { seite, type SP } from "@/lib/seite";
import { adTabelle, berechne, creativeStatus, sparkline, tagesTrend } from "@/lib/kpi/engine";
import { abgleich, breakdowns, budget, leadsProEbene, videoKurven } from "@/lib/kpi/meta";
import { formatWert } from "@/lib/kpi/katalog";
import { Card, Grid, Kachel, SeitenKopf, cx } from "@/components/ui";
import { BalkenH, ChartRahmen, KombiChart, LinienChart } from "@/components/charts";
import { FunnelTabelle } from "@/components/meta/funnel-tabelle";
import { CreativeGalerie } from "@/components/meta/creatives";
import { AlterGeschlechtHeatmap } from "@/components/meta/heatmap";

export default async function MetaSeite({ searchParams }: { searchParams: SP }) {
  const { ds, f, vf } = await seite("/meta", searchParams);
  const fm = { ...f, quelle: "meta" as const };
  const k = berechne(ds, fm);
  const v = vf ? berechne(ds, { ...vf, quelle: "meta" }) : null;
  const sp = (feld: Parameters<typeof sparkline>[2]) => sparkline(ds, fm, feld);

  const zeilen = adTabelle(ds, f);
  const status = creativeStatus(ds, zeilen);
  const ads = zeilen.filter((z) => z.ebene === "ad" && z.spend > 0);
  const leads = leadsProEbene(ds, f);
  const kurven = videoKurven(ds, f);
  const bd = breakdowns(ds);
  const trend = tagesTrend(ds, fm);
  const ab = abgleich(ds, f);
  const zielShow = ds.settings.schwellen.kostenShow?.gruen ?? 200;
  const budgets = budget(ds, new Date(), zielShow);

  // Klartext
  const mitDaten = ads.filter((a) => a.spend >= 150);
  const bestes = [...mitDaten].filter((a) => a.roas != null && a.abschluesse > 0).sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))[0];
  const schlechtestes = [...mitDaten].filter((a) => a.status === "ACTIVE").sort((a, b) => (b.kostenShow ?? Infinity) - (a.kostenShow ?? Infinity))[0];
  const ausgebrannt = ads.filter((a) => status.get(a.id)?.badge === "ausgebrannt");
  const teile: string[] = [];
  if (k.kostenShow != null) teile.push(`Kosten pro Show ${formatWert(k.kostenShow, "eur")} – ${k.kostenShow <= zielShow ? "im Ziel" : "über Ziel"} (${formatWert(zielShow, "eur")}).`);
  if (bestes) teile.push(`Bestes Creative: „${bestes.name}“ mit ROAS ${formatWert(bestes.roas, "faktor")}.`);
  if (schlechtestes && schlechtestes !== bestes) teile.push(`Teuerstes aktives: „${schlechtestes.name}“ (${schlechtestes.kostenShow != null ? `${formatWert(schlechtestes.kostenShow, "eur")} pro Show` : "noch keine Show"}).`);
  if (ausgebrannt.length) teile.push(`${ausgebrannt.length} Creative${ausgebrannt.length > 1 ? "s" : ""} ausgebrannt.`);

  const statusRecord = Object.fromEntries(status);
  const abwRot = ab.abw != null && Math.abs(ab.abw) > 0.2;

  return (
    <>
      <SeitenKopf titel="Meta Ads" klartext={teile.join(" ") || "Noch keine Werbedaten im Zeitraum."} />

      <Grid cols={6}>
        <Kachel id="spend" wert={k.spend} vorher={v?.spend} settings={ds.settings} spark={sp("spend")} />
        <Kachel id="cpm" wert={k.cpm} vorher={v?.cpm} settings={ds.settings} spark={sp("cpm")} />
        <Kachel id="ctr" wert={k.ctr} vorher={v?.ctr} basis={k.impressions} settings={ds.settings} spark={sp("ctr")} />
        <Kachel id="cpl" wert={k.cpl} vorher={v?.cpl} basis={k.leadsMeta} settings={ds.settings} spark={sp("cpl")} />
        <Kachel id="kostenShow" wert={k.kostenShow} vorher={v?.kostenShow} basis={k.egShows} settings={ds.settings} spark={sp("kostenShow")} />
        <Kachel id="roas" wert={k.roas} vorher={v?.roas} settings={ds.settings} spark={sp("roas")} untertitel="Kohorte" />
      </Grid>

      <Card className="mt-3" titel="Full-Funnel: Kampagne → Anzeigengruppe → Anzeige">
        {zeilen.length ? <FunnelTabelle zeilen={zeilen} leads={leads} settings={ds.settings} /> : <p className="text-sm text-muted">Keine Anzeigendaten im Zeitraum.</p>}
      </Card>

      <section id="creatives" className="mt-6 scroll-mt-20">
        <h2 className="mb-3 text-base font-semibold">Creative-Galerie</h2>
        {ads.length ? <CreativeGalerie ads={ads} status={statusRecord} kurven={kurven} settings={ds.settings} /> : <p className="text-sm text-muted">Keine Creatives mit Ausgaben im Zeitraum.</p>}
      </section>

      <h2 className="mb-3 mt-6 text-base font-semibold">Breakdowns</h2>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card titel="CPL nach Alter × Geschlecht"><AlterGeschlechtHeatmap zeilen={bd.heatmap} /></Card>
        <Card titel="CPL nach Platzierung">
          {bd.platzierungen.length ? <BalkenH format="eur" daten={bd.platzierungen.map((p) => ({ name: p.name, wert: p.cpl ?? 0 }))} /> : <p className="text-sm text-muted">Keine Daten.</p>}
        </Card>
        <Card titel="Leads nach Gerät">
          {bd.geraete.length ? <BalkenH daten={bd.geraete.map((p) => ({ name: p.name, wert: p.leads }))} /> : <p className="text-sm text-muted">Keine Daten.</p>}
          {bd.geraete.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-muted">
              {bd.geraete.map((g) => <li key={g.name}>{g.name}: CPL {formatWert(g.cpl, "eur")} · Spend {formatWert(g.spend, "eur")}</li>)}
            </ul>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-6 text-base font-semibold">Tagestrend</h2>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChartRahmen titel="Werbeausgaben pro Tag">
          <KombiChart daten={trend} x="label" format="eur" reihen={[{ key: "spend", name: "Spend", typ: "bar" }]} />
        </ChartRahmen>
        <ChartRahmen titel="Leads und Termine pro Tag">
          <LinienChart daten={trend} x="label" reihen={[{ key: "leads", name: "Leads (Close)" }, { key: "termine", name: "Erstgespräche gebucht", farbe: "var(--s2)" }]} />
        </ChartRahmen>
        <ChartRahmen titel="CPL pro Tag">
          <LinienChart daten={trend} x="label" format="eur" reihen={[{ key: "cpl", name: "CPL", gestrichelt: true }]} />
        </ChartRahmen>
      </div>

      <section id="abgleich" className="mt-6 scroll-mt-20">
        <Card titel="Meta vs. CRM: Leads laut Meta und in Close"
          aktion={<span className={cx("text-xs font-medium", abwRot ? "text-bad-ink" : "text-ink-2")}>Gesamt: Meta {ab.meta} · Close {ab.close} · Abweichung {ab.abw != null ? `${ab.abw > 0 ? "+" : ""}${Math.round(ab.abw * 100)} %` : "–"}</span>}>
          {abwRot && (
            <p className="mb-3 flex items-start gap-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad-ink">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Abweichung über 20 % – Tracking, Formular oder Duplikate prüfen.
            </p>
          )}
          <LinienChart daten={ab.tage} x="label" reihen={[{ key: "meta", name: "Leads laut Meta" }, { key: "close", name: "Leads in Close", farbe: "var(--s2)" }]} />
          <div className="scroll-x mt-3">
            <table className="w-full min-w-[480px] text-xs">
              <thead className="text-muted"><tr><th className="py-1 text-left font-normal">Tag</th><th className="text-right font-normal">Meta</th><th className="text-right font-normal">Close</th><th className="text-right font-normal">Abweichung</th></tr></thead>
              <tbody>
                {ab.tage.slice(-14).reverse().map((t) => {
                  const rot = t.abw != null && Math.abs(t.abw) > 0.2 && t.meta >= 3;
                  return (
                    <tr key={t.tag} className="border-t border-line">
                      <td className="py-1">{t.label}</td><td className="text-right tabular">{t.meta}</td><td className="text-right tabular">{t.close}</td>
                      <td className={cx("text-right tabular", rot ? "font-medium text-bad-ink" : "text-ink-2")}>{t.abw != null ? `${t.abw > 0 ? "+" : ""}${Math.round(t.abw * 100)} %` : "–"}{rot ? " ⚠" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <Card className="mt-6" titel="Budget-Steuerung (Monat bis heute)">
        <div className="scroll-x">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead className="text-[11px] uppercase tracking-wide text-ink-2">
              <tr className="text-right">
                <th className="py-2 text-left">Kampagne</th><th>Tagesbudget</th><th>Ausgaben MTD</th><th>Plan MTD</th><th>Auslastung</th><th>Kosten/Show</th><th>Abschlüsse</th><th className="text-left pl-4">Empfehlung</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => (
                <tr key={b.id} className="border-t border-line text-right tabular">
                  <td className="max-w-[260px] truncate py-2 text-left" title={b.name}>{b.name}</td>
                  <td>{formatWert(b.tagesbudget, "eur")}</td>
                  <td>{formatWert(b.spendMtd, "eur")}</td>
                  <td>{formatWert(b.plan, "eur")}</td>
                  <td>{b.quote != null ? `${Math.round(b.quote * 100)} %` : "–"}</td>
                  <td>{formatWert(b.kostenShow, "eur")}</td>
                  <td>{b.abschluesse}</td>
                  <td className="pl-4 text-left">
                    <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-medium", b.ton === "gut" ? "bg-good-soft text-good-ink" : b.ton === "warn" ? "bg-warn-soft text-warn-ink" : "bg-grey-soft text-ink-2")}>{b.aktion}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">Regel: Kosten pro Show unter Ziel ({formatWert(zielShow, "eur")}) und Abschlüsse vorhanden → Budget +20 %. Über 300 € Ausgaben ohne Show → prüfen oder pausieren.</p>
      </Card>
    </>
  );
}
