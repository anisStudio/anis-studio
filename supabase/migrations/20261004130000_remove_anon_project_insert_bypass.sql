-- F2.4.15F — Remove obsolete direct anonymous INSERT on projects and
-- project_files now that create_public_inquiry_project and
-- create_public_project_file are production-verified.
--
-- Does not change Storage policies, project-files bucket settings,
-- project_upload_grants, the public inquiry RPCs, admin RLS, or is_admin().
-- Anonymous Storage INSERT on project-files remains required for uploads.

-- ---------------------------------------------------------------------------
-- Preflight. Abort if the expected policies or RPCs are missing.
-- ---------------------------------------------------------------------------

do $preflight$
declare
  missing_policies text;
begin
  if to_regprocedure(
    'public.create_public_inquiry_project(text, text, uuid, uuid, boolean, boolean, text, text, text, numeric, numeric, text)'
  ) is null then
    raise exception
      'F2.4.15F: public.create_public_inquiry_project(...) is missing';
  end if;

  if to_regprocedure(
    'public.create_public_project_file(uuid, text, text, text, text, bigint, text)'
  ) is null then
    raise exception
      'F2.4.15F: public.create_public_project_file(...) is missing';
  end if;

  select string_agg(expected.label, ', ' order by expected.label)
    into missing_policies
  from (
    values
      ('projects.projects_anon_insert'),
      ('project_files.project_files_anon_insert')
  ) as expected(label)
  where not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and (
        (expected.label = 'projects.projects_anon_insert'
          and p.tablename = 'projects'
          and p.policyname = 'projects_anon_insert')
        or
        (expected.label = 'project_files.project_files_anon_insert'
          and p.tablename = 'project_files'
          and p.policyname = 'project_files_anon_insert')
      )
  );

  if missing_policies is not null then
    raise exception
      'F2.4.15F: expected anon INSERT policy missing before drop: %',
      missing_policies;
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- Drop only the two obsolete direct anonymous INSERT policies.
-- ---------------------------------------------------------------------------

drop policy if exists projects_anon_insert on public.projects;
drop policy if exists project_files_anon_insert on public.project_files;

-- ---------------------------------------------------------------------------
-- Postflight. Abort if a drop failed or an RPC disappeared.
-- ---------------------------------------------------------------------------

do $postflight$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'projects'
      and policyname = 'projects_anon_insert'
  ) then
    raise exception 'F2.4.15F: projects_anon_insert still exists after drop';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'project_files'
      and policyname = 'project_files_anon_insert'
  ) then
    raise exception
      'F2.4.15F: project_files_anon_insert still exists after drop';
  end if;

  if to_regprocedure(
    'public.create_public_inquiry_project(text, text, uuid, uuid, boolean, boolean, text, text, text, numeric, numeric, text)'
  ) is null then
    raise exception
      'F2.4.15F: public.create_public_inquiry_project(...) disappeared';
  end if;

  if to_regprocedure(
    'public.create_public_project_file(uuid, text, text, text, text, bigint, text)'
  ) is null then
    raise exception
      'F2.4.15F: public.create_public_project_file(...) disappeared';
  end if;
end
$postflight$;
