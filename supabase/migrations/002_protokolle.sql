-- Gesprächsprotokolle aus Close (Custom Activities) + Log der Protokoll-Automatik.
-- Idempotent. Ist auch am Ende von supabase/schema.sql enthalten.

create table if not exists close_protokolle (
  id text primary key,            -- Close acti_… (Custom Activity)
  lead_id text,
  typ text not null check (typ in ('erstkontakt', 'erstgespraech', 'closing', 'followup')),
  user_id text,                   -- Bearbeiter (Close-User)
  datum timestamptz,
  ergebnis text,
  regel text,
  felder jsonb not null default '{}'::jsonb,
  schluessel text,                -- Schlüsselfelder; gleich wie zuvor → keine erneute Automatik
  verarbeitet_am timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists close_protokolle_lead_idx on close_protokolle (lead_id);
create index if not exists close_protokolle_datum_idx on close_protokolle (datum);
create index if not exists close_protokolle_user_idx on close_protokolle (user_id, datum);

create table if not exists automatik_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  activity_id text,
  lead_id text,
  regel text not null,
  beschreibung text,
  aktionen jsonb,                 -- geplante Aktionen
  ergebnis jsonb,                 -- was in Close tatsächlich passiert ist
  ok boolean not null default true,
  trocken boolean not null default true,  -- true = Automatik aus, nur protokolliert
  fehler text
);
create index if not exists automatik_log_at_idx on automatik_log (at desc);
create index if not exists automatik_log_lead_idx on automatik_log (lead_id);

alter table close_protokolle enable row level security;
alter table automatik_log enable row level security;

drop policy if exists lesen on close_protokolle;
create policy lesen on close_protokolle for select to authenticated using (
  app_rolle() in ('admin','management') or user_id = app_rep_id());
drop policy if exists lesen on automatik_log;
create policy lesen on automatik_log for select to authenticated using (app_rolle() in ('admin','management'));
