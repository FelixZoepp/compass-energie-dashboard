# Compass Energie · Führungs-Dashboard

Meta Ads und Sales in einem System. Ein Blick am Morgen, und die Geschäftsführung weiß: Läuft es? Wo klemmt es? Was muss heute passieren?
Grundlage ist die Spezifikation „02 – Führungs-Dashboard TRIAS 360“. Ausbaupläne (WhatsApp, Calendly, DocuSign) stehen in [`docs/ROADMAP.md`](docs/ROADMAP.md).

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind 4 · Recharts · Supabase (Postgres, Auth, RLS) · Vercel (Hosting, Cron)

## Seiten

| Seite | Für | Inhalt |
|---|---|---|
| `/` Cockpit | GF | 6 Kernkacheln, Monatsziel-Pacing, Funnel mit Engpass, Warnungen, 12-Wochen-Trend |
| `/meta` | Marketing | Full-Funnel-Tabelle Kampagne → Anzeige, Creative-Galerie + Fatigue, Breakdowns, Meta vs. CRM |
| `/funnel` | Vertriebsleitung | Funnel nach Quelle/Typ, Durchlaufzeiten, Verlustgründe, Wochen-Kohorten |
| `/setting`, `/closing` | Vertriebsleitung | Kacheln, Tabellen je Setter/Closer, Live-Liste unbearbeiteter Leads |
| `/team`, `/team/tv` | alle | Leaderboard, Rep-Scorecard, Coaching-Ampel, TV-Modus |
| `/pipeline` | GF | Kanban, gewichtete Pipeline, Forecast |
| `/planung` | GF, Marketing | Rückwärtsrechnung Umsatzziel → Budget und Kapazität, mit Reglern |
| `/mein-tag` | Reps | eigene Ziele, Termine, No-Shows, Follow-ups |
| `/datenqualitaet` | alle | Hygiene-Score, Fehlerlisten mit Close-Links |
| `/einstellungen` | Admin | Ziele, Ampeln, Kosten, Arbeitszeit, Rollen, Benutzer, Sync-Status |

Globale Filterleiste: Zeitraum, Vergleich, Quelle, Kampagne, Rep, B2B/B2C, **Ereignis- oder Kohortensicht**. Alle KPI-Definitionen stehen in `src/lib/kpi/katalog.ts`, die Berechnung in `src/lib/kpi/engine.ts`.

Ohne Supabase-Verbindung läuft das Dashboard im **Demo-Modus**: simulierte Daten, kein Login, gelbes Banner.

## Rollen

| Rolle | Sieht |
|---|---|
| `admin` | alles inkl. Einstellungen und Benutzerverwaltung |
| `management` | alles lesen |
| `marketing` | Meta Ads, Sales-Funnel, Planung |
| `rep` | nur eigene Zahlen: Mein Tag, Team/Leaderboard, Datenqualität (eigene Fehler) |

Der erste Nutzer, der sich anmeldet, wird automatisch Admin. Weitere Nutzer lädt der Admin unter Einstellungen ein. Für Reps muss dort der passende Close-User zugeordnet werden.

## Einrichtung (in dieser Reihenfolge)

1. **Supabase verbinden**: Vercel → Projekt → Storage/Integrations → Supabase. Die Integration setzt `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY`.
2. **Schema einspielen**: Inhalt von [`supabase/schema.sql`](supabase/schema.sql) im Supabase-SQL-Editor ausführen. Das Skript ist idempotent.
3. **Restliche Env in Vercel** (siehe [`.env.example`](.env.example)): `CLOSE_API_KEY`, `CRON_SECRET` (zufälliger String), `NEXT_PUBLIC_SITE_URL`, später `META_*`, `CLOSE_WEBHOOK_SECRET`. Lokal: `vercel env pull .env.local`.
4. **Supabase Auth**: Authentication → URL Configuration: Site URL = Dashboard-Domain, Redirect URL `https://<domain>/auth/callback`.
5. **Admin anlegen**: `npm run admin:anlegen -- felix@… "Felix Zoepp"`. Das Passwort wird einmal ausgegeben. Alternativ einfach als erster Nutzer anmelden.
6. **Close-Struktur anlegen**: `npm run close:setup` zeigt im Trockenlauf, was fehlt. `npm run close:setup -- --anwenden` legt es an: Pipeline „Vertrieb TRIAS 360“ (Setting → Closing terminiert → Closing FU → Angebot → CC2 → Gewonnen/Verloren), Lead-Felder (Quelle, UTMs, fbclid/_fbc/_fbp, Kundentyp, Rolle, Teamgröße, Setter, Closer), Opp-Felder (Paket, Plätze, Zahlungsart, Verlustgrund, Listenpreis, Cash collected, Angebot verschickt am) und Meeting-Outcomes (Stattgefunden, No Show, Verschoben, Abgesagt).
7. **Erst-Sync**: `npm run sync` (Close komplett + Meta 90 Tage) oder unter Einstellungen „Close komplett neu laden“.
8. **Close-Webhook**: `npm run close:webhook -- https://<domain>/api/webhooks/close`. Das ausgegebene Secret als `CLOSE_WEBHOOK_SECRET` in Vercel eintragen (sensitive) und neu deployen.
9. **Meta**: Im Business Manager einen System-User mit Zugriff auf das Werbekonto anlegen und einen Token ohne Ablauf mit `ads_read` erzeugen (für CAPI zusätzlich `ads_management`). Dann `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` (act_…), `META_PIXEL_ID` und `META_CAPI_TOKEN` setzen.
10. **UTMs in allen Anzeigen** (URL-Parameter auf Anzeigenebene, IDs statt Namen):
    `utm_source=meta&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}&utm_content={{ad.id}}`
