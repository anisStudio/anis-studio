-- F2.4.15A — Admin authorization foundation
--
-- Additive only. Does not alter existing tables, RLS policies, functions,
-- grants on pre-existing objects, storage, or application data.
--
-- Email is not an authorization key and is not stored.

-- ---------------------------------------------------------------------------
-- admin_users
-- Identity is auth.users.id. Deleting that auth user is refused while the
-- allowlist row still exists.
-- ---------------------------------------------------------------------------

create table public.admin_users (
  user_id uuid primary key
    references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Allowlist of Ani''s Studio administrators. Authorization key is auth.users.id only.';

comment on column public.admin_users.user_id is
  'Matches auth.uid() for an administrator. Not an email and not a role claim.';

alter table public.admin_users enable row level security;

-- Supabase default privileges grant new public tables to anon, authenticated,
-- and service_role. Take those grants away. RLS is enabled with no policies,
-- which already denies every non-owner. There is intentionally no INSERT,
-- UPDATE, DELETE, or SELECT policy, so the Data API cannot enroll or list admins.
-- Do not add a policy that calls is_admin(): that would recurse into this table.
revoke all on table public.admin_users from public;
revoke all on table public.admin_users from anon;
revoke all on table public.admin_users from authenticated;
revoke all on table public.admin_users from service_role;

-- ---------------------------------------------------------------------------
-- is_admin()
-- SECURITY DEFINER, owned by the migration role (the table owner), so it can
-- read admin_users without a SELECT grant and without an RLS policy.
-- search_path is empty; every reference below is schema-qualified.
-- auth.uid() is null for anonymous and SQL-editor sessions, so EXISTS is false.
-- ---------------------------------------------------------------------------

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

comment on function public.is_admin() is
  'True only when auth.uid() is a row in public.admin_users. False when auth.uid() is null.';

-- PostgreSQL grants EXECUTE to PUBLIC on new functions, and Supabase also
-- grants EXECUTE to anon, authenticated, and service_role. Leave EXECUTE
-- only for authenticated. Anon must not probe the function.
revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
revoke all on function public.is_admin() from authenticated;
revoke all on function public.is_admin() from service_role;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Bootstrap
-- Isolated on purpose. Fails closed if auth.users is no longer exactly one
-- row, or if the verified UUID is not that user.
-- Runs as the migration owner, which bypasses RLS on admin_users. This is the
-- only insert path. Authenticated users have no insert grant and no policy.
-- ---------------------------------------------------------------------------

do $$
declare
  v_admin_id uuid := 'eece9210-2fc5-42d5-aa02-e47a7cfaf160';
begin
  if (select count(*) from auth.users) <> 1 then
    raise exception
      'F2.4.15A: expected exactly one auth.users row before bootstrap, found %',
      (select count(*) from auth.users);
  end if;

  if not exists (
    select 1
    from auth.users
    where id = v_admin_id
  ) then
    raise exception
      'F2.4.15A: verified admin UUID is not present in auth.users';
  end if;

  insert into public.admin_users (user_id)
  values (v_admin_id);

  if (select count(*) from public.admin_users) <> 1 then
    raise exception
      'F2.4.15A: expected exactly one admin_users row after bootstrap';
  end if;
end
$$;
