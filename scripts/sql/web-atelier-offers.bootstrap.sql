-- LOCAL TEST BOOTSTRAP ONLY. Runs inside a throwaway Docker postgres:17 container.
-- Never run against a real Supabase project. Emulates just enough of Supabase:
-- API roles, the `extensions` schema with pgcrypto, auth.uid(), default
-- privileges for new public objects (so the migration's REVOKEs are proven
-- to be necessary), and a helper schema `t` for assertions.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema extensions;
create extension pgcrypto schema extensions;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Same defaults Supabase applies to objects created by postgres in public.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- The single verified admin required by the admin foundation migration.
insert into auth.users (id) values ('eece9210-2fc5-42d5-aa02-e47a7cfaf160');

create schema t;
grant usage on schema t to public;

create function t.ok(p_cond boolean, p_name text) returns void
language plpgsql as $$
begin
  if p_cond is not true then
    raise exception 'FAIL: %', p_name;
  end if;
  raise notice 'PASS: %', p_name;
end;
$$;

create function t.fails(p_sql text, p_pattern text, p_name text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ~ p_pattern then
      raise notice 'PASS: %', p_name;
      return;
    end if;
    raise exception 'FAIL: % (wrong error: %)', p_name, sqlerrm;
  end;
  raise exception 'FAIL: % (statement succeeded but must be refused)', p_name;
end;
$$;

create function t.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', false);
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

create function t.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', false);
  perform set_config('request.jwt.claim.sub', 'eece9210-2fc5-42d5-aa02-e47a7cfaf160', false);
  perform set_config('role', 'authenticated', false);
end;
$$;

create function t.as_user() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', false);
  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
  perform set_config('role', 'authenticated', false);
end;
$$;

create function t.as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', false);
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('role', 'anon', false);
end;
$$;

create function t.as_service() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', false);
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('role', 'service_role', false);
end;
$$;

grant execute on all functions in schema t to public;
