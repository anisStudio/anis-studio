-- F2.4.15C — Replace legacy authenticated-admin RLS with public.is_admin().
--
-- Prepared only. Apply later, while live pg_policies still matches the
-- approved F2.4.15C-1 inventory.
--
-- Changes exactly 36 administrator policies.
-- Does not change the six public/anon policies, public.admin_users,
-- public.is_admin(), the public SECURITY DEFINER RPCs, or storage.objects.
--
-- Supabase runs this file in one transaction. RAISE EXCEPTION aborts that
-- transaction, so a failed preflight or final assertion restores the previous
-- policies. Target drops do not use IF EXISTS.

-- ---------------------------------------------------------------------------
-- Session-local helpers. Dropped at the end of this file.
-- ---------------------------------------------------------------------------

create function pg_temp.f2415c_norm(p_expr text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
  inner_expr text;
  depth int;
  i int;
begin
  if p_expr is null or btrim(p_expr) = '' then
    return null;
  end if;

  v := lower(btrim(p_expr));
  v := regexp_replace(v, '\s+', '', 'g');
  v := replace(v, '::text', '');
  v := replace(v, 'public.', '');

  loop
    exit when length(v) < 2 or left(v, 1) <> '(' or right(v, 1) <> ')';

    inner_expr := substring(v from 2 for length(v) - 2);
    depth := 0;

    for i in 1..length(inner_expr) loop
      if substring(inner_expr from i for 1) = '(' then
        depth := depth + 1;
      elsif substring(inner_expr from i for 1) = ')' then
        depth := depth - 1;
        exit when depth < 0;
      end if;
    end loop;

    exit when depth <> 0;
    v := inner_expr;
  end loop;

  return v;
end;
$$;

-- Strip the is_admin() call, AND, and parentheses. The remainder is the
-- row predicate that must survive (empty, id=1, or status='rejected').
create function pg_temp.f2415c_admin_remainder(p_expr text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  v := pg_temp.f2415c_norm(p_expr);
  -- public. was already stripped. Another schema's is_admin() must not pass.
  if v is null or position('.is_admin()' in v) > 0 or position('is_admin()' in v) = 0 then
    return null;
  end if;

  v := replace(v, 'is_admin()', '');
  v := replace(v, 'and', '');
  v := replace(v, '(', '');
  v := replace(v, ')', '');
  return v;
end;
$$;

create function pg_temp.f2415c_require_tokens(p_expr text, p_needles text[])
returns void
language plpgsql
as $$
declare
  v text;
  needle text;
begin
  v := pg_temp.f2415c_norm(p_expr);
  if v is null or v = 'true' then
    raise exception
      'F2.4.15C: protected public expression missing or widened to true (actual %)',
      coalesce(p_expr, '<null>');
  end if;

  foreach needle in array p_needles loop
    if position(needle in v) = 0 then
      raise exception
        'F2.4.15C: protected public expression missing "%" (normalized %)',
        needle,
        v;
    end if;
  end loop;
end;
$$;

create function pg_temp.f2415c_assert_public()
returns void
language plpgsql
as $$
declare
  live_cmd text;
  live_roles name[];
  live_permissive text;
  live_qual text;
  live_check text;
begin
  select p.cmd, p.roles, p.permissive, p.qual, p.with_check
    into live_cmd, live_roles, live_permissive, live_qual, live_check
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'projects'
    and p.policyname = 'projects_anon_insert';

  if live_cmd is distinct from 'INSERT'
    or live_permissive is distinct from 'PERMISSIVE'
    or live_roles is distinct from array['anon']::name[]
    or pg_temp.f2415c_norm(live_qual) is not null
  then
    raise exception 'F2.4.15C: projects_anon_insert drifted';
  end if;

  perform pg_temp.f2415c_require_tokens(
    live_check,
    array[
      'status=''inquiry''',
      'titleisnotnull',
      'notes',
      '<10000'
    ]
  );

  select p.cmd, p.roles, p.permissive, p.qual, p.with_check
    into live_cmd, live_roles, live_permissive, live_qual, live_check
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'project_files'
    and p.policyname = 'project_files_anon_insert';

  if live_cmd is distinct from 'INSERT'
    or live_permissive is distinct from 'PERMISSIVE'
    or live_roles is distinct from array['anon']::name[]
    or pg_temp.f2415c_norm(live_qual) is not null
  then
    raise exception 'F2.4.15C: project_files_anon_insert drifted';
  end if;

  perform pg_temp.f2415c_require_tokens(
    live_check,
    array[
      'storage_bucket=''project-files''',
      'original_nameisnotnull',
      'project_idisnotnull',
      '<500'
    ]
  );

  select p.cmd, p.roles, p.permissive, p.qual, p.with_check
    into live_cmd, live_roles, live_permissive, live_qual, live_check
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'lrc_inquiries'
    and p.policyname = 'Anyone can submit inquiries';

  if live_cmd is distinct from 'INSERT'
    or live_permissive is distinct from 'PERMISSIVE'
    or live_roles is distinct from array['anon']::name[]
    or pg_temp.f2415c_norm(live_qual) is not null
    or pg_temp.f2415c_norm(live_check) is distinct from 'true'
  then
    raise exception 'F2.4.15C: "Anyone can submit inquiries" drifted';
  end if;

  select p.cmd, p.roles, p.permissive, p.qual, p.with_check
    into live_cmd, live_roles, live_permissive, live_qual, live_check
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'settings'
    and p.policyname = 'settings_anon_select';

  if live_cmd is distinct from 'SELECT'
    or live_permissive is distinct from 'PERMISSIVE'
    or live_roles is distinct from array['anon']::name[]
    or pg_temp.f2415c_norm(live_qual) is distinct from 'id=1'
    or pg_temp.f2415c_norm(live_check) is not null
  then
    raise exception 'F2.4.15C: settings_anon_select drifted';
  end if;

  select p.cmd, p.roles, p.permissive, p.qual, p.with_check
    into live_cmd, live_roles, live_permissive, live_qual, live_check
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'portfolio_items'
    and p.policyname = 'portfolio_items_anon_select_visible';

  if live_cmd is distinct from 'SELECT'
    or live_permissive is distinct from 'PERMISSIVE'
    or live_roles is distinct from array['anon']::name[]
    or pg_temp.f2415c_norm(live_qual) is distinct from 'is_visible=true'
    or pg_temp.f2415c_norm(live_check) is not null
  then
    raise exception 'F2.4.15C: portfolio_items_anon_select_visible drifted';
  end if;

  select p.cmd, p.roles, p.permissive, p.qual, p.with_check
    into live_cmd, live_roles, live_permissive, live_qual, live_check
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'testimonial_submissions'
    and p.policyname = 'testimonial_submissions_public_insert';

  if live_cmd is distinct from 'INSERT'
    or live_permissive is distinct from 'PERMISSIVE'
    or cardinality(live_roles) is distinct from 2
    or not ('anon' = any(live_roles) and 'authenticated' = any(live_roles))
    or pg_temp.f2415c_norm(live_qual) is not null
  then
    raise exception 'F2.4.15C: testimonial_submissions_public_insert drifted';
  end if;

  perform pg_temp.f2415c_require_tokens(
    live_check,
    array[
      'status=''pending''',
      'consent_public=true',
      'original_text',
      'submitted_name',
      'email',
      '''general''',
      '''interiors''',
      '''lrc''',
      '''webatelier'''
    ]
  );
end;
$$;

create function pg_temp.f2415c_assert_admin(p_after boolean)
returns void
language plpgsql
as $$
declare
  exp record;
  live_cmd text;
  live_roles name[];
  live_permissive text;
  live_qual text;
  live_check text;
  v_seen int := 0;
  v_qual text;
  v_check text;
begin
  for exp in
    select *
    from (
      values
        ('clients', 'clients_authenticated_select', 'SELECT', 'using_true'),
        ('clients', 'clients_authenticated_insert', 'INSERT', 'check_true'),
        ('clients', 'clients_authenticated_update', 'UPDATE', 'both_true'),
        ('carpenters', 'carpenters_authenticated_select', 'SELECT', 'using_true'),
        ('carpenters', 'carpenters_authenticated_insert', 'INSERT', 'check_true'),
        ('carpenters', 'carpenters_authenticated_update', 'UPDATE', 'both_true'),
        ('projects', 'projects_authenticated_select', 'SELECT', 'using_true'),
        ('projects', 'projects_authenticated_insert', 'INSERT', 'check_true'),
        ('projects', 'projects_authenticated_update', 'UPDATE', 'both_true'),
        ('projects', 'projects_authenticated_delete', 'DELETE', 'using_true'),
        ('project_files', 'project_files_authenticated_select', 'SELECT', 'using_true'),
        ('project_files', 'project_files_authenticated_insert', 'INSERT', 'check_true'),
        ('project_files', 'project_files_authenticated_delete', 'DELETE', 'using_true'),
        ('vr_scenes', 'vr_scenes_authenticated_select', 'SELECT', 'using_true'),
        ('vr_scenes', 'vr_scenes_authenticated_insert', 'INSERT', 'check_true'),
        ('vr_scenes', 'vr_scenes_authenticated_update', 'UPDATE', 'both_true'),
        ('vr_scenes', 'vr_scenes_authenticated_delete', 'DELETE', 'using_true'),
        ('vr_appointments', 'vr_appointments_authenticated_select', 'SELECT', 'using_true'),
        ('vr_appointments', 'vr_appointments_authenticated_insert', 'INSERT', 'check_true'),
        ('vr_appointments', 'vr_appointments_authenticated_update', 'UPDATE', 'both_true'),
        ('vr_appointments', 'vr_appointments_authenticated_delete', 'DELETE', 'using_true'),
        ('lrc_inquiries', 'Authenticated users can read inquiries', 'SELECT', 'using_true'),
        ('lrc_inquiries', 'Authenticated users can update inquiries', 'UPDATE', 'lrc_update'),
        ('lrc_inquiries', 'Authenticated users can delete inquiries', 'DELETE', 'using_true'),
        ('settings', 'settings_authenticated_select', 'SELECT', 'using_true'),
        ('settings', 'settings_authenticated_update', 'UPDATE', 'settings_update'),
        ('portfolio_items', 'portfolio_items_authenticated_select_all', 'SELECT', 'using_true'),
        ('portfolio_items', 'portfolio_items_authenticated_insert', 'INSERT', 'check_true'),
        ('portfolio_items', 'portfolio_items_authenticated_update', 'UPDATE', 'both_true'),
        ('portfolio_items', 'portfolio_items_authenticated_delete', 'DELETE', 'using_true'),
        ('testimonial_submissions', 'testimonial_submissions_authenticated_select', 'SELECT', 'using_true'),
        ('testimonial_submissions', 'testimonial_submissions_authenticated_update', 'UPDATE', 'both_true'),
        ('testimonial_submissions', 'testimonial_submissions_authenticated_delete_rejected', 'DELETE', 'delete_rejected'),
        ('review_request_templates', 'review_request_templates_authenticated_select', 'SELECT', 'using_true'),
        ('review_request_templates', 'review_request_templates_authenticated_insert', 'INSERT', 'check_true'),
        ('review_request_templates', 'review_request_templates_authenticated_update', 'UPDATE', 'both_true')
    ) as catalog(tablename, policyname, cmd, kind)
  loop
    v_seen := v_seen + 1;

    select p.cmd, p.roles, p.permissive, p.qual, p.with_check
      into live_cmd, live_roles, live_permissive, live_qual, live_check
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = exp.tablename
      and p.policyname = exp.policyname;

    if not found
      or live_permissive is distinct from 'PERMISSIVE'
      or live_cmd is distinct from exp.cmd
      or live_roles is distinct from array['authenticated']::name[]
    then
      raise exception
        'F2.4.15C: admin policy %.% is missing or has an unexpected command/role',
        exp.tablename,
        exp.policyname;
    end if;

    if p_after then
      v_qual := pg_temp.f2415c_admin_remainder(live_qual);
      v_check := pg_temp.f2415c_admin_remainder(live_check);

      if exp.kind = 'using_true' then
        if v_qual is distinct from '' or pg_temp.f2415c_norm(live_check) is not null then
          raise exception
            'F2.4.15C: %.% did not become is_admin() using-only (qual %, check %)',
            exp.tablename, exp.policyname, live_qual, live_check;
        end if;
      elsif exp.kind = 'check_true' then
        if pg_temp.f2415c_norm(live_qual) is not null or v_check is distinct from '' then
          raise exception
            'F2.4.15C: %.% did not become is_admin() check-only (qual %, check %)',
            exp.tablename, exp.policyname, live_qual, live_check;
        end if;
      elsif exp.kind in ('both_true', 'lrc_update') then
        if v_qual is distinct from '' or v_check is distinct from '' then
          raise exception
            'F2.4.15C: %.% did not become is_admin() on both sides (qual %, check %)',
            exp.tablename, exp.policyname, live_qual, live_check;
        end if;
      elsif exp.kind = 'settings_update' then
        if v_qual is distinct from 'id=1' or v_check is distinct from 'id=1' then
          raise exception
            'F2.4.15C: settings_authenticated_update did not keep id = 1 with is_admin() (qual %, check %)',
            live_qual, live_check;
        end if;
      elsif exp.kind = 'delete_rejected' then
        if v_qual is distinct from 'status=''rejected'''
          or pg_temp.f2415c_norm(live_check) is not null
        then
          raise exception
            'F2.4.15C: delete-rejected policy did not keep status = rejected with is_admin() (qual %)',
            live_qual;
        end if;
      else
        raise exception 'F2.4.15C: unknown admin policy kind %', exp.kind;
      end if;
    else
      v_qual := pg_temp.f2415c_norm(live_qual);
      v_check := pg_temp.f2415c_norm(live_check);

      if exp.kind = 'using_true' then
        if v_qual is distinct from 'true' or v_check is not null then
          raise exception
            'F2.4.15C: %.% is not the legacy using(true) policy (qual %, check %)',
            exp.tablename, exp.policyname, live_qual, live_check;
        end if;
      elsif exp.kind = 'check_true' then
        if v_qual is not null or v_check is distinct from 'true' then
          raise exception
            'F2.4.15C: %.% is not the legacy check(true) policy (qual %, check %)',
            exp.tablename, exp.policyname, live_qual, live_check;
        end if;
      elsif exp.kind = 'both_true' then
        if v_qual is distinct from 'true' or v_check is distinct from 'true' then
          raise exception
            'F2.4.15C: %.% is not the legacy using/check(true) policy (qual %, check %)',
            exp.tablename, exp.policyname, live_qual, live_check;
        end if;
      elsif exp.kind = 'lrc_update' then
        if v_qual is distinct from 'true' or v_check is not null then
          raise exception
            'F2.4.15C: LRC update is not legacy using(true) with null with_check (qual %, check %)',
            live_qual, live_check;
        end if;
      elsif exp.kind = 'settings_update' then
        if v_qual is distinct from 'id=1' or v_check is distinct from 'id=1' then
          raise exception
            'F2.4.15C: settings_authenticated_update is not legacy id = 1 (qual %, check %)',
            live_qual, live_check;
        end if;
      elsif exp.kind = 'delete_rejected' then
        if v_qual is distinct from 'status=''rejected''' or v_check is not null then
          raise exception
            'F2.4.15C: delete-rejected policy is not legacy status = rejected (qual %, check %)',
            live_qual, live_check;
        end if;
      else
        raise exception 'F2.4.15C: unknown admin policy kind %', exp.kind;
      end if;
    end if;
  end loop;

  if v_seen <> 36 then
    raise exception 'F2.4.15C: expected to inspect 36 admin policies, saw %', v_seen;
  end if;
end;
$$;

create temporary table f2415c_storage_fp (
  fp text not null
);

insert into f2415c_storage_fp (fp)
select coalesce(
  md5(string_agg(
    format(
      '%s|%s|%s|%s|%s|%s|%s',
      tablename,
      policyname,
      permissive,
      roles::text,
      cmd,
      coalesce(qual, '<null>'),
      coalesce(with_check, '<null>')
    ),
    E'\n'
    order by tablename, policyname
  )),
  md5('')
)
from pg_policies
where schemaname = 'storage';

-- ---------------------------------------------------------------------------
-- Preflight. Nothing above has changed a policy.
-- ---------------------------------------------------------------------------

do $preflight$
declare
  v_count int;
  v_detail text;
begin
  select count(*)
    into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'is_admin'
    and p.pronargs = 0
    and p.prosecdef
    and pg_get_function_result(p.oid) = 'boolean';

  if v_count <> 1 then
    raise exception
      'F2.4.15C: expected exactly one public.is_admin() security-definer boolean function with zero arguments';
  end if;

  if to_regclass('public.admin_users') is null then
    raise exception 'F2.4.15C: public.admin_users does not exist';
  end if;

  select string_agg(expected_name, ', ' order by expected_name)
    into v_detail
  from (
    select unnest(array[
      'admin_users',
      'clients',
      'carpenters',
      'projects',
      'project_files',
      'vr_scenes',
      'vr_appointments',
      'lrc_inquiries',
      'settings',
      'portfolio_items',
      'testimonial_submissions',
      'review_request_templates'
    ]) as expected_name
  ) expected
  where not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = expected.expected_name
      and c.relrowsecurity
  );

  if v_detail is not null then
    raise exception 'F2.4.15C: RLS is not enabled on: %', v_detail;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_users'
  ) then
    raise exception 'F2.4.15C: public.admin_users must have zero policies';
  end if;

  with expected(tablename, policyname) as (
    values
      ('clients', 'clients_authenticated_select'),
      ('clients', 'clients_authenticated_insert'),
      ('clients', 'clients_authenticated_update'),
      ('carpenters', 'carpenters_authenticated_select'),
      ('carpenters', 'carpenters_authenticated_insert'),
      ('carpenters', 'carpenters_authenticated_update'),
      ('projects', 'projects_anon_insert'),
      ('projects', 'projects_authenticated_select'),
      ('projects', 'projects_authenticated_insert'),
      ('projects', 'projects_authenticated_update'),
      ('projects', 'projects_authenticated_delete'),
      ('project_files', 'project_files_anon_insert'),
      ('project_files', 'project_files_authenticated_select'),
      ('project_files', 'project_files_authenticated_insert'),
      ('project_files', 'project_files_authenticated_delete'),
      ('vr_scenes', 'vr_scenes_authenticated_select'),
      ('vr_scenes', 'vr_scenes_authenticated_insert'),
      ('vr_scenes', 'vr_scenes_authenticated_update'),
      ('vr_scenes', 'vr_scenes_authenticated_delete'),
      ('vr_appointments', 'vr_appointments_authenticated_select'),
      ('vr_appointments', 'vr_appointments_authenticated_insert'),
      ('vr_appointments', 'vr_appointments_authenticated_update'),
      ('vr_appointments', 'vr_appointments_authenticated_delete'),
      ('lrc_inquiries', 'Anyone can submit inquiries'),
      ('lrc_inquiries', 'Authenticated users can read inquiries'),
      ('lrc_inquiries', 'Authenticated users can update inquiries'),
      ('lrc_inquiries', 'Authenticated users can delete inquiries'),
      ('settings', 'settings_anon_select'),
      ('settings', 'settings_authenticated_select'),
      ('settings', 'settings_authenticated_update'),
      ('portfolio_items', 'portfolio_items_anon_select_visible'),
      ('portfolio_items', 'portfolio_items_authenticated_select_all'),
      ('portfolio_items', 'portfolio_items_authenticated_insert'),
      ('portfolio_items', 'portfolio_items_authenticated_update'),
      ('portfolio_items', 'portfolio_items_authenticated_delete'),
      ('testimonial_submissions', 'testimonial_submissions_public_insert'),
      ('testimonial_submissions', 'testimonial_submissions_authenticated_select'),
      ('testimonial_submissions', 'testimonial_submissions_authenticated_update'),
      ('testimonial_submissions', 'testimonial_submissions_authenticated_delete_rejected'),
      ('review_request_templates', 'review_request_templates_authenticated_select'),
      ('review_request_templates', 'review_request_templates_authenticated_insert'),
      ('review_request_templates', 'review_request_templates_authenticated_update')
  ),
  live as (
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'clients',
        'carpenters',
        'projects',
        'project_files',
        'vr_scenes',
        'vr_appointments',
        'lrc_inquiries',
        'settings',
        'portfolio_items',
        'testimonial_submissions',
        'review_request_templates'
      )
  ),
  extra as (
    select live.tablename || '.' || live.policyname as label
    from live
    except
    select expected.tablename || '.' || expected.policyname
    from expected
  ),
  missing as (
    select expected.tablename || '.' || expected.policyname as label
    from expected
    except
    select live.tablename || '.' || live.policyname
    from live
  )
  select
    (select count(*) from extra) + (select count(*) from missing),
    concat_ws(
      ' | ',
      (select 'extra: ' || string_agg(label, ', ' order by label) from extra),
      (select 'missing: ' || string_agg(label, ', ' order by label) from missing)
    )
  into v_count, v_detail;

  if v_count <> 0 then
    raise exception
      'F2.4.15C: target-table policy set drifted (%); %',
      v_count,
      v_detail;
  end if;

  perform pg_temp.f2415c_assert_public();
  perform pg_temp.f2415c_assert_admin(false);
