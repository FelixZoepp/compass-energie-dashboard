import { seite, type SP } from "@/lib/seite";
import { berechne, engpass, funnel } from "@/lib/kpi/engine";
import { ampel, formatWert, type KpiId } from "@/lib/kpi/katalog";
import { durchlaufzeiten, funnelBasis, funnelVergleich, HORIZONTE, verlusteNachStufe, wochenKohorten } from "@/lib/kpi/sales";
import { AmpelZelle, Card, Leer, SeitenKopf, cx } from "@/components/ui";
import { HBalken } from "@/components/sales/hbalken";
import { FunnelStufen } from "@/components/sales/funnel-stufen";
import { Umschalter } from "@/components/sales/umschalter";
import { Tabelle, Td } from "@/components/sales/tabelle";
import { sequenz } from "@/components/sales/sequenz";

const pct = (x: number | null | undefined) => formatWert(x, "pct");

export default async function FunnelSeite({ searchParams }: { searchParams: SP }) {
  const { ds, f, params } = await seite("/funnel", searchParams);
  const k = berechne(ds, f);
  const stufen = funnel(k);
  const eng = engpass(k, ds);
  const dim = params.dim === "typ" ? "typ" : "quelle";
  const gruppen = funnelVergleich(ds, f, dim);
  const zeiten = durchlaufzeiten(ds, f);
  const verluste = verlusteNachStufe(ds, f);
  const kohorten = wochenKohorten(ds, f, 10);
  const kohortenMetrik = params.kohorte === "show" ? "show" : params.kohorte === "abschluss" ? "abschluss" : "termin";
  const kohortenWerte = kohorten.filter((z) => z.leads >= 10).flatMap((z) => z[kohortenMetrik].filter((v): v is number => v != null));
  const kohortenMax = Math.max(0.0001, ...kohortenWerte);
  const kohortenMin = kohortenWerte.length ? Math.min(...kohortenWerte) : 0;

  const vergleichStufen = [
    { key: "leads", label: "Leads", kpi: null },
    { key: "eg", label: "Erstgespräche gebucht", kpi: "buchungsquote" },
    { key: "egShow", label: "Erstgespräche stattgefunden", kpi: "showRateEG" },
    { key: "bg", label: "Beratungen gebucht", kpi: "qualifizierungsquote" },
    { key: "bgShow", label: "Beratungen stattgefunden", kpi: "showRateBG" },
    { key: "won", label: "Abschlüsse", kpi: "closingRate" },
  ] as const;

  // Bester / schwächster Kanal nach Lead → Abschluss
  const mitAbschlussQuote = gruppen.filter((g) => g.k.leads >= 10).map((g) => ({ g, q: g.k.abschluesse / g.k.leads })).sort((a, b) => b.q - a.q);
  const klartext = eng
    ? <>Größter Verlust im Funnel: <strong className="text-ink">{eng.label} {pct(eng.wert)}</strong> (Ziel {pct(eng.ziel)}).{mitAbschlussQuote.length >= 2 && <> Bester Kanal von Lead zu Abschluss: <strong className="text-ink">{mitAbschlussQuote[0].g.label}</strong> mit {pct(mitAbschlussQuote[0].q)}.</>}</>
    : <>Alle Funnel-Stufen liegen im Ziel oder haben noch zu wenig Daten.</>;

  return (
    <>
      <SeitenKopf titel="Sales-Funnel" klartext={klartext} />

      <Card titel={`Funnel ${f.zeitraum.label} · ${f.sicht === "kohorte" ? "Kohortensicht" : "Ereignissicht"}`}>
        {k.leads === 0 ? <Leer>Keine Leads im gewählten Zeitraum.</Leer> : <FunnelStufen stufen={stufen} settings={ds.settings} engpassKpi={eng?.kpi} k={k} />}
        <p className="mt-3 text-xs text-muted">Conversion jeweils zur Vorstufe, Show-Raten auf fällige Termine bezogen. Quelle, Kundentyp und Rep über die Filterleiste oben.</p>
      </Card>

      <Card className="mt-3" titel="Funnel-Vergleich" aktion={
        <Umschalter pfad="/funnel" params={params} name="dim" aktiv={dim} optionen={[{ key: "quelle", label: "Nach Quelle" }, { key: "typ", label: "B2B vs. B2C" }]} />
      }>
        <Tabelle kopf={["Stufe", ...gruppen.map((g) => g.label)]} minBreite={560}>
          {vergleichStufen.map((s) => (
            <tr key={s.key}>
              <Td links className="text-ink-2">{s.label}</Td>
              {gruppen.map((g) => {
                const st = g.stufen.find((x) => x.key === s.key);
                const a = s.kpi && st ? ampel(s.kpi as KpiId, st.conv, funnelBasis(s.kpi, g.k), ds.settings) : "neutral";
                return (
                  <Td key={g.key}>
                    <div className="font-semibold">{formatWert(st?.wert, "zahl")}</div>
                    {s.kpi && <div className="mt-0.5 text-[11px]"><AmpelZelle a={a}>{st?.conv != null ? pct(st.conv) : "–"}{a === "grau" && st?.conv != null ? " · wenig Daten" : ""}</AmpelZelle></div>}
                  </Td>
                );
              })}
            </tr>
          ))}
          <tr className="bg-surface-2">
            <Td links className="font-medium">Lead → Abschluss</Td>
            {gruppen.map((g) => <Td key={g.key} className="font-semibold">{g.k.leads ? pct(g.k.abschluesse / g.k.leads) : "–"}</Td>)}
          </tr>
          <tr>
            <Td links className="text-ink-2">Umsatz</Td>
            {gruppen.map((g) => <Td key={g.key}>{formatWert(g.k.umsatz, "eur")}</Td>)}
          </tr>
        </Tabelle>
      </Card>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card titel="Durchlaufzeiten (Median)">
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {zeiten.map((z, i) => (
              <li key={z.label} className={cx("flex items-center justify-between gap-3 py-2.5 text-sm", i === zeiten.length - 1 && "font-medium")}>
                <span className="text-ink-2">{z.label}</span>
                <span className="flex items-baseline gap-2">
                  <strong className={cx("text-lg tabular", z.anzahl < 3 && "text-muted")}>{z.anzahl < 3 ? "–" : `${z.median!.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Tage`}</strong>
                  <span className="text-xs text-muted">{z.anzahl < 3 ? "zu wenig Daten" : `n = ${z.anzahl}`}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card titel={`Wo gehen Leads verloren? (${verluste.anzahl} verlorene Opps)`}>
          {verluste.anzahl === 0 ? <Leer>Keine Verluste im Zeitraum.</Leer> : (
            <div className="flex flex-col gap-4">
              {verluste.stufen.filter((s) => s.anzahl > 0).map((s) => (
                <div key={s.stufe}>
                  <div className="mb-1 flex justify-between text-[13px]"><span className="font-medium">{s.stufe}</span><span className="text-muted">{s.anzahl} · {pct(s.anzahl / verluste.anzahl)}</span></div>
                  <HBalken daten={s.gruende.slice(0, 5).map((g) => ({ name: g.name, wert: g.wert }))} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-3" titel="Wochen-Kohorten" aktion={
        <Umschalter pfad="/funnel" params={params} name="kohorte" aktiv={kohortenMetrik}
          optionen={[{ key: "termin", label: "Termin" }, { key: "show", label: "Show" }, { key: "abschluss", label: "Abschluss" }]} />
      }>
        <p className="mb-2 text-xs text-muted">
          Anteil der Leads einer Eintragungswoche, die nach 7/14/30/60 Tagen einen {kohortenMetrik === "termin" ? "gebuchten Erstgesprächstermin" : kohortenMetrik === "show" ? "stattgefundenen Erstgesprächstermin" : "Abschluss"} haben. „–“ = Zeitraum noch nicht abgelaufen.
        </p>
        <Tabelle kopf={["Eintragungswoche", "Leads", ...HORIZONTE.map((h) => `nach ${h} Tagen`)]} minBreite={560}>
          {kohorten.map((z) => (
            <tr key={z.woche}>
              <Td links className="whitespace-nowrap text-ink-2">{z.label}</Td>
              <Td>{z.leads}</Td>
              {z[kohortenMetrik].map((v, i) => {
                const klein = z.leads < 10;
                return (
                  <td key={i} className="p-0.5 text-right">
                    <div className={cx("rounded px-2 py-1.5", klein && v != null && "opacity-60")} style={klein ? undefined : sequenz(v, kohortenMax, kohortenMin)}
                      title={v == null ? "noch nicht reif" : `${pct(v)} von ${z.leads} Leads${klein ? " (zu wenig Daten)" : ""}`}>
                      {v == null ? <span className="text-muted">–</span> : pct(v)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </Tabelle>
      </Card>
    </>
  );
}
