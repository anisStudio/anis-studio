-- F2.4.15D — Restrict project-files Storage to anonymous upload and is_admin().
--
-- Prepared only. Apply later, while live storage.objects policies and the
-- project-files bucket still match the approved F2.4.15D-1 inventory.
--
-- Drops the six overlapping legacy storage.objects policies and creates four
-- replacements. Does not update storage.buckets, does not change public-table
-- RLS, and does not create a web-atelier bucket.
--
-- Supabase runs this file in one transaction. RAISE EXCEPTION aborts that
-- transaction, so a failed preflight or final assertion leaves the previous
-- Storage policies in place. Drops do not use IF EXISTS.

-- ---------------------------------------------------------------------------
-- Session-local helpers. Dropped at the end of this file.
-- ---------------------------------------------------------------------------

create function pg_temp.f2415d_norm(p_expr text)
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

-- True only for bucket_id = 'project-files' after harmless formatting is removed.
create function pg_temp.f2415d_bucket_only(p_expr text)
returns boolean
language plpgsql
immutable
as $$
begin
  return pg_temp.f2415d_norm(p_expr) is not distinct from $tok$bucket_id='project-files'$tok$;
end;
$$;

-- True only for bucket_id = 'project-files' AND public.is_admin(), in either
-- order. Any OR, NOT, extra predicate, or second is_admin() leaves a remainder.
create function pg_temp.f2415d_bucket_admin(p_expr text)
returns boolean
language plpgsql
immutable
as $$
declare
  v text;
  bucket_token constant text := $tok$bucket_id='project-files'$tok$;
  admin_token constant text := 'is_admin()';
begin
  v := pg_temp.f2415d_norm(p_expr);
  if v is null or position('.is_admin()' in v) > 0 then
    return false;
  end if;

  if (length(v) - length(replace(v, admin_token, ''))) <> length(admin_token) then
    return false;
  end if;

  if (length(v) - length(replace(v, bucket_token, ''))) <> length(bucket_token) then
    return false;
  end if;

  v := replace(v, bucket_token, '');
  v := replace(v, admin_token, '');
  v := replace(v, '(', '');
  v := replace(v, ')', '');
  v := replace(v, 'and', '');
  return v = '';
end;
$$;

-- True when the expression may grant project-files.
-- False only when normalization leaves exactly bucket_id='<literal>'
-- and that literal is a different bucket. Anything else fails closed.
create function pg_temp.f2415d_expr_grants(p_expr text)
returns boolean
language plpgsql
immutable
as $$
declare
  v text;
  bucket_name text;
begin
  v := pg_temp.f2415d_norm(p_expr);
  if v is null or v = 'true' then
    return true;
  end if;

  if v !~ $re$^bucket_id='[^']+'$re$ then
    return true;
  end if;

  bucket_name := substring(v from $re$^bucket_id='([^']+)'$re$);
  if bucket_name is null or bucket_name = '' or bucket_name = 'project-files' then
    return true;
  end if;

  return false;
end;
$$;

create function pg_temp.f2415d_policy_grants(
  p_cmd text,
  p_qual text,
  p_check text
)
returns boolean
language plpgsql
immutable
as $$
begin
  if p_cmd in ('SELECT', 'DELETE') then
    return pg_temp.f2415d_expr_grants(p_qual);
  elsif p_cmd = 'INSERT' then
    return pg_temp.f2415d_expr_grants(p_check);
  elsif p_cmd in ('UPDATE', 'ALL') then
    return pg_temp.f2415d_expr_grants(p_qual)
      or pg_temp.f2415d_expr_grants(p_check);
  end if;

  return true;
end;
$$;

create function pg_temp.f2415d_same_roles(p_roles name[], p_expected name[])
returns boolean
language sql
immutable
as $$
  select p_roles @> p_expected
    and p_expected @> p_roles
    and cardinality(p_roles) = cardinality(p_expected);
$$;

-- Same MIME set: every expected type is present, nothing extra is present,
-- and the live array has no duplicate entries. Order is ignored.
create function pg_temp.f2415d_same_mime_set(p_live text[], p_expected text[])
returns boolean
language sql
immutable
as $$
  select p_live is not null
    and p_expected is not null
    and (
      select count(*) from unnest(p_live) as m
    ) = (
      select count(distinct m) from unnest(p_live) as m
    )
    and not exists (
      select unnest(p_expected)
      except
      select unnest(p_live)
    )
    and not exists (
      select unnest(p_live)
      except
      select unnest(p_expected)
    );
$$;

create function pg_temp.f2415d_fingerprint(p_kind text)
returns text
language plpgsql
stable
as $$
declare
  v_fp text;