end
$preflight$;

-- ---------------------------------------------------------------------------
-- Replace the 36 administrator policies. Names, commands, and role stay.
-- ---------------------------------------------------------------------------

drop policy clients_authenticated_select on public.clients;
drop policy clients_authenticated_insert on public.clients;
drop policy clients_authenticated_update on public.clients;

create policy clients_authenticated_select
  on public.clients
  for select
  to authenticated
  using (public.is_admin());

create policy clients_authenticated_insert
  on public.clients
  for insert
  to authenticated
  with check (public.is_admin());

create policy clients_authenticated_update
  on public.clients
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy carpenters_authenticated_select on public.carpenters;
drop policy carpenters_authenticated_insert on public.carpenters;
drop policy carpenters_authenticated_update on public.carpenters;

create policy carpenters_authenticated_select
  on public.carpenters
  for select
  to authenticated
  using (public.is_admin());

create policy carpenters_authenticated_insert
  on public.carpenters
  for insert
  to authenticated
  with check (public.is_admin());

create policy carpenters_authenticated_update
  on public.carpenters
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy projects_authenticated_select on public.projects;
drop policy projects_authenticated_insert on public.projects;
drop policy projects_authenticated_update on public.projects;
drop policy projects_authenticated_delete on public.projects;

create policy projects_authenticated_select
  on public.projects
  for select
  to authenticated
  using (public.is_admin());

