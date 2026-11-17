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

## Close-CRM

Angelegt per `npm run close:setup -- --anwenden` (idempotent, Standard ist ein Trockenlauf, nichts wird gelöscht). Struktur nach Vorbild der Zoepp-Cloud, alle IDs werden über Namen aufgelöst.

**Pipeline „Vertrieb TRIAS 360“:** Setting → Setting No-Show → Closing terminiert → Closing No-Show → Closing FU → CC2 → Angebot → Gewonnen / Verloren

**Lead-Status:** Neu, Kontaktversuch, Erstgespräch terminiert, Beratung terminiert, Follow-up, Angebot, Kunde, Nicht qualifiziert, Verloren, Bad Data (die Close-Standardstatus bleiben bestehen)

**Lead-Felder für Abläufe:** `Gesperrt bis` (blendet Leads aus den Anruflisten aus), `Erstgespräch am`, `Beratung am`, `Setter`, `Closer`

### Gesprächsprotokolle (Custom Activities)
| Protokoll | Wer | Ergebnisse |
|---|---|---|
| 1 - Erstkontakt (Terminierung) | Setter | Erstgespräch terminiert · Rückruf vereinbart · Nicht erreicht · Kein Interesse · Nicht qualifiziert · Bad Data |
| 2 - Erstgespräch (Setting) | Setter | Beratung terminiert · Follow-up / Rückruf · Nicht qualifiziert · No-Show · Verschoben · Abgesagt (+ Qualifizierung GS 1–4, Closer, Notizen für den Closer) |
| 3 - Beratungsgespräch (Closing) | Closer | Gewonnen · Angebot verschickt · Follow-up · CC2 terminiert · Verloren · No-Show · Verschoben · Abgesagt · Nicht qualifiziert (+ Paket, Plätze, Preis, Zahlungsart, Verlustgrund) |
| 4 - Follow-up | beide | Erstgespräch terminiert · Beratung terminiert · Gewonnen · Weiter Follow-up · Verloren · Nicht erreicht |

### Smart Views (Tabs)
0.9 Offene Deals ohne Bewegung > 7 Tage · **1.0 Neue Inbound-Leads – sofort anrufen** · 1.1 Kontaktversuche offen · 1.2 Erstgespräche heute · 1.3 No-Show Erstgespräch zurückholen · 1.4 Setting-Follow-ups fällig · **2.0 Beratungen heute** · 2.1 Closing-Follow-ups fällig · 2.2 Offene Angebote > 3 Tage · 2.3 No-Show Beratung zurückholen · 2.4 CC2 · 3.0 Kunden · 3.1 Verloren – Reaktivierung fällig · 3.2 Nicht qualifiziert

Gesperrte Leads (`Gesperrt bis` in der Zukunft) erscheinen in den Anruf-Views erst wieder, wenn die Sperre abgelaufen ist.

### Protokoll-Automatik
Close-Webhook `activity.custom_activity` → `src/lib/close/regeln.ts` (reine Regeln, getestet mit `npm test`) → `src/lib/close/automatik.ts` (führt in Close aus). Jedes Protokoll landet in `close_protokolle`, jede Regel in `automatik_log`. Wenn sich die Schlüsselfelder nicht ändern (z. B. nur die Notiz), werden die Aktionen nicht erneut ausgeführt. Leads mit Status „Kunde“ werden nie zurückgestuft. **Es gehen keine Nachrichten an Leads raus**, nur interne Änderungen und Aufgaben.

| Protokoll → Ergebnis | Aktion in Close |
|---|---|
| Erstkontakt → Erstgespräch terminiert | Lead „Erstgespräch terminiert“, `Erstgespräch am`, Setter = Bearbeiter, Opp „Setting“ (anlegen), Sperre aufheben |
| Erstkontakt → Rückruf vereinbart | Lead „Kontaktversuch“, gesperrt bis Rückruf, Rückruf-Aufgabe |
| Erstkontakt → Nicht erreicht | Lead „Kontaktversuch“, 2 Std. gesperrt (bzw. bis Kalender) |
| Erstkontakt → Kein Interesse | Opps verloren („Kein Bedarf“), Lead „Verloren“, 3 Monate gesperrt, Notiz |
| … → Nicht qualifiziert | Lead „Nicht qualifiziert“, Opps verloren (Grund), 3 Monate gesperrt – mit Kalender: bis dahin + Rückruf-Aufgabe |
| Erstkontakt → Bad Data / falsche Nummer | Lead „Bad Data“, Opps verloren |
| Erstgespräch → Beratung terminiert | Lead „Beratung terminiert“, `Beratung am`, Closer/Setter, Kundentyp/Teamgröße/Rolle an den Lead, Opp „Closing terminiert“ |
| Erstgespräch → Follow-up / Abgesagt | Lead „Follow-up“, Opp „Setting“, gesperrt bis Termin, Aufgabe |
| Erstgespräch → No-Show | Opp „Setting No-Show“, Rückhol-Aufgabe |
| Erstgespräch → Verschoben | neuer `Erstgespräch am`, Opp „Setting“ |
| Closing → Gewonnen | Lead „Kunde“, Opp gewonnen mit Wert/Paket/Plätzen/Zahlungsart; ohne Wert Aufgabe „Auftragswert nachtragen“; offene Nachfass-Aufgaben erledigt |
| Closing → Angebot verschickt | Lead „Angebot“, Opp „Angebot“ (Wert, Datum) + eigene Regel: Nachfass-Aufgaben Tag 1/3/7 |
| Closing → Follow-up | Lead „Follow-up“, Opp „Closing FU“, gesperrt bis Termin, Aufgabe |
| Closing → CC2 terminiert | Opp „CC2“, `Beratung am` = CC2-Termin |
| Closing → No-Show | Opp „Closing No-Show“, Rückhol-Aufgabe |
| Closing → Verschoben / Abgesagt | Opp „Closing terminiert“ + neuer Termin / Rückruf-Aufgabe |
| … → Verloren | Opps verloren (Verlustgrund), Lead „Verloren“, gesperrt bis Kalender oder 3 Monate, Notiz → taucht danach in 3.1 Reaktivierung auf |
| Follow-up → Erstgespräch / Beratung terminiert / Gewonnen | wie oben (Closer = „Gelegt auf“) |
| Follow-up → Weiter Follow-up / Nicht erreicht | gesperrt bis Termin (bzw. 1 Tag), Aufgabe |

**Einschalten:** Standard ist AUS. Dann wird nur protokolliert, was passieren würde (`automatik_log.trocken = true`). Einschalten über `settings.data.automatik`:
```json
{ "automatik": { "aktiv": true, "regeln": { "closing.angebot_nachfassen": false } } }
```
Einzelne Regeln lassen sich mit `false` abschalten (IDs: `REGEL_IDS` in `src/lib/close/regeln.ts`). Voraussetzungen: Supabase-Migration `supabase/migrations/002_protokolle.sql` (steht auch am Ende von `schema.sql`) und der Close-Webhook inkl. `activity.custom_activity` (`npm run close:webhook -- https://<domain>/api/webhooks/close`).

**Echttest:** `npm run close:probe -- --anwenden` spielt den Ablauf mit einem Test-Lead durch (Kontaktversuch → Erstgespräch → Beratung → Angebot → Gewonnen), prüft Lead-Status/Opp/Aufgaben und löscht den Test-Lead danach.

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