begin
  if p_kind = 'public' then
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
      into v_fp
    from pg_policies
    where schemaname = 'public';
  elsif p_kind = 'other_storage' then
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
      into v_fp
    from pg_policies
    where schemaname = 'storage'
      and not (
        tablename = 'objects'
        and pg_temp.f2415d_policy_grants(cmd, qual, with_check)
      );
  else
    raise exception 'F2.4.15D: unknown fingerprint kind %', p_kind;
  end if;

  return v_fp;
end;
$$;

create temporary table f2415d_fp (
  kind text primary key,
  fp text not null
);

insert into f2415d_fp (kind, fp)
values
  ('public', pg_temp.f2415d_fingerprint('public')),
  ('other_storage', pg_temp.f2415d_fingerprint('other_storage'));

-- ---------------------------------------------------------------------------
-- Preflight. Nothing above has changed a policy or the bucket.
-- ---------------------------------------------------------------------------

do $preflight$
declare
  v_public boolean;
  v_limit bigint;
  v_mimes text[];
  v_expected_mimes text[] := array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/svg+xml',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'
  ];
  v_search_path text;
  exp record;
  live_cmd text;
  live_roles name[];
  live_permissive text;
  live_qual text;
  live_check text;
  v_seen int := 0;
  v_extra text;
begin
  if to_regclass('storage.objects') is null then
    raise exception 'F2.4.15D: storage.objects does not exist';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage'
      and c.relname = 'objects'
      and c.relkind = 'r'
      and c.relrowsecurity
  ) then
    raise exception 'F2.4.15D: storage.objects does not have row level security enabled';
  end if;

  select b.public, b.file_size_limit, b.allowed_mime_types
    into v_public, v_limit, v_mimes
  from storage.buckets b
  where b.id = 'project-files'
    and b.name = 'project-files';

  if not found
    or v_public is distinct from false
    or v_limit is distinct from 20971520
    or not pg_temp.f2415d_same_mime_set(v_mimes, v_expected_mimes)
  then
    raise exception
      'F2.4.15D: project-files bucket missing or configuration drifted (public %, limit %, mimes %)',
      v_public,
      v_limit,
      v_mimes;
  end if;

  if (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_admin'
      and p.pronargs = 0
      and p.prosecdef
      and pg_get_function_result(p.oid) = 'boolean'
  ) <> 1 then
    raise exception
      'F2.4.15D: expected exactly one public.is_admin() security-definer boolean function with zero arguments';
  end if;

  select split_part(cfg, '=', 2)
    into v_search_path
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral unnest(coalesce(p.proconfig, array[]::text[])) as cfg
  where n.nspname = 'public'
    and p.proname = 'is_admin'
    and p.pronargs = 0
    and split_part(cfg, '=', 1) = 'search_path';

  if v_search_path is null or btrim(v_search_path, '"') <> '' then
    raise exception
      'F2.4.15D: public.is_admin() does not have an empty search_path';
  end if;

  if not has_function_privilege('authenticated', 'public.is_admin()', 'execute') then
    raise exception
      'F2.4.15D: authenticated cannot execute public.is_admin()';
  end if;

  for exp in
    select *
    from (
      values
        ('project_files_anon_insert', 'INSERT', 'anon'),
        ('project_files_anon_select', 'SELECT', 'anon'),
        ('project_files_authenticated_delete', 'DELETE', 'authenticated'),
        ('project_files_authenticated_select', 'SELECT', 'authenticated'),
        ('project_files_insert', 'INSERT', 'both'),
        ('project_files_select', 'SELECT', 'both')
    ) as catalog(policyname, cmd, role_kind)
  loop
    v_seen := v_seen + 1;

    select p.cmd, p.roles, p.permissive, p.qual, p.with_check
      into live_cmd, live_roles, live_permissive, live_qual, live_check
    from pg_policies p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.policyname = exp.policyname;

    if not found
      or live_permissive is distinct from 'PERMISSIVE'
      or live_cmd is distinct from exp.cmd
    then
      raise exception
        'F2.4.15D: legacy policy % is missing or has an unexpected command',
        exp.policyname;
    end if;

    if exp.role_kind = 'anon' then
      if not pg_temp.f2415d_same_roles(live_roles, array['anon']::name[]) then
        raise exception 'F2.4.15D: legacy policy % roles drifted', exp.policyname;
      end if;
    elsif exp.role_kind = 'authenticated' then
      if not pg_temp.f2415d_same_roles(live_roles, array['authenticated']::name[]) then
        raise exception 'F2.4.15D: legacy policy % roles drifted', exp.policyname;
      end if;
    elsif exp.role_kind = 'both' then
      if not pg_temp.f2415d_same_roles(live_roles, array['anon', 'authenticated']::name[]) then
        raise exception 'F2.4.15D: legacy policy % roles drifted', exp.policyname;
      end if;
    else
      raise exception 'F2.4.15D: unknown legacy role kind %', exp.role_kind;
    end if;

    if exp.cmd = 'INSERT' then
      if pg_temp.f2415d_norm(live_qual) is not null
        or not pg_temp.f2415d_bucket_only(live_check)
      then
        raise exception
          'F2.4.15D: legacy policy % is not bucket-only INSERT (qual %, check %)',
          exp.policyname,
          live_qual,
          live_check;
      end if;
    elsif exp.cmd in ('SELECT', 'DELETE') then
      if not pg_temp.f2415d_bucket_only(live_qual)
        or pg_temp.f2415d_norm(live_check) is not null
      then
        raise exception
          'F2.4.15D: legacy policy % is not bucket-only % (qual %, check %)',
          exp.policyname,
          exp.cmd,
          live_qual,
          live_check;
      end if;
    else
      raise exception 'F2.4.15D: unexpected legacy command %', exp.cmd;
    end if;
  end loop;

  if v_seen <> 6 then
    raise exception 'F2.4.15D: expected to inspect 6 legacy policies, saw %', v_seen;
  end if;

  select string_agg(format('%s (%s)', p.policyname, p.cmd), ', ' order by p.policyname)
    into v_extra
  from pg_policies p
  where p.schemaname = 'storage'
    and p.tablename = 'objects'
    and p.policyname <> all (array[
      'project_files_anon_insert',
      'project_files_anon_select',
      'project_files_authenticated_delete',
      'project_files_authenticated_select',
      'project_files_insert',
      'project_files_select'
    ])
    and pg_temp.f2415d_policy_grants(p.cmd, p.qual, p.with_check);

  if v_extra is not null then
    raise exception
      'F2.4.15D: unexpected storage.objects policy grants project-files access: %',
      v_extra;
  end if;

  if exists (
    select 1
    from pg_policies p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.cmd in ('UPDATE', 'ALL')
      and pg_temp.f2415d_policy_grants(p.cmd, p.qual, p.with_check)
  ) then
    raise exception 'F2.4.15D: a project-files UPDATE policy exists';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- Replace the six legacy policies. No IF EXISTS.
