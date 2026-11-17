"use client";
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

export interface Quoten {
  aov: number; closingRate: number; showRateBG: number; qualifizierungsquote: number; showRateEG: number; buchungsquote: number;
  cpl: number; anwahlenProLead: number; gespraechsMinProLead: number;
}

const eur = (v: number) => v.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const zahl = (v: number) => Math.ceil(v).toLocaleString("de-DE");
const pct = (v: number) => `${(v * 100).toLocaleString("de-DE", { maximumFractionDigits: 0 })} %`;

const MIN_SETTER_PRO_ANWAHL = 3; // Ø Minuten je Anwahlversuch inkl. Nacharbeit
const STD_PRO_BERATUNG = 1.25;

function rechne(ziel: number, q: Quoten) {
  const abschluesse = Math.ceil(ziel / Math.max(1, q.aov));
  const bgShows = abschluesse / Math.max(0.01, q.closingRate);
  const bgGebucht = bgShows / Math.max(0.01, q.showRateBG);
  const egShows = bgGebucht / Math.max(0.01, q.qualifizierungsquote);
  const egGebucht = egShows / Math.max(0.01, q.showRateEG);
  const leads = egGebucht / Math.max(0.01, q.buchungsquote);
  const budget = leads * q.cpl;
  const setterStd = (q.anwahlenProLead * Math.ceil(leads) * MIN_SETTER_PRO_ANWAHL + q.gespraechsMinProLead * Math.ceil(leads)) / 60;
  const closerStd = Math.ceil(bgGebucht) * STD_PRO_BERATUNG;
  return { abschluesse, bgShows, bgGebucht, egShows, egGebucht, leads, budget, setterStd, closerStd };
}

interface Regler { key: keyof Quoten; label: string; min: number; max: number; schritt: number; typ: "pct" | "eur" | "zahl" }
const REGLER: Regler[] = [
  { key: "aov", label: "Ø Auftragswert", min: 500, max: 30000, schritt: 100, typ: "eur" },
  { key: "closingRate", label: "Closing-Rate", min: 0.05, max: 0.6, schritt: 0.01, typ: "pct" },
  { key: "showRateBG", label: "Show-Rate Beratung", min: 0.3, max: 1, schritt: 0.01, typ: "pct" },
  { key: "qualifizierungsquote", label: "Qualifizierungsquote", min: 0.1, max: 0.9, schritt: 0.01, typ: "pct" },
  { key: "showRateEG", label: "Show-Rate Erstgespräch", min: 0.3, max: 1, schritt: 0.01, typ: "pct" },
  { key: "buchungsquote", label: "Buchungsquote", min: 0.05, max: 0.7, schritt: 0.01, typ: "pct" },
  { key: "cpl", label: "CPL", min: 5, max: 300, schritt: 1, typ: "eur" },
  { key: "anwahlenProLead", label: "Anwahlen pro Lead", min: 1, max: 15, schritt: 0.5, typ: "zahl" },
];
const fmtRegler = (r: Regler, v: number) => (r.typ === "pct" ? pct(v) : r.typ === "eur" ? eur(v) : v.toLocaleString("de-DE", { maximumFractionDigits: 1 }));

function Diff({ neu, alt, gutWennWeniger = true, format }: { neu: number; alt: number; gutWennWeniger?: boolean; format: (v: number) => string }) {
  const d = neu - alt;
  if (Math.abs(d) < 0.5) return null;
  const gut = gutWennWeniger ? d < 0 : d > 0;
  return <span className={`text-xs font-medium ${gut ? "text-good-ink" : "text-bad-ink"}`}>{d > 0 ? "+" : "−"}{format(Math.abs(d))}</span>;
}

