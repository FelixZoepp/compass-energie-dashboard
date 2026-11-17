-- Compass Energie · Führungs-Dashboard
-- Komplettes Schema. Einmal im Supabase-SQL-Editor ausführen (idempotent).
-- Das Dashboard liest serverseitig mit dem Service-Role-Key und filtert Rep-Daten selbst;
-- RLS ist zusätzlich aktiv (Verteidigung in der Tiefe), anon hat keinen Zugriff.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Rollen und Benutzer
do $$ begin
  create type app_rolle as enum ('admin', 'management', 'marketing', 'rep');
exception when duplicate_object then null; end $$;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  rolle app_rolle not null default 'rep',
  rep_id text,               -- Close-User-ID, wenn Setter/Closer
  aktiv boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.app_rolle() returns app_rolle
language sql stable security definer set search_path = public as $$
  select rolle from profiles where id = auth.uid() and aktiv
$$;

create or replace function public.app_rep_id() returns text
language sql stable security definer set search_path = public as $$
  select rep_id from profiles where id = auth.uid() and aktiv
$$;

-- ---------------------------------------------------------------------------
-- Close CRM
create table if not exists reps (
  id text primary key,       -- Close user_…
  name text not null,
  email text,
  rolle text not null default 'beides' check (rolle in ('setter', 'closer', 'beides')),
  aktiv boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists leads (
  id text primary key,       -- Close lead_…
  name text not null,
  created_at timestamptz not null,
  quelle text not null default 'sonstige',
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  fbclid text, fbc text, fbp text,
  email text, telefon text,
  kundentyp text check (kundentyp in ('B2B', 'B2C')),
  rolle text,
  teamgroesse int,
  qualifiziert boolean not null default false,
  setter_id text, closer_id text,
  status_label text,
  raw jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists leads_created_idx on leads (created_at);
create index if not exists leads_utm_content_idx on leads (utm_content);

create table if not exists meetings (
  id text primary key,       -- Close acti_…
  lead_id text not null references leads(id) on delete cascade,
  typ text not null check (typ in ('erstgespraech', 'beratung', 'cc2')),
  titel text,
  booked_at timestamptz not null,
  starts_at timestamptz not null,
  outcome text check (outcome in ('stattgefunden', 'no_show', 'verschoben', 'abgesagt')),
  user_id text,
  updated_at timestamptz not null default now()
);
create index if not exists meetings_lead_idx on meetings (lead_id);
create index if not exists meetings_start_idx on meetings (starts_at);

create table if not exists calls (
  id text primary key,
  lead_id text not null references leads(id) on delete cascade,
  user_id text,
  at timestamptz not null,
  direction text not null,
  duration_sec int not null default 0,
  answered boolean not null default false,
  disposition text
);
create index if not exists calls_lead_idx on calls (lead_id);
create index if not exists calls_at_idx on calls (at);

create table if not exists opportunities (
  id text primary key,
  lead_id text not null references leads(id) on delete cascade,
  stage text not null check (stage in ('setting', 'closing_terminiert', 'closing_fu', 'angebot', 'cc2', 'won', 'lost')),
  status_label text not null,
  value numeric not null default 0,
  listenpreis numeric,
  paket text, plaetze int, zahlungsart text, verlustgrund text,
  created_at timestamptz not null,
  won_at timestamptz, lost_at timestamptz, angebot_am timestamptz,
  stage_since timestamptz not null,
  close_date date,
  user_id text,
  hat_naechste_aufgabe boolean not null default false,
  cash_collected numeric,
  updated_at timestamptz not null default now()
);
create index if not exists opps_lead_idx on opportunities (lead_id);

create table if not exists opp_status_changes (
  id text primary key,
  opp_id text not null,
  lead_id text,
  von text, nach text,
  at timestamptz not null,
  user_id text
);

create table if not exists tasks (
  id text primary key,
  lead_id text references leads(id) on delete cascade,
  user_id text,
  due timestamptz,
  done boolean not null default false,
  text text
);

create table if not exists payments (
  id text primary key default gen_random_uuid()::text,
  lead_id text references leads(id) on delete set null,
  opp_id text,
  at timestamptz not null,
  amount numeric not null,
  quelle text not null default 'manuell'
);

-- ---------------------------------------------------------------------------
-- Meta Ads
create table if not exists meta_ads (
  ad_id text primary key,
  ad_name text not null,
  adset_id text not null, adset_name text,
  campaign_id text not null, campaign_name text,
  status text not null default 'ACTIVE',
  tagesbudget numeric,
  optimierungsziel text,
  thumbnail_url text, body text, title text, video_id text, cta text,
  is_video boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists meta_insights (
  date date not null,
  ad_id text not null,
  spend numeric not null default 0,
  impressions int not null default 0,
  reach int not null default 0,
  link_clicks int not null default 0,
  lp_views int not null default 0,
  video_views_3s int not null default 0,
  thruplays int not null default 0,
  p25 int not null default 0, p50 int not null default 0, p75 int not null default 0, p100 int not null default 0,
  meta_leads int not null default 0,
  meta_schedules int not null default 0,
  meta_purchases int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (date, ad_id)
);

create table if not exists meta_breakdowns (
  date date not null,
  dimension text not null,
  key text not null,
  spend numeric not null default 0,
  impressions int not null default 0,
  link_clicks int not null default 0,
  meta_leads int not null default 0,
  primary key (date, dimension, key)
);

-- Conversions API: was bereits an Meta zurückgespielt wurde (keine Doppel-Events)
create table if not exists capi_events (
  event_id text primary key,  -- deterministisch: <event>:<lead/opp-id>
  lead_id text,
  event text not null,
  value numeric,
  sent_at timestamptz,
  antwort jsonb,
  fehler text
);

-- ---------------------------------------------------------------------------
-- Betrieb
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1) on conflict do nothing;

create table if not exists sync_runs (
  id bigserial primary key,
  quelle text not null,          -- close | meta | meta-creatives | capi | webhook
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  fehler text,
  details jsonb
);
create index if not exists sync_runs_quelle_idx on sync_runs (quelle, started_at desc);

create table if not exists sync_state (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
do $$
declare t text;
begin
  foreach t in array array['profiles','reps','leads','meetings','calls','opportunities','opp_status_changes','tasks','payments',
                           'meta_ads','meta_insights','meta_breakdowns','capi_events','settings','sync_runs','sync_state'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Eigenes Profil lesen
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for select to authenticated using (id = auth.uid() or app_rolle() = 'admin');

-- Lesen: admin/management alles, marketing Meta + Leads, rep nur eigene Leads und Aktivitäten
do $$
declare t text;
begin
  foreach t in array array['reps','settings','sync_runs'] loop
    execute format('drop policy if exists lesen on %I', t);
    execute format('create policy lesen on %I for select to authenticated using (app_rolle() is not null)', t);
  end loop;
  foreach t in array array['meta_ads','meta_insights','meta_breakdowns'] loop
    execute format('drop policy if exists lesen on %I', t);
    execute format('create policy lesen on %I for select to authenticated using (app_rolle() in (''admin'',''management'',''marketing''))', t);
  end loop;
end $$;

drop policy if exists lesen on leads;
create policy lesen on leads for select to authenticated using (
  app_rolle() in ('admin','management','marketing') or setter_id = app_rep_id() or closer_id = app_rep_id());

do $$
declare t text;
begin
  foreach t in array array['meetings','calls','opportunities','tasks'] loop
    execute format('drop policy if exists lesen on %I', t);
    execute format('create policy lesen on %I for select to authenticated using (
      app_rolle() in (''admin'',''management'',''marketing'') or user_id = app_rep_id()
      or exists (select 1 from leads l where l.id = lead_id and (l.setter_id = app_rep_id() or l.closer_id = app_rep_id())))', t);
  end loop;
end $$;

drop policy if exists lesen on payments;
create policy lesen on payments for select to authenticated using (app_rolle() in ('admin','management'));

-- Schreiben nur Admin (Einstellungen); alles andere schreibt der Server mit Service-Role
drop policy if exists admin_schreiben on settings;
create policy admin_schreiben on settings for update to authenticated using (app_rolle() = 'admin');

-- ---------------------------------------------------------------------------
-- Ersten Admin anlegen: nach dem ersten Login (oder per scripts/admin-anlegen.mjs)
-- update profiles set rolle = 'admin' where email = 'DEINE@MAIL.DE';