create policy projects_authenticated_insert
  on public.projects
  for insert
  to authenticated
  with check (public.is_admin());

create policy projects_authenticated_update
  on public.projects
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy projects_authenticated_delete
  on public.projects
  for delete
  to authenticated
  using (public.is_admin());

drop policy project_files_authenticated_select on public.project_files;
drop policy project_files_authenticated_insert on public.project_files;
drop policy project_files_authenticated_delete on public.project_files;

create policy project_files_authenticated_select
  on public.project_files
  for select
  to authenticated
  using (public.is_admin());

create policy project_files_authenticated_insert
  on public.project_files
  for insert
  to authenticated
  with check (public.is_admin());

create policy project_files_authenticated_delete
  on public.project_files
  for delete
  to authenticated
  using (public.is_admin());

drop policy vr_scenes_authenticated_select on public.vr_scenes;
drop policy vr_scenes_authenticated_insert on public.vr_scenes;
drop policy vr_scenes_authenticated_update on public.vr_scenes;
drop policy vr_scenes_authenticated_delete on public.vr_scenes;

create policy vr_scenes_authenticated_select
  on public.vr_scenes
  for select
  to authenticated
  using (public.is_admin());

create policy vr_scenes_authenticated_insert
  on public.vr_scenes
  for insert
  to authenticated
  with check (public.is_admin());

