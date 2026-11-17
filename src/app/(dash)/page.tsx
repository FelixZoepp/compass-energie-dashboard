import Link from "next/link";
import { AlertTriangle, AlertCircle, ArrowRight } from "lucide-react";
import { seite, type SP } from "@/lib/seite";
import { adTabelle, berechne, creativeStatus, engpass, pacing, pipeline, repTabelle, sparkline, warnungen } from "@/lib/kpi/engine";
import { ampel, formatWert, zielText, KPIS, type KpiId } from "@/lib/kpi/katalog";
import { kanalMix, QUELLE_LABEL, terminVerteilung, verlauf, VERLAUF_METRIKEN, zieleKompass } from "@/lib/kpi/cockpit";
import { Card, Grid, Kachel, PfeilKnopf, SeitenKopf, cx } from "@/components/ui";
import { Abschnitt, Donut, Kompass, MiniKpi, QuotenListe, Trichter } from "@/components/cockpit";
import { Verlauf } from "@/components/verlauf";

const pct = (x: number | null | undefined) => (x == null ? "–" : `${Math.round(x * 100)} %`);

export default async function Cockpit({ searchParams }: { searchParams: SP }) {
  const { ds, f, vf } = await seite("/", searchParams);
  const k = berechne(ds, f);
  const v = vf ? berechne(ds, vf) : null;
  const p = pacing(ds, f);
  const eng = engpass(k, ds);
  const warn = warnungen(ds);
  const sp = (feld: Parameters<typeof sparkline>[2]) => sparkline(ds, f, feld);
  const st = ds.settings;
  const a = (id: KpiId, w: number | null | undefined, basis?: number) => ampel(id, w, basis, st);
  const fw = (id: KpiId, w: number | null | undefined) => formatWert(w, KPIS[id].einheit, true);

  const daten = { tage: verlauf(ds, f, "tage"), wochen: verlauf(ds, f, "wochen"), monate: verlauf(ds, f, "monate") };
  const kompass = zieleKompass(k, ds);
  const eg = terminVerteilung(ds, f, "erstgespraech");
  const bg = terminVerteilung(ds, f, "beratung+cc2");
  const pipe = pipeline(ds, f);
  const kanaele = kanalMix(ds, f);
  const reps = repTabelle(ds, f);
  const topCloser = reps.filter((r) => r.rolle !== "setter").sort((x, y) => y.umsatz - x.umsatz).slice(0, 3);
  const topSetter = reps.filter((r) => r.rolle !== "closer").sort((x, y) => y.termine - x.termine).slice(0, 3);
  const ads = adTabelle(ds, f);
  const status = creativeStatus(ds, ads);
  const creatives = ads.filter((z) => z.ebene === "ad" && z.spend > 0);
  const bestes = [...creatives].filter((z) => z.shows > 0).sort((x, y) => (x.kostenShow ?? 1e9) - (y.kostenShow ?? 1e9))[0];
  const teuerstes = [...creatives].filter((z) => z.status === "ACTIVE").sort((x, y) => (y.kostenShow ?? 1e9) - (x.kostenShow ?? 1e9))[0];

  const satz = p.ziel
    ? `Bei aktuellem Tempo landen wir bei ${pct(p.prognoseQuote)} vom Monatsziel.` +
      (p.fehlendeAbschluesse > 0 && p.fehlendeBG && p.fehlendeEG ? ` Es fehlen ${p.fehlendeAbschluesse} Abschlüsse ≈ ${p.fehlendeBG} Beratungen ≈ ${p.fehlendeEG} Erstgespräche.` : " Das Monatsziel ist auf Kurs.")
    : "Für diesen Monat ist noch kein Umsatzziel hinterlegt.";

  return (
    <>
      <SeitenKopf titel="Cockpit" klartext={<>{eng ? <>Engpass: <strong className="text-ink">{eng.label} {pct(eng.wert)}</strong> (Soll {pct(eng.ziel)}). </> : null}{satz}</>} />

      {/* Nordstern-Kacheln */}
      <Grid cols={4}>
        <Kachel id="umsatz" hervor gross wert={k.umsatz} vorher={v?.umsatz} settings={st} href="/closing" untertitel={`${k.abschluesse} Abschlüsse · Ø ${fw("aov", k.aov)}`}
          zielOverride={p.ziel ? `${formatWert(p.ziel, "eur", true)} / Monat` : null} />
        <Kachel id="cash" wert={k.cash} vorher={v?.cash} settings={st} spark={sp("cash")} untertitel={`Cash-Quote ${pct(k.cashQuote)}`} />
        <Kachel id="leads" label="Neue Leads" wert={k.leads} vorher={v?.leads} settings={st} spark={sp("leads")} href="/funnel" untertitel={`${k.leadsMeta} aus Werbung · ${pct(k.qualiQuote)} qualifiziert`} />
        <Kachel id="abschluesse" wert={k.abschluesse} vorher={v?.abschluesse} settings={st} spark={sp("abschluesse")} href="/closing" untertitel={`aus ${k.bgShows} geführten Beratungen`} />
      </Grid>

      {/* Verlauf · Ziele-Kompass · Werbung + Monatsziel */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5" titel="Verlauf" untertitel="Kennzahl wählen, Säule antippen für Details">
          <Verlauf daten={daten} metriken={VERLAUF_METRIKEN} />
        </Card>
        <Card className="xl:col-span-4" titel="Ziele-Kompass" untertitel="Soll-Quoten im Zeitraum" aktion={<Link href="/einstellungen" className="rounded-full border border-line px-3 py-1 text-[13px] font-medium hover:border-accent">Alle Ziele →</Link>}>
          <Kompass erreicht={kompass.erreicht} knapp={kompass.knapp} verfehlt={kompass.verfehlt} gesamt={kompass.gesamt} />
          <div className="mt-4">
            <QuotenListe quoten={kompass.quoten.map((q) => ({ label: q.label, wert: q.wert, a: q.a, soll: zielText(q.id, st), einheit: q.id === "cpl" ? "eur" : "pct" }))} />
          </div>
        </Card>
        <div className="flex flex-col gap-4 xl:col-span-3">
          <Card variante="brand" titel="Werbeausgaben" aktion={<PfeilKnopf href="/meta" hell />}>
            <div className="text-[40px] font-semibold leading-none tracking-tight tabular">{formatWert(k.spend, "eur")}</div>
            <p className="mt-3 text-[14px] text-white/80">{fw("cpl", k.cpl)} pro Lead · {k.leadsMeta} Leads aus Werbung</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
              <div className="rounded-2xl bg-white/10 p-3"><div className="text-white/70">ROAS (Kohorte)</div><div className="text-[20px] font-semibold">{fw("roas", k.roas)}</div></div>
              <div className="rounded-2xl bg-white/10 p-3"><div className="text-white/70">CAC</div><div className="text-[20px] font-semibold">{fw("cac", k.cac)}</div></div>
            </div>
          </Card>
          <Card titel="Monatsziel" aktion={<PfeilKnopf href="/planung" />}>
            {p.ziel ? (
              <>
                <div className="flex items-baseline justify-between"><span className="text-[28px] font-semibold tabular">{pct(p.pacing)}</span><span className="text-[13px] text-muted">Pacing</span></div>
                <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, (p.umsatz / p.ziel) * 100)}%` }} />
                  {p.sollHeute != null && <div className="absolute top-0 h-full w-0.5 bg-ink" style={{ left: `${Math.min(100, (p.sollHeute / p.ziel) * 100)}%` }} title="Soll heute" />}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-y-1 text-[13px]">
                  <dt className="text-muted">Ist</dt><dd className="text-right font-medium tabular">{formatWert(p.umsatz, "eur")}</dd>
                  <dt className="text-muted">Soll heute</dt><dd className="text-right font-medium tabular">{formatWert(p.sollHeute, "eur")}</dd>
                  <dt className="text-muted">Forecast</dt><dd className="text-right font-medium tabular">{formatWert(p.forecast, "eur")}</dd>
                  <dt className="text-muted">Ziel</dt><dd className="text-right font-medium tabular">{formatWert(p.ziel, "eur")}</dd>
                </dl>
              </>
            ) : <p className="text-sm text-muted">Kein Ziel hinterlegt. <Link className="text-accent" href="/einstellungen">Ziel setzen →</Link></p>}
          </Card>
        </div>
      </div>

      {/* MARKETING */}
      <Abschnitt titel="Marketing" untertitel="Was die Werbung kostet und was sie bringt – bis zum Umsatz." aktion={<Link href="/meta" className="text-[14px] font-medium text-accent">Zu Marketing →</Link>}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-8" titel="Kennzahlen Werbung" untertitel="Meta Ads, Raten aus Summen, Ampel gegen Soll">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MiniKpi label="Impressionen" wert={formatWert(k.impressions, "zahl")} sub={`Frequenz ${formatWert(k.frequency, "faktor")}`} />
              <MiniKpi label="CPM" wert={fw("cpm", k.cpm)} sub="pro 1.000 Impressionen" />
              <MiniKpi label="Hook-Rate" wert={pct(k.hookRate)} a={a("hookRate", k.hookRate, k.impressions)} sub={`Soll ${zielText("hookRate", st)}`} />
              <MiniKpi label="Link-CTR" wert={formatWert(k.ctr, "pct")} a={a("ctr", k.ctr, k.impressions)} sub={`CPC ${fw("cpc", k.cpc)}`} />
              <MiniKpi label="LP-Conversion" wert={pct(k.lpConv)} a={a("lpConv", k.lpConv, k.lpViews)} sub={`Ladequote ${pct(k.lpLoad)}`} />
              <MiniKpi label="Kosten pro Lead" wert={fw("cpl", k.cpl)} a={a("cpl", k.cpl, k.leadsMeta)} sub={`qualifiziert ${fw("kostenQualiLead", k.kostenQualiLead)}`} />
              <MiniKpi label="Kosten pro Termin" wert={fw("kostenTermin", k.kostenTermin)} a={a("kostenTermin", k.kostenTermin, k.egGebucht)} sub={`Soll ${zielText("kostenTermin", st)}`} />
              <MiniKpi label="Kosten pro Show" wert={fw("kostenShow", k.kostenShow)} a={a("kostenShow", k.kostenShow, k.egShows)} sub={`Soll ${zielText("kostenShow", st)}`} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {bestes && (
                <div className="rounded-[20px] border border-[var(--glass-border)] bg-surface-2 p-4 shadow-[inset_0_1px_0_var(--glass-edge)]">
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-good-ink">Bestes Creative</div>
                  <div className="mt-1 font-medium">{bestes.name}</div>
                  <div className="mt-1 text-[13px] text-ink-2">{fw("kostenShow", bestes.kostenShow)} pro Show · {bestes.leads} Leads · ROAS {formatWert(bestes.roas, "faktor")}</div>
                </div>
              )}
              {teuerstes && teuerstes.id !== bestes?.id && (
                <div className="rounded-[20px] border border-[var(--glass-border)] bg-surface-2 p-4 shadow-[inset_0_1px_0_var(--glass-edge)]">
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-bad-ink">Teuerstes aktives Creative</div>
                  <div className="mt-1 font-medium">{teuerstes.name}{status.get(teuerstes.id)?.fatigue ? " · ausgebrannt" : ""}</div>
                  <div className="mt-1 text-[13px] text-ink-2">{teuerstes.kostenShow != null ? `${fw("kostenShow", teuerstes.kostenShow)} pro Show` : "noch keine Show"} · {formatWert(teuerstes.spend, "eur")} ausgegeben</div>
                </div>
              )}
            </div>
          </Card>
          <Card className="xl:col-span-4" titel="Kanal-Mix" untertitel="Woher Leads und Umsatz kommen">
            <ul className="flex flex-col gap-3">
              {kanaele.map(({ quelle, k: kk }, i) => (
                <li key={quelle}>
                  <div className="flex items-baseline justify-between text-[14px]">
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--s${i + 1})` }} />{QUELLE_LABEL[quelle]}</span>
                    <span className="tabular"><strong>{formatWert(kk.umsatz, "eur", true)}</strong> <span className="text-muted">· {kk.leads} Leads · {kk.abschluesse} Abschl.</span></span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, (kk.leads / Math.max(1, k.leads)) * 100)}%`, background: `var(--s${i + 1})` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-muted">Balken = Anteil an allen Leads im Zeitraum.</p>
          </Card>
        </div>
      </Abschnitt>

      {/* SALES */}
      <Abschnitt titel="Sales" untertitel="Vom Lead bis zum Abschluss: wo Leads verloren gehen und was hängen bleibt." aktion={<Link href="/funnel" className="text-[14px] font-medium text-accent">Zum Sales-Funnel →</Link>}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-6" titel="Trichter: wo du Leads verlierst" untertitel="Leads aus dem Zeitraum und was daraus wurde">
            <Trichter stufen={[
              { label: "Neue Leads", wert: k.leads, quote: null },
              { label: "Erstgespräch gebucht", wert: k.egGebucht, quote: k.buchungsquote, basisText: "der Leads", ziel: st.schwellen.buchungsquote?.gruen ?? KPIS.buchungsquote.gruen },
              { label: "Erstgespräch geführt", wert: k.egShows, quote: k.showRateEG, basisText: "der fälligen", ziel: st.schwellen.showRateEG?.gruen ?? KPIS.showRateEG.gruen },
              { label: "Beratung gebucht", wert: k.bgGebucht, quote: k.qualifizierungsquote, basisText: "der Erstgespräche", ziel: st.schwellen.qualifizierungsquote?.gruen ?? KPIS.qualifizierungsquote.gruen },
              { label: "Beratung geführt", wert: k.bgShows, quote: k.showRateBG, basisText: "der fälligen", ziel: st.schwellen.showRateBG?.gruen ?? KPIS.showRateBG.gruen },
              { label: "Kunde", wert: k.abschluesse, quote: k.closingRate, basisText: "der Beratungen", ziel: st.schwellen.closingRate?.gruen ?? KPIS.closingRate.gruen },
            ]} />
          </Card>
          <Card className="xl:col-span-3" titel="Erstgespräche im Zeitraum" untertitel={`${eg.gesamt} Termine`}>
            <Donut teile={eg.teile} mitte={pct(eg.quote)} mitteText="geführt" />
          </Card>
          <Card className="xl:col-span-3" titel="Beratungen im Zeitraum" untertitel={`${bg.gesamt} Termine`}>
            <Donut teile={bg.teile} mitte={pct(bg.quote)} mitteText="geführt" />
          </Card>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-8" titel="Kennzahlen Vertrieb" untertitel="Setting und Closing">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MiniKpi href="/setting" label="Speed-to-Lead" wert={formatWert(k.speedToLead, "min")} a={a("speedToLead", k.speedToLead, k.speedBasis)} sub={`${pct(k.unter5)} in < 5 Min.`} />
              <MiniKpi href="/setting" label="Erreichbarkeit" wert={pct(k.erreichbarkeit)} a={a("erreichbarkeit", k.erreichbarkeit, k.leadsAngerufen)} sub={`${formatWert(k.anwahlen, "zahl")} Anwahlen`} />
              <MiniKpi href="/setting" label="No-Show-Recovery" wert={pct(k.noShowRecovery)} a={a("noShowRecovery", k.noShowRecovery, k.noShowBasis)} sub={`${k.noShowBasis} No-Shows`} />
              <MiniKpi href="/closing" label="Closing-Rate" wert={pct(k.closingRate)} a={a("closingRate", k.closingRate, k.bgShows)} sub={`Soll ${zielText("closingRate", st)}`} />
              <MiniKpi href="/closing" label="Ø Auftragswert" wert={fw("aov", k.aov)} sub={k.plaetzeB2B ? `Ø ${formatWert(k.plaetzeB2B, "faktor")} Plätze B2B` : undefined} />
              <MiniKpi href="/closing" label="Angebots-Abschluss" wert={pct(k.angebotsAbschluss)} a={a("angebotsAbschluss", k.angebotsAbschluss, k.angebote)} sub={`${k.angebote} Angebote`} />
              <MiniKpi href="/closing" label="Rabattquote" wert={pct(k.rabattquote)} a={a("rabattquote", k.rabattquote, k.rabattBasis)} sub="ggü. Listenpreis" />
              <MiniKpi href="/closing" label="Sales Cycle" wert={formatWert(k.salesCycle, "tage")} sub="Median Lead → Abschluss" />
            </div>
          </Card>
          <Card className="xl:col-span-4" titel="Pipeline" aktion={<PfeilKnopf href="/pipeline" />}>
            <div className="text-[34px] font-semibold leading-none tracking-tight tabular">{formatWert(pipe.gewichtet, "eur", true)}</div>
            <p className="mt-2 text-[13px] text-ink-2">gewichtet · {formatWert(pipe.summe, "eur", true)} offen in {pipe.offen.length} Opps</p>
            <ul className="mt-4 space-y-2 text-[14px]">
              {pipe.proStage.map((s) => (
                <li key={s.stage} className="flex items-center justify-between gap-2">
                  <span className="text-ink-2">{({ setting: "Setting", closing_terminiert: "Closing terminiert", closing_fu: "Closing Follow-up", angebot: "Angebot", cc2: "CC2", won: "", lost: "" } as Record<string, string>)[s.stage]}</span>
                  <span className="tabular"><strong>{s.anzahl}</strong> <span className="text-muted">· {formatWert(s.wert, "eur", true)}</span></span>
                </li>
              ))}
            </ul>
            {(pipe.ohneAufgabe.length > 0 || pipe.stagnierend.length > 0) && (
              <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-[13px] text-warn-ink">{pipe.ohneAufgabe.length} ohne nächste Aufgabe · {pipe.stagnierend.length} länger als 14 Tage im selben Status</p>
            )}
          </Card>
        </div>
      </Abschnitt>

      {/* UNIT ECONOMICS + TEAM + WARNUNGEN */}
      <Abschnitt titel="Wirtschaftlichkeit & Team" untertitel="Lohnt sich jeder Kunde – und wer bringt ihn?">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-5" titel="Unit Economics">
            <div className="grid grid-cols-2 gap-3">
              <MiniKpi label="CAC (voll)" wert={fw("cacVoll", k.cacVoll)} sub="Werbung + Provision + Tools" />
              <MiniKpi label="LTV : CAC" wert={formatWert(k.ltvCac, "faktor")} a={a("ltvCac", k.ltvCac)} sub={`Soll ${zielText("ltvCac", st)}`} />
              <MiniKpi label="Deckungsbeitrag / Kunde" wert={fw("deckungsbeitrag", k.deckungsbeitrag)} sub="AOV − CAC − Provision − Lieferung" />
              <MiniKpi label="Cash-ROAS" wert={formatWert(k.cashRoas, "faktor")} a={a("cashRoas", k.cashRoas)} sub={`MER ${formatWert(k.mer, "faktor")}`} />
            </div>
          </Card>
          <Card className="xl:col-span-4" titel="Bestenliste" aktion={<PfeilKnopf href="/team" />}>
            <div className="grid grid-cols-2 gap-4 text-[14px]">
              <div>
                <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Closer · Umsatz</div>
                {topCloser.map((r, i) => <div key={r.repId} className="flex justify-between py-1"><span>{["🥇", "🥈", "🥉"][i]} {r.name.split(" ")[0]}</span><span className="tabular font-medium">{formatWert(r.umsatz, "eur", true)}</span></div>)}
              </div>
              <div>
                <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Setter · Termine</div>
                {topSetter.map((r, i) => <div key={r.repId} className="flex justify-between py-1"><span>{["🥇", "🥈", "🥉"][i]} {r.name.split(" ")[0]}</span><span className="tabular font-medium">{r.termine}</span></div>)}
              </div>
            </div>
          </Card>
          <Card className="xl:col-span-3" titel={`Warnungen (${warn.length})`}>
            {warn.length === 0 ? <p className="text-sm text-good-ink">Keine aktiven Warnungen.</p> : (
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {warn.slice(0, 6).map((w, i) => (
                  <li key={i}>
                    <Link href={w.link} className="flex items-start gap-2 py-2 text-[14px] hover:text-accent">
                      {w.stufe === "rot" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-label="kritisch" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-label="Warnung" />}
                      <span className={cx("flex-1")}>{w.text}</span><ArrowRight className="mt-0.5 h-3.5 w-3.5 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </Abschnitt>
    </>
  );
}