export function Planungsrechner({ quoten, ausStart, zielStart, basis }: { quoten: Quoten; ausStart: string[]; zielStart: number; basis: { abschluesse: number; bgShows: number; egShows: number; leads: number } }) {
  const [ziel, setZiel] = useState(zielStart);
  const [q, setQ] = useState<Quoten>(quoten);
  const echt = useMemo(() => rechne(ziel, quoten), [ziel, quoten]);
  const r = useMemo(() => rechne(ziel, q), [ziel, q]);
  const geaendert = REGLER.some((x) => q[x.key] !== quoten[x.key]);

  const kette: { wert: string; text: string; op?: string }[] = [
    { wert: eur(ziel), text: "Umsatzziel" },
    { op: `÷ AOV ${eur(q.aov)}`, wert: zahl(r.abschluesse), text: "Abschlüsse" },
    { op: `÷ Closing-Rate ${pct(q.closingRate)}`, wert: zahl(r.bgShows), text: "Beratungsgespräche" },
    { op: `÷ Show-Rate ${pct(q.showRateBG)}`, wert: zahl(r.bgGebucht), text: "gebuchte Beratungen" },
    { op: `÷ Qualifizierung ${pct(q.qualifizierungsquote)}`, wert: zahl(r.egShows), text: "Erstgespräche" },
    { op: `÷ Show-Rate ${pct(q.showRateEG)}`, wert: zahl(r.egGebucht), text: "gebuchte Erstgespräche" },
    { op: `÷ Buchungsquote ${pct(q.buchungsquote)}`, wert: zahl(r.leads), text: "Leads" },
    { op: `× CPL ${eur(q.cpl)}`, wert: eur(r.budget), text: "Werbebudget" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <section className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-[13px] text-ink-2">
            Umsatzziel (Monat)
            <div className="relative">
              <input type="number" inputMode="numeric" min={0} step={1000} value={ziel} onChange={(e) => setZiel(Math.max(0, Number(e.target.value) || 0))}
                className="h-11 w-48 rounded-lg border border-line bg-surface px-3 pr-8 text-lg font-semibold tabular outline-none focus:border-accent" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">€</span>
            </div>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[25000, 50000, 75000, 100000, 150000].map((z) => (
              <button key={z} type="button" onClick={() => setZiel(z)} className={`h-8 rounded-full border px-3 text-xs ${ziel === z ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-2 hover:bg-surface-2"}`}>{eur(z)}</button>
            ))}
          </div>
        </div>

        {/* Kette */}
        <div className="mt-5 flex flex-wrap items-stretch gap-x-1 gap-y-3">
          {kette.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              {s.op && <span className="px-1 text-[11px] leading-tight text-muted">{s.op}<br />=</span>}
              <div className={`rounded-lg border px-3 py-2 ${i === kette.length - 1 ? "border-accent bg-accent-soft" : "border-line bg-surface-2"}`}>
                <div className={`font-semibold tabular ${i === kette.length - 1 ? "text-lg text-accent" : "text-base"}`}>{s.wert}</div>
                <div className="text-[11px] text-ink-2">{s.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-line p-3">
            <div className="text-xs text-ink-2">Werbebudget</div>
            <div className="flex items-baseline gap-2"><span className="text-2xl font-semibold tabular">{eur(r.budget)}</span>{geaendert && <Diff neu={r.budget} alt={echt.budget} format={eur} />}</div>
            <div className="text-xs text-muted">pro Monat · ≈ {eur(r.budget / 30)} pro Tag</div>
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="text-xs text-ink-2">Setter-Stunden</div>
            <div className="flex items-baseline gap-2"><span className="text-2xl font-semibold tabular">{zahl(r.setterStd)} h</span>{geaendert && <Diff neu={r.setterStd} alt={echt.setterStd} format={(v) => `${zahl(v)} h`} />}</div>
            <div className="text-xs text-muted">{q.anwahlenProLead.toLocaleString("de-DE")} Anwahlen × {MIN_SETTER_PRO_ANWAHL} Min. + Gesprächszeit je Lead · ≈ {(r.setterStd / 160).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Vollzeit</div>
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="text-xs text-ink-2">Closer-Stunden</div>
            <div className="flex items-baseline gap-2"><span className="text-2xl font-semibold tabular">{zahl(r.closerStd)} h</span>{geaendert && <Diff neu={r.closerStd} alt={echt.closerStd} format={(v) => `${zahl(v)} h`} />}</div>
            <div className="text-xs text-muted">{zahl(r.bgGebucht)} Beratungen × {STD_PRO_BERATUNG.toLocaleString("de-DE")} h · ≈ {(r.closerStd / 160).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Vollzeit</div>
          </div>
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Was passiert, wenn …?</h2>
          <button type="button" disabled={!geaendert} onClick={() => setQ(quoten)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-2 hover:bg-surface-2 disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" /> Echte Werte</button>
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
          {REGLER.map((x) => (
            <label key={x.key} className="flex flex-col gap-1">
              <span className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="text-ink-2">{x.label}{ausStart.includes(x.key) && <span className="ml-1 text-[11px] text-muted">(Startwert, zu wenig Daten)</span>}</span>
                <span className="tabular"><strong>{fmtRegler(x, q[x.key])}</strong>{q[x.key] !== quoten[x.key] && <span className="ml-1.5 text-xs text-muted">echt {fmtRegler(x, quoten[x.key])}</span>}</span>
              </span>
              <input type="range" min={x.min} max={x.max} step={x.schritt} value={q[x.key]} onChange={(e) => setQ({ ...q, [x.key]: Number(e.target.value) })}
                className="w-full accent-[var(--accent)]" aria-label={x.label} />
            </label>
          ))}
        </div>
        {geaendert && (
          <p className="mt-4 rounded-lg bg-accent-soft p-3 text-sm text-ink">
            Mit diesen Quoten brauchst du <strong>{zahl(r.leads)} Leads</strong> statt {zahl(echt.leads)} und <strong>{eur(r.budget)}</strong> Werbebudget statt {eur(echt.budget)}
            {" "}({r.budget <= echt.budget ? "−" : "+"}{eur(Math.abs(r.budget - echt.budget))}).
          </p>
        )}
        <p className="mt-3 text-xs text-muted">Basis letzte 90 Tage: {basis.leads} Leads, {basis.egShows} Erstgespräche, {basis.bgShows} Beratungen, {basis.abschluesse} Abschlüsse. Filter (Quelle, Kampagne, Kundentyp) wirken auf die Quoten.</p>
      </section>
    </div>
  );
}