create policy vr_scenes_authenticated_update
  on public.vr_scenes
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy vr_scenes_authenticated_delete
  on public.vr_scenes
  for delete
  to authenticated
  using (public.is_admin());

drop policy vr_appointments_authenticated_select on public.vr_appointments;
drop policy vr_appointments_authenticated_insert on public.vr_appointments;
drop policy vr_appointments_authenticated_update on public.vr_appointments;
drop policy vr_appointments_authenticated_delete on public.vr_appointments;

create policy vr_appointments_authenticated_select
  on public.vr_appointments
  for select
  to authenticated
  using (public.is_admin());

create policy vr_appointments_authenticated_insert
  on public.vr_appointments
  for insert
  to authenticated
  with check (public.is_admin());

create policy vr_appointments_authenticated_update
  on public.vr_appointments
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy vr_appointments_authenticated_delete
  on public.vr_appointments
  for delete
  to authenticated
  using (public.is_admin());

drop policy "Authenticated users can read inquiries" on public.lrc_inquiries;
drop policy "Authenticated users can update inquiries" on public.lrc_inquiries;
drop policy "Authenticated users can delete inquiries" on public.lrc_inquiries;

create policy "Authenticated users can read inquiries"
  on public.lrc_inquiries
  for select
  to authenticated
  using (public.is_admin());