-- ---------------------------------------------------------------------------

drop policy project_files_anon_insert on storage.objects;
drop policy project_files_anon_select on storage.objects;
drop policy project_files_authenticated_delete on storage.objects;
drop policy project_files_authenticated_select on storage.objects;
drop policy project_files_insert on storage.objects;
drop policy project_files_select on storage.objects;

create policy project_files_anon_insert
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'project-files');

create policy project_files_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'project-files' and public.is_admin());

create policy project_files_admin_select
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'project-files' and public.is_admin());

create policy project_files_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'project-files' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Final assertions. A failure here rolls the policy changes back.
-- ---------------------------------------------------------------------------

do $post$
declare
  v_public boolean;
  v_limit bigint;
  v_mimes text[];
  v_expected_mimes text[] := array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/svg+xml',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'
  ];
  exp record;
  live_cmd text;
  live_roles name[];
  live_permissive text;
  live_qual text;
  live_check text;
  v_seen int := 0;
  v_extra text;
  v_before text;
  v_after text;
begin
  for exp in
    select *
    from (
      values
        ('project_files_anon_insert', 'INSERT', 'anon', 'bucket'),
        ('project_files_admin_insert', 'INSERT', 'authenticated', 'admin'),
        ('project_files_admin_select', 'SELECT', 'authenticated', 'admin'),
        ('project_files_admin_delete', 'DELETE', 'authenticated', 'admin')
    ) as catalog(policyname, cmd, role_name, shape)
  loop
    v_seen := v_seen + 1;

    select p.cmd, p.roles, p.permissive, p.qual, p.with_check
      into live_cmd, live_roles, live_permissive, live_qual, live_check
    from pg_policies p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.policyname = exp.policyname;

    if not found
      or live_permissive is distinct from 'PERMISSIVE'
      or live_cmd is distinct from exp.cmd
      or not pg_temp.f2415d_same_roles(live_roles, array[exp.role_name]::name[])
    then
      raise exception
        'F2.4.15D: target policy % is missing or has an unexpected command/role',
        exp.policyname;
    end if;

    if exp.cmd = 'INSERT' and exp.shape = 'bucket' then
      if pg_temp.f2415d_norm(live_qual) is not null
        or not pg_temp.f2415d_bucket_only(live_check)
      then
        raise exception
          'F2.4.15D: project_files_anon_insert is not bucket-only INSERT (qual %, check %)',
          live_qual,
          live_check;
      end if;
    elsif exp.cmd = 'INSERT' and exp.shape = 'admin' then
      if pg_temp.f2415d_norm(live_qual) is not null
        or not pg_temp.f2415d_bucket_admin(live_check)
      then
        raise exception
          'F2.4.15D: project_files_admin_insert is not bucket AND is_admin() (qual %, check %)',
          live_qual,
          live_check;
      end if;
    elsif exp.cmd in ('SELECT', 'DELETE') and exp.shape = 'admin' then
      if not pg_temp.f2415d_bucket_admin(live_qual)
        or pg_temp.f2415d_norm(live_check) is not null
      then
        raise exception
          'F2.4.15D: % is not bucket AND is_admin() (qual %, check %)',
          exp.policyname,
          live_qual,
          live_check;
      end if;
    else
      raise exception 'F2.4.15D: unexpected target shape %/%', exp.policyname, exp.shape;
    end if;
  end loop;

  if v_seen <> 4 then
    raise exception 'F2.4.15D: expected to inspect 4 target policies, saw %', v_seen;
  end if;

  select string_agg(p.policyname, ', ' order by p.policyname)
    into v_extra
  from pg_policies p
  where p.schemaname = 'storage'
    and p.tablename = 'objects'
    and pg_temp.f2415d_policy_grants(p.cmd, p.qual, p.with_check)
    and p.policyname <> all (array[
      'project_files_anon_insert',
      'project_files_admin_insert',
      'project_files_admin_select',
      'project_files_admin_delete'
    ]);

  if v_extra is not null then
    raise exception
      'F2.4.15D: project-files access is not limited to the four target policies: %',
      v_extra;
  end if;

  if (
    select count(*)
    from pg_policies p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and pg_temp.f2415d_policy_grants(p.cmd, p.qual, p.with_check)
  ) <> 4 then
    raise exception 'F2.4.15D: expected exactly four project-files storage policies';
  end if;

  if exists (
    select 1
    from pg_policies p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.cmd in ('SELECT', 'ALL')
      and (p.roles && array['anon', 'public']::name[])
      and pg_temp.f2415d_policy_grants(p.cmd, p.qual, p.with_check)
  ) then
    raise exception 'F2.4.15D: a project-files policy still grants SELECT to anon or public';
  end if;

  if exists (
    select 1
    from pg_policies p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.cmd in ('DELETE', 'ALL')
      and (p.roles && array['anon', 'public']::name[])
      and pg_temp.f2415d_policy_grants(p.cmd, p.qual, p.with_check)
  ) then
    raise exception 'F2.4.15D: a project-files policy still grants DELETE to anon or public';
  end if;

  if exists (
    select 1
    from pg_policies p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.cmd in ('UPDATE', 'ALL')
      and pg_temp.f2415d_policy_grants(p.cmd, p.qual, p.with_check)
  ) then
    raise exception 'F2.4.15D: a project-files UPDATE policy exists after migration';
  end if;

  if exists (
    select 1
    from pg_policies p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and (p.roles && array['authenticated', 'public']::name[])
      and pg_temp.f2415d_policy_grants(p.cmd, p.qual, p.with_check)
      and not (
        (p.cmd = 'INSERT' and pg_temp.f2415d_bucket_admin(p.with_check))
        or (p.cmd in ('SELECT', 'DELETE') and pg_temp.f2415d_bucket_admin(p.qual))
      )
  ) then
    raise exception
      'F2.4.15D: an authenticated project-files policy does not require public.is_admin()';
  end if;

  select b.public, b.file_size_limit, b.allowed_mime_types
    into v_public, v_limit, v_mimes
  from storage.buckets b
  where b.id = 'project-files'
    and b.name = 'project-files';

  if v_public is distinct from false
    or v_limit is distinct from 20971520
    or not pg_temp.f2415d_same_mime_set(v_mimes, v_expected_mimes)
  then
    raise exception
      'F2.4.15D: project-files bucket configuration changed (public %, limit %, mimes %)',
      v_public,
      v_limit,
      v_mimes;
  end if;

  select fp into v_before from f2415d_fp where kind = 'public';
  v_after := pg_temp.f2415d_fingerprint('public');
  if v_before is distinct from v_after then
    raise exception 'F2.4.15D: public-table policies changed during this migration';
  end if;

  select fp into v_before from f2415d_fp where kind = 'other_storage';
  v_after := pg_temp.f2415d_fingerprint('other_storage');
  if v_before is distinct from v_after then
    raise exception 'F2.4.15D: a non-project-files storage policy changed during this migration';
  end if;
end
$post$;

drop function pg_temp.f2415d_fingerprint(text);
drop function pg_temp.f2415d_same_mime_set(text[], text[]);
drop function pg_temp.f2415d_same_roles(name[], name[]);
drop function pg_temp.f2415d_policy_grants(text, text, text);
drop function pg_temp.f2415d_expr_grants(text);
drop function pg_temp.f2415d_bucket_admin(text);
drop function pg_temp.f2415d_bucket_only(text);
drop function pg_temp.f2415d_norm(text);
drop table f2415d_fp;
