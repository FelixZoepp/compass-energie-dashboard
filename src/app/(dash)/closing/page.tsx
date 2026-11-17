import { seite, type SP } from "@/lib/seite";
import { berechne, repTabelle } from "@/lib/kpi/engine";
import { ampel, formatWert, type KpiId } from "@/lib/kpi/katalog";
import { COACHING_MODULE, paketMix, stagnierendeAngebote } from "@/lib/kpi/sales";
import { AmpelZelle, Card, CloseLink, Grid, Kachel, Leer, SeitenKopf, cx } from "@/components/ui";
import { HBalken } from "@/components/sales/hbalken";
import { Tabelle, Td } from "@/components/sales/tabelle";

const pct = (x: number | null | undefined) => formatWert(x, "pct");

export default async function ClosingSeite({ searchParams }: { searchParams: SP }) {
  const { ds, f, vf } = await seite("/closing", searchParams);
  const k = berechne(ds, f);
  const v = vf ? berechne(ds, vf) : null;
  const st = ds.settings;
  const closer = repTabelle(ds, f).filter((r) => r.rolle === "closer" || r.rolle === "beides");
  const angebote = stagnierendeAngebote(ds, f);
  const mix = paketMix(ds, f);
  const mixGesamt = mix.reduce((s, m) => s + m.anzahl, 0);

  // Coaching-Hinweise je Closer
  const hinweise = closer.flatMap((c) => {
    const lost = c.verlustgruende.reduce((s, g) => s + g.anzahl, 0);
    const res: string[] = [];
    if (lost >= 5 && c.verlustPreisAnteil != null && c.verlustPreisAnteil >= 0.4) res.push(`${c.name} verliert ${pct(c.verlustPreisAnteil)} der Deals am Preis → ${COACHING_MODULE.preis}`);
    if (c.bgShows >= 10 && c.closingRate != null && c.closingRate < (st.schwellen.closingRate?.gelb ?? 0.18)) res.push(`${c.name}: Closing-Rate ${pct(c.closingRate)} → ${COACHING_MODULE.closingRate}`);
    return res;
  });

  const saetze: string[] = [];
  if (k.bgShows >= 10 && k.closingRate != null) saetze.push(`Closing-Rate ${pct(k.closingRate)} (Ziel ${pct(st.schwellen.closingRate?.gruen ?? 0.25)}) bei ${k.bgShows} stattgefundenen Beratungen.`);
  if (k.abschluesse) saetze.push(`${k.abschluesse} Abschlüsse mit ${formatWert(k.umsatz, "eur")} Umsatz, Ø ${formatWert(k.aov, "eur")}.`);
  if (angebote.length) saetze.push(`${angebote.length} ${angebote.length === 1 ? "Angebot liegt" : "Angebote liegen"} seit über 7 Tagen ohne Bewegung.`);

  return (
    <>
      <SeitenKopf titel="Closing" klartext={saetze.join(" ") || "Noch keine Beratungsgespräche im Zeitraum."} />

      <Grid cols={4}>
        <Kachel id="showRateBG" wert={k.showRateBG} vorher={v?.showRateBG} basis={k.bgFaellig} settings={st} untertitel={`${k.bgShows} von ${k.bgFaellig} Beratungen`} />
        <Kachel id="closingRate" wert={k.closingRate} vorher={v?.closingRate} basis={k.bgShows} settings={st} untertitel={`${k.abschluesse} Abschlüsse`} />
        <Kachel id="umsatz" wert={k.umsatz} vorher={v?.umsatz} settings={st} />
        <Kachel id="aov" wert={k.aov} vorher={v?.aov} settings={st} untertitel={k.plaetzeB2B != null ? `Ø ${formatWert(k.plaetzeB2B, "faktor")} Plätze pro B2B-Deal` : undefined} />
      </Grid>
      <Grid cols={4} className="mt-3">
        <Kachel id="angebotsquote" wert={k.angebotsquote} vorher={v?.angebotsquote} settings={st} untertitel={`${k.angebote} Angebote · ${k.bgGebucht} Beratungen gebucht`} />
        <Kachel id="angebotsAbschluss" wert={k.angebotsAbschluss} vorher={v?.angebotsAbschluss} basis={k.angebote} settings={st} />
        <Kachel id="rabattquote" wert={k.rabattquote} vorher={v?.rabattquote} basis={k.rabattBasis} settings={st} />
        <Kachel id="salesCycle" wert={k.salesCycle} vorher={v?.salesCycle} settings={st} untertitel="Median Eintragung → Gewonnen" />
      </Grid>

      <Card className="mt-3" titel="Closer im Vergleich">
        {closer.length === 0 ? <Leer>Keine Closer angelegt.</Leer> : (
          <Tabelle kopf={["Closer", "Gespräche", "Shows", "Abschlüsse", "Closing-Rate", "Umsatz", "AOV", "Offene Angebote", "Ø Tage im Angebot"]} minBreite={820}>
            {closer.map((c) => {
              const ziel = st.repZiele[c.repId];
              const z = (id: KpiId, w: number | null, basis?: number) => <AmpelZelle a={ampel(id, w, basis, st)}>{formatWert(w, "pct")}</AmpelZelle>;
              return (
                <tr key={c.repId}>
                  <Td links className="font-medium">{c.name}</Td>
                  <Td>{c.bg}</Td>
                  <Td>{c.bgShows}</Td>
                  <Td>{c.abschluesse}{ziel?.abschluesse ? <span className="text-[11px] text-muted"> / {ziel.abschluesse}</span> : null}</Td>
                  <Td>{z("closingRate", c.closingRate, c.bgShows)}</Td>
                  <Td>{formatWert(c.umsatz, "eur")}{ziel?.umsatz ? <span className="text-[11px] text-muted"> / {formatWert(ziel.umsatz, "eur", true)}</span> : null}</Td>
                  <Td>{formatWert(c.aov, "eur")}</Td>
                  <Td>{c.offeneAngebote}</Td>
                  <Td className={cx(c.tageImAngebot != null && c.tageImAngebot > 7 && "text-bad-ink font-medium")}>{c.tageImAngebot != null ? `${Math.round(c.tageImAngebot)} Tage` : "–"}</Td>
                </tr>
              );
            })}
          </Tabelle>
        )}
        <p className="mt-2 text-xs text-muted">Werte nach dem Schrägstrich sind Monatsziele aus den Einstellungen. Closing-Rate grau bei weniger als 10 Shows.</p>
      </Card>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card titel="Verlustgründe je Closer">
          {hinweise.length > 0 && (
            <ul className="mb-3 flex flex-col gap-1.5">
              {hinweise.map((h) => <li key={h} className="rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn-ink">Coaching-Hinweis: {h}</li>)}
            </ul>
          )}
          {closer.every((c) => c.verlustgruende.length === 0) ? <Leer>Keine Verluste im Zeitraum.</Leer> : (
            <div className="flex flex-col gap-4">
              {closer.filter((c) => c.verlustgruende.length).map((c) => {
                const n = c.verlustgruende.reduce((s, g) => s + g.anzahl, 0);
                return (
                  <div key={c.repId}>
                    <div className="mb-1 flex justify-between text-[13px]"><span className="font-medium">{c.name}</span><span className="text-muted">{n} verloren</span></div>
                    <HBalken daten={c.verlustgruende.slice(0, 5).map((g) => ({ name: g.grund, wert: g.anzahl, hervor: g.grund === "Preis" && n >= 5 && g.anzahl / n >= 0.4 }))} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <div className="flex flex-col gap-3">
          <Card titel="Paket-Mix" aktion={<span className="text-xs text-muted">gewonnene Deals im Zeitraum</span>}>
            {mixGesamt === 0 ? <Leer>Keine Abschlüsse im Zeitraum.</Leer> : (
              <>
                <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-surface-2">
                  {mix.map((m, i) => m.anteil ? <div key={m.paket} style={{ width: `${m.anteil * 100}%`, background: `var(--s${i + 1})` }} className="border-r-2 border-[var(--surface)] last:border-r-0" title={`${m.paket}: ${pct(m.anteil)} vom Umsatz`} /> : null)}
                </div>
                <Tabelle kopf={["Paket", "Abschlüsse", "Umsatz", "Anteil Umsatz"]} minBreite={360}>
                  {mix.map((m, i) => (
                    <tr key={m.paket}>
                      <Td links><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: `var(--s${i + 1})` }} />{m.paket}</Td>
                      <Td>{m.anzahl}</Td>
                      <Td>{formatWert(m.umsatz, "eur")}</Td>
                      <Td>{pct(m.anteil)}</Td>
                    </tr>
                  ))}
                </Tabelle>
              </>
            )}
          </Card>
          <Card titel={`Angebote > 7 Tage ohne Bewegung (${angebote.length})`}>
            {angebote.length === 0 ? <Leer>Keine liegengebliebenen Angebote.</Leer> : (
              <Tabelle kopf={["Lead", "Closer", "Wert", "Seit"]} minBreite={420}>
                {angebote.slice(0, 15).map(({ opp, lead, tage }) => (
                  <tr key={opp.id}>
                    <Td links><CloseLink leadId={opp.leadId}>{lead?.name ?? opp.leadId}</CloseLink></Td>
                    <Td>{ds.reps.find((r) => r.id === opp.userId)?.name ?? "–"}</Td>
                    <Td>{formatWert(opp.value || opp.listenpreis, "eur")}</Td>
                    <Td className={cx("font-medium", tage > 14 ? "text-bad-ink" : "text-warn-ink")}>{Math.floor(tage)} Tage</Td>
                  </tr>
                ))}
              </Tabelle>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