create policy "Authenticated users can update inquiries"
  on public.lrc_inquiries
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Authenticated users can delete inquiries"
  on public.lrc_inquiries
  for delete
  to authenticated
  using (public.is_admin());

drop policy settings_authenticated_select on public.settings;
drop policy settings_authenticated_update on public.settings;

create policy settings_authenticated_select
  on public.settings
  for select
  to authenticated
  using (public.is_admin());

create policy settings_authenticated_update
  on public.settings
  for update
  to authenticated
  using (public.is_admin() and id = 1)
  with check (public.is_admin() and id = 1);

drop policy portfolio_items_authenticated_select_all on public.portfolio_items;
drop policy portfolio_items_authenticated_insert on public.portfolio_items;
drop policy portfolio_items_authenticated_update on public.portfolio_items;
drop policy portfolio_items_authenticated_delete on public.portfolio_items;

create policy portfolio_items_authenticated_select_all
  on public.portfolio_items
  for select
  to authenticated
  using (public.is_admin());

create policy portfolio_items_authenticated_insert
  on public.portfolio_items
  for insert
  to authenticated
  with check (public.is_admin());

create policy portfolio_items_authenticated_update
  on public.portfolio_items
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy portfolio_items_authenticated_delete
  on public.portfolio_items
  for delete
  to authenticated
  using (public.is_admin());

