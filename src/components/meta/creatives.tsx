"use client";
import { useState } from "react";
import { Film, ImageIcon } from "lucide-react";
import { ampel, formatWert, type KpiId } from "@/lib/kpi/katalog";
import type { AdZeile, CreativeStatus } from "@/lib/kpi/engine";
import type { Settings } from "@/lib/types";
import { AmpelZelle, cx } from "@/components/ui";
import { KombiChart } from "@/components/charts";

const BADGE: Record<NonNullable<CreativeStatus["badge"]>, { icon: string; text: string; klasse: string }> = {
  top: { icon: "🏆", text: "Top-Performer", klasse: "bg-good-soft text-good-ink" },
  skalieren: { icon: "🔥", text: "Skalieren", klasse: "bg-good-soft text-good-ink" },
  ausgebrannt: { icon: "🧊", text: "Ausgebrannt", klasse: "bg-warn-soft text-warn-ink" },
  abschalten: { icon: "❌", text: "Abschalten", klasse: "bg-bad-soft text-bad-ink" },
};

type Kurve = { stufe: string; anteil: number | null; anzahl: number }[];

export function CreativeGalerie({ ads, status, kurven, settings }: { ads: AdZeile[]; status: Record<string, CreativeStatus>; kurven: Record<string, Kurve>; settings: Settings }) {
  const mitVideo = ads.filter((a) => kurven[a.id]);
  const [auswahl, setAuswahl] = useState<string[]>(mitVideo.slice(0, 3).map((a) => a.id));
  const metrik = (z: AdZeile, label: string, v: number | null, einheit: "pct" | "eur" | "faktor", kpi: KpiId, basis: number) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted">{label}</span>
      <AmpelZelle a={ampel(kpi, v, basis, settings)}><span className="tabular">{formatWert(v, einheit)}</span></AmpelZelle>
    </div>
  );
  // Abbruchkurve: Stufen als Zeilen, ausgewählte Creatives als Reihen (max. 4 → eindeutige Farben)
  const stufen = ["3 Sek.", "25 %", "50 %", "75 %", "100 %"];
  const kurvenDaten = stufen.map((s, i) => Object.fromEntries([["stufe", s], ...auswahl.map((id) => [id, kurven[id]?.[i]?.anteil ?? null])]));
  const name = (id: string) => ads.find((a) => a.id === id)?.name ?? id;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ads.map((z) => {
          const st = status[z.id];
          const b = st?.badge ? BADGE[st.badge] : null;
          return (
            <article key={z.id} className="card flex min-w-0 flex-col overflow-hidden">
              <div className="relative aspect-video bg-surface-2">
                {z.ad?.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={z.ad.thumbnailUrl} alt={`Vorschau ${z.name}`} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="grid h-full place-items-center text-muted">
                    {z.ad?.isVideo ? <Film className="h-8 w-8" aria-label="Video" /> : <ImageIcon className="h-8 w-8" aria-label="Bild" />}
                  </div>
                )}
                {b && <span className={cx("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium shadow", b.klasse)}>{b.icon} {b.text}</span>}
                {z.status && z.status !== "ACTIVE" && <span className="absolute right-2 top-2 rounded-full bg-grey-soft px-2 py-0.5 text-[11px] text-muted">Pausiert</span>}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-3 text-xs">
                <div className="truncate text-sm font-medium" title={z.name}>{z.name}</div>
                {z.ad?.body && <p className="line-clamp-2 text-muted">{z.ad.body}</p>}
                {st?.grund && <p className="rounded bg-warn-soft px-2 py-1 text-warn-ink">Ermüdung: {st.grund}</p>}
                <div className="mt-1 grid grid-cols-1 gap-1">
                  {z.ad?.isVideo && metrik(z, "Hook", z.hook, "pct", "hookRate", z.impressions)}
                  {z.ad?.isVideo && metrik(z, "Hold", z.hold, "pct", "holdRate", z.v3)}
                  {metrik(z, "CTR", z.ctr, "pct", "ctr", z.impressions)}
                  {metrik(z, "CPL", z.cpl, "eur", "cpl", z.leads)}
                  {metrik(z, "Kosten/Show", z.kostenShow, "eur", "kostenShow", z.shows)}
                  {metrik(z, "ROAS", z.roas, "faktor", "roas", z.spend >= 100 ? 99 : 0)}
                </div>
                <div className="mt-auto pt-1 text-muted">Spend {formatWert(z.spend, "eur")} · {z.leads} Leads · {z.abschluesse} Abschlüsse</div>
              </div>
            </article>
          );
        })}
      </div>

      {mitVideo.length > 0 && (
        <div className="card mt-3 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Video-Abbruchkurve (Anteil an Impressionen)</h3>
            <span className="text-xs text-muted">bis zu 4 Creatives vergleichen</span>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {mitVideo.map((a) => {
              const an = auswahl.includes(a.id);
              return (
                <button key={a.id} type="button" aria-pressed={an}
                  onClick={() => setAuswahl((v) => an ? v.filter((x) => x !== a.id) : v.length >= 4 ? v : [...v, a.id])}
                  className={cx("max-w-[220px] truncate rounded-full border px-2.5 py-1 text-xs", an ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-2 hover:bg-surface-2")}>
                  {a.name}
                </button>
              );
            })}
          </div>
          {auswahl.length ? (
            <KombiChart daten={kurvenDaten} x="stufe" format="pct" hoehe={240}
              reihen={auswahl.map((id) => ({ key: id, name: name(id), typ: "line" as const }))} />
          ) : <p className="text-sm text-muted">Creative auswählen.</p>}
        </div>
      )}
    </>
  );
}
