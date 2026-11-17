# Roadmap Compass Energie

Stand 17.11.2026. Grundlage: Spezifikation „02 – Führungs-Dashboard TRIAS 360“.

## Jetzt (in Arbeit)
- Führungs-Dashboard (Cockpit, Meta Ads, Sales-Funnel, Setting, Closing, Team/Leaderboard/TV, Pipeline, Planungsrechner, Mein Tag, Datenqualität, Einstellungen)
- Close-Sync + Webhook, Meta-Sync (Insights, Creatives, Breakdowns), Supabase-Schema, Login mit Rollen
- Close-Setup-Skript (Pipeline „Vertrieb TRIAS 360“, Lead-/Opp-Felder, Meeting-Outcomes)

## Als Nächstes (Notiz Felix, 17.11.)
Compass schaltet Ads für das Vertriebstraining → Inbound-Leads. Alles soll komplett verbunden sein, „wie bei uns in der Zoepp-Cloud“ im Sales- und Marketing-Bereich:

1. **Komplettes CRM-Setup in Close** für Inbound-Leads (Funnel-Formular mit UTMs/fbclid/_fbc/_fbp als Hidden Fields → Close-Lead)
2. **WhatsApp-Automation**: Bestätigung + Erinnerungen für Termine – Setting (Erstgespräch) und Closing (Beratungsgespräch). Vorbild: Hoffmann-Terminbot (Vorlagen UTILITY, Testmodus, erst nach Freigabe live)
3. **Calendly-Terminstrecke**: Account anlegen, Event-Typen Erstgespräch / Beratungsgespräch, Webhook → Close-Meeting + Opp-Status
4. **DocuSign-Strecke**: Angebot aus Close erzeugen → zur Signatur senden → signiert = Opp „Gewonnen“ + Zahlungsart/Paket übernehmen

Regel: keine Nachricht an Kunden/Leads, bevor Felix die Strecke gesehen und freigegeben hat.

## Später (Spezifikation V2/V3)
- CAPI-Rückspielung live schalten (Code vorhanden, standardmäßig aus)
- Zahlungstool (Stripe/Lexoffice/sevDesk – mit Compass klären) → Tabelle `payments`
- LinkedIn Ads, Landingpage-Analytics, Teilnehmer-Fortschritt, KI-Wochenkommentar
