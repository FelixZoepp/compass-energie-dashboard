-- Separater Lauf nötig: neue Enum-Werte sind erst nach Commit nutzbar.
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for select to authenticated using (id = auth.uid() or app_rolle() in ('superadmin','admin'));

drop policy if exists lesen on leads;
create policy lesen on leads for select to authenticated using (
  app_rolle() in ('superadmin','admin','management','marketing') or setter_id = app_rep_id() or closer_id = app_rep_id());

do $$
declare t text;
begin
  foreach t in array array['meta_ads','meta_insights','meta_breakdowns'] loop
    execute format('drop policy if exists lesen on %I', t);
    execute format('create policy lesen on %I for select to authenticated using (app_rolle() in (''superadmin'',''admin'',''management'',''marketing''))', t);
  end loop;
  foreach t in array array['meetings','calls','opportunities','tasks'] loop
    execute format('drop policy if exists lesen on %I', t);
    execute format('create policy lesen on %I for select to authenticated using (
      app_rolle() in (''superadmin'',''admin'',''management'',''marketing'') or user_id = app_rep_id()
      or exists (select 1 from leads l where l.id = lead_id and (l.setter_id = app_rep_id() or l.closer_id = app_rep_id())))', t);
  end loop;
end $$;

drop policy if exists lesen on payments;
create policy lesen on payments for select to authenticated using (app_rolle() in ('superadmin','admin','management'));
drop policy if exists admin_schreiben on settings;
create policy admin_schreiben on settings for update to authenticated using (app_rolle() in ('superadmin','admin'));