drop policy testimonial_submissions_authenticated_select on public.testimonial_submissions;
drop policy testimonial_submissions_authenticated_update on public.testimonial_submissions;
drop policy testimonial_submissions_authenticated_delete_rejected on public.testimonial_submissions;

create policy testimonial_submissions_authenticated_select
  on public.testimonial_submissions
  for select
  to authenticated
  using (public.is_admin());

create policy testimonial_submissions_authenticated_update
  on public.testimonial_submissions
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy testimonial_submissions_authenticated_delete_rejected
  on public.testimonial_submissions
  for delete
  to authenticated
  using (public.is_admin() and status = 'rejected');

drop policy review_request_templates_authenticated_select on public.review_request_templates;
drop policy review_request_templates_authenticated_insert on public.review_request_templates;
drop policy review_request_templates_authenticated_update on public.review_request_templates;

create policy review_request_templates_authenticated_select
  on public.review_request_templates
  for select
  to authenticated
  using (public.is_admin());

create policy review_request_templates_authenticated_insert
  on public.review_request_templates
  for insert
  to authenticated
  with check (public.is_admin());

create policy review_request_templates_authenticated_update
  on public.review_request_templates
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Final assertions, including that storage was not touched.
-- ---------------------------------------------------------------------------

do $post$
declare
  v_before text;
  v_after text;
  v_admin_policies int;
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_users'
  ) then
    raise exception 'F2.4.15C: public.admin_users gained a policy';
  end if;

  perform pg_temp.f2415c_assert_public();
  perform pg_temp.f2415c_assert_admin(true);

  select count(*)
    into v_admin_policies
  from pg_policies
  where schemaname = 'public'
    and 'authenticated' = any(roles)
    and tablename in (
      'clients',
      'carpenters',
      'projects',
      'project_files',
      'vr_scenes',
      'vr_appointments',
      'lrc_inquiries',
      'settings',
      'portfolio_items',
      'testimonial_submissions',
      'review_request_templates'
    )
    and policyname <> 'testimonial_submissions_public_insert';

  if v_admin_policies <> 36 then
    raise exception
      'F2.4.15C: expected 36 authenticated admin policies after migration, found %',
      v_admin_policies;
  end if;

  select fp into v_before from f2415c_storage_fp;

  select coalesce(
    md5(string_agg(
      format(
        '%s|%s|%s|%s|%s|%s|%s',
        tablename,
        policyname,
        permissive,
        roles::text,
        cmd,
        coalesce(qual, '<null>'),
        coalesce(with_check, '<null>')
      ),
      E'\n'
      order by tablename, policyname
    )),
    md5('')
  )
    into v_after
  from pg_policies
  where schemaname = 'storage';

  if v_before is distinct from v_after then
    raise exception 'F2.4.15C: storage policies changed during this migration';
  end if;
end
$post$;

drop function pg_temp.f2415c_assert_admin(boolean);
drop function pg_temp.f2415c_assert_public();
drop function pg_temp.f2415c_require_tokens(text, text[]);
drop function pg_temp.f2415c_admin_remainder(text);
drop function pg_temp.f2415c_norm(text);
drop table f2415c_storage_fp;