11. **Funnel-Formular**: UTMs sowie `fbclid`, `_fbc` und `_fbp` (Cookies) als Hidden Fields übernehmen und in die gleichnamigen Close-Lead-Felder schreiben. Quelle = „Meta“.
12. **Calendly/Meetings**: Der Meeting-Titel bestimmt den Typ. „Erstgespräch“ → Erstgespräch, „Beratung/Strategie/Closing“ → Beratungsgespräch, „CC2“ → CC2. Nach jedem Termin das Outcome in Close setzen, sonst stimmen die Show-Rates nicht.

### Cron-Jobs

| Route | Takt | Inhalt |
|---|---|---|
| `/api/sync/close` | alle 15 Min. | inkrementeller Abgleich (Sicherheitsnetz zum Webhook) |
| `/api/webhooks/close` | Echtzeit | einzelne Leads, Opps, Meetings, Calls, Tasks (Signatur geprüft) |
| `/api/sync/meta?tage=1` | stündlich | Insights heute |
| `/api/sync/meta?tage=28` | 05:00 MEZ | letzte 28 Tage neu (Meta korrigiert rückwirkend) |
| `/api/sync/meta-creatives` | täglich | Namen, Status, Budgets, Thumbnails, Texte |
| `/api/capi/push` | alle 15 Min. | Close → Meta Conversions API (**nur mit `CAPI_AKTIV=1`**) |
| `/api/reports/daily` / `weekly` | 07:30 / Mo 08:00 | Briefings an Slack (**nur mit `REPORTS_AKTIV=1`**, sonst Vorschau) |

**Aufteilung (Vercel Hobby erlaubt nur tägliche Crons):**
- `vercel.json` (UTC): Close-Abgleich täglich 03:00, Meta 28 Tage 04:00, Creatives 04:30, Briefing 06:30, Wochenreport Mo 07:00.
- [`supabase/cron.sql`](supabase/cron.sql) (pg_cron + pg_net, einmal im SQL-Editor einspielen): Close alle 15 Min., Meta stündlich, CAPI alle 15 Min.

Mit Vercel Pro können die häufigen Jobs stattdessen in `vercel.json` stehen.

Alle Sync-Routen akzeptieren `Authorization: Bearer $CRON_SECRET` oder einen eingeloggten Admin. `/api/health` zeigt, was konfiguriert ist.

### Schalter (Standard: aus)

Es werden keine Nachrichten verschickt und keine Daten an Meta gesendet, bevor das freigegeben ist:

- `CAPI_AKTIV=1`: Ereignisse (Lead qualifiziert, Erstgespräch stattgefunden, Gewonnen mit Wert) an Meta senden. Vorschau: `/api/capi/push?trocken=1`, Test: `?test_event_code=TEST…`
- `REPORTS_AKTIV=1` + `SLACK_WEBHOOK_URL`: Morgen-Briefing und Wochenreport senden. Vorschau: `/api/reports/daily?vorschau=1`

## Entwicklung

```bash
npm install
npm run dev          # http://localhost:3000 (ohne Supabase: Demo-Modus)
npm run typecheck
npm run lint
```

Skripte (lesen `.env.local`): `close:setup`, `close:webhook`, `admin:anlegen`, `sync`.

## Abnahme (bevor die GF dem Dashboard vertraut)

- [ ] Leads, Termine, Shows und Abschlüsse eines Testmonats stimmen mit einer manuellen Zählung in Close überein (Abweichung 0)
- [ ] Spend pro Tag stimmt mit dem Werbeanzeigenmanager überein (Abweichung < 1 %)
- [ ] 95 % der Meta-Leads haben eine `ad_id` (UTM-Tracking funktioniert)
- [ ] Jede KPI hat Definition, Ziel und Ampel
- [ ] Rep sieht nur eigene Daten, Admin sieht alles
- [ ] Morgen-Briefing kommt 5 Tage in Folge korrekt an
