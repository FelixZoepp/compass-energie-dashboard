-- Häufige Sync-Läufe per pg_cron + pg_net (Vercel Hobby erlaubt nur tägliche Crons).
-- Die TÄGLICHEN Jobs (Meta 28 Tage, Creatives, Close-Vollabgleich, Briefings) laufen über vercel.json –
-- hier deshalb nur die häufigen, damit nichts doppelt läuft.
-- Im Supabase-SQL-Editor ausführen, vorher <DOMAIN> und <CRON_SECRET> ersetzen.
-- Entfernen: select cron.unschedule(jobname) from cron.job where jobname like 'compass-%';

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobname) from cron.job where jobname like 'compass-%';

-- Close inkrementell alle 15 Minuten (Sicherheitsnetz zum Webhook)
select cron.schedule('compass-close', '*/15 * * * *', $$
  select net.http_get(url := 'https://<DOMAIN>/api/sync/close', headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'), timeout_milliseconds := 290000);
$$);
-- Meta: heutiger Tag stündlich
select cron.schedule('compass-meta-stuendlich', '5 * * * *', $$
  select net.http_get(url := 'https://<DOMAIN>/api/sync/meta?tage=1', headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'), timeout_milliseconds := 290000);
$$);
-- Conversions API (läuft nur, wenn CAPI_AKTIV=1 gesetzt ist)
select cron.schedule('compass-capi', '*/15 * * * *', $$
  select net.http_get(url := 'https://<DOMAIN>/api/capi/push', headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'), timeout_milliseconds := 110000);
$$);
