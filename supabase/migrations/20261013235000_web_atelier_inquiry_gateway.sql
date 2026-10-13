-- F2.4.16B2-B1 — Web Atelier submission database gateway.
--
-- Additive. Does not edit 20261013224500. Does not create offers, projects,
-- invoices, payments, drafts, Storage buckets, or Edge Functions. Does not
-- change Interijeri objects or web_atelier_public_visible.
--
-- Ownership inspected from 20261013224500, not by altering it:
-- create_public_web_atelier_inquiry is SECURITY DEFINER, search_path empty,
-- and has no SET ROLE. The migration role that applies these files owns it.
-- On Supabase that role is postgres. This migration revokes API EXECUTE on
-- that function and grants EXECUTE only to the same owning role so the
-- SECURITY DEFINER wrapper below can call it. postgres keeps no extra
-- table privilege by that grant.
--
-- Trust boundary:
-- These functions do not verify CAPTCHA and do not see the Turnstile token
-- or the HMAC pepper. The Edge function must HMAC-SHA256 the normalized
-- email (trimmed, lowercased) with the server-only pepper and must pass
-- that hex digest as p_email_hash together with the same email. This
-- database cannot recompute the HMAC and cannot prove that siteverify
-- happened. Edge must siteverify a Turnstile token before submit.
--
-- Intended Edge order, implemented later, not here:
-- 1. reserve_web_atelier_captcha_attempt(email_hash) before siteverify.
--    A rejected reservation must stop the request. Do not call siteverify.
-- 2. siteverify. Do not send remoteip. Do not trust client IP headers.
-- 3. On success, submit_web_atelier_inquiry. The same idempotency key and
--    the same canonical payload return the existing confirmation and do not
--    consume a submission quota.
-- 4. On Turnstile timeout-or-duplicate only, call
--    confirm_web_atelier_inquiry_retry with the same payload. That reads an
--    existing match. It does not insert, does not consume submission quota,
--    and returns only inquiry_id plus reference_code. If nothing matches,
--    the client is not trapped: they request a new token and submit again.
--    Do not call confirm for a fresh token or for any other siteverify error.
--
-- There is no IP bucket. X-Forwarded-For, CF-Connecting-IP, X-Real-IP, and
-- Sb-Forwarded-For are not identifiers.

-- ---------------------------------------------------------------------------
-- Preflight. Fail before any new object if B1 is missing or this gateway
-- was already applied. Do not create extensions or roles.
-- ---------------------------------------------------------------------------

do $preflight$
begin
  if to_regclass('public.web_atelier_inquiries') is null then
    raise exception 'F2.4.16B2-B1: public.web_atelier_inquiries is missing';
  end if;

  if to_regprocedure(
    'public.create_public_web_atelier_inquiry(uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text)'
  ) is null then
    raise exception 'F2.4.16B2-B1: public.create_public_web_atelier_inquiry(...) is missing';
  end if;

  if to_regprocedure('extensions.digest(text, text)') is null then
    raise exception 'F2.4.16B2-B1: extensions.digest(text, text) is missing';
  end if;

  if to_regclass('public.web_atelier_submission_buckets') is not null then
    raise exception 'F2.4.16B2-B1: public.web_atelier_submission_buckets already exists';
  end if;

  if to_regprocedure('public.reserve_web_atelier_captcha_attempt(text)') is not null
    or to_regprocedure('public.confirm_web_atelier_inquiry_retry(uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text)') is not null
    or to_regprocedure('public.submit_web_atelier_inquiry(text, uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text)') is not null
  then
    raise exception 'F2.4.16B2-B1: gateway function already exists';
  end if;

  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon')
    or not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated')
    or not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role')
  then
    raise exception 'F2.4.16B2-B1: anon, authenticated, or service_role is missing';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- Private counters. One row per kind, key, and UTC window.
-- Email keys are 64-char hex HMAC digests supplied by Edge. The global key
-- is the constant global. No email address, pepper, token, or IP is stored.
-- Retention is 2 days. Each committed reserve or new submission deletes at
-- most 100 older rows. A rejected transaction rolls its own delete back;
-- the next committed call continues. Active hour and day windows are newer
-- than 2 days, so cleanup cannot erase a counter that is still enforcing.
-- ---------------------------------------------------------------------------

create table public.web_atelier_submission_buckets (
  bucket_kind text not null,
  bucket_key text not null,
  window_start timestamptz not null,
  hit_count integer not null,
  constraint web_atelier_submission_buckets_pkey
    primary key (bucket_kind, bucket_key, window_start),
  constraint web_atelier_submission_buckets_count_bounds
    check (hit_count >= 1 and hit_count <= 200),
  constraint web_atelier_submission_buckets_kind_key
    check (
      (
        bucket_kind in (
          'captcha_global_hour',
          'submit_global_hour',
          'submit_global_day'
        )
        and bucket_key = 'global'
      )
      or (
        bucket_kind in (
          'captcha_email_hour',
          'submit_email_hour',
          'submit_email_day'
        )
        and bucket_key ~ '^[0-9a-f]{64}$'
      )
    )
);

comment on table public.web_atelier_submission_buckets is
  'Private Web Atelier rate counters. RLS on, no API table privileges. Retention 2 days. Email keys are HMAC digests, never addresses.';

alter table public.web_atelier_submission_buckets enable row level security;

revoke all on table public.web_atelier_submission_buckets from public;
revoke all on table public.web_atelier_submission_buckets from anon;
revoke all on table public.web_atelier_submission_buckets from authenticated;
revoke all on table public.web_atelier_submission_buckets from service_role;

-- Internal helpers are SECURITY INVOKER. The definer entry points call them
-- as the table owner. A later mistaken EXECUTE grant to service_role still
-- cannot write this table, because service_role has no table privilege.

create function public.web_atelier_gateway_assert_email_hash(p_email_hash text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'web_atelier_gateway: email_hash_invalid';
  end if;
end;
$$;

create function public.web_atelier_gateway_window(p_unit text)
returns timestamptz
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_unit = 'hour' then
    return pg_catalog.timezone(
      'UTC',
      pg_catalog.date_trunc('hour', pg_catalog.timezone('UTC', pg_catalog.now()))
    );
  end if;

  if p_unit = 'day' then
    return pg_catalog.timezone(
      'UTC',
      pg_catalog.date_trunc('day', pg_catalog.timezone('UTC', pg_catalog.now()))
    );
  end if;

  raise exception 'web_atelier_gateway: window_invalid';
end;
$$;

create function public.web_atelier_gateway_prune()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.web_atelier_submission_buckets as b
  where (b.bucket_kind, b.bucket_key, b.window_start) in (
    select old_rows.bucket_kind, old_rows.bucket_key, old_rows.window_start
    from public.web_atelier_submission_buckets as old_rows
    where old_rows.window_start < pg_catalog.now() - interval '2 days'
    order by old_rows.window_start
    limit 100
  );
end;
$$;

-- Insert 1, or add 1 only while the stored count is still below the limit.
-- The conflicting row is locked by INSERT ON CONFLICT, so concurrent callers
-- serialize on that bucket. Zero rows returned means the limit is already
-- reached; the caller raises and the surrounding transaction rolls every
-- earlier increment in that attempt back.
create function public.web_atelier_gateway_consume(
  p_kind text,
  p_key text,
  p_window timestamptz,
  p_limit integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hit integer := null;
  v_rows integer := 0;
begin
  insert into public.web_atelier_submission_buckets as b (
    bucket_kind,
    bucket_key,
    window_start,
    hit_count
  )
  values (p_kind, p_key, p_window, 1)
  on conflict on constraint web_atelier_submission_buckets_pkey
  do update
    set hit_count = b.hit_count + 1
    where b.hit_count < p_limit
  returning b.hit_count into v_hit;

  get diagnostics v_rows = row_count;

  if v_rows <> 1 or v_hit is null or v_hit > p_limit then
    raise exception 'web_atelier_gateway: rate_limited';
  end if;
end;
$$;

-- CAPTCHA attempts only. Does not read or write inquiries and does not
-- consume submission quota. Commit of this call is independent of siteverify
-- and of a later submission rollback.
create function public.reserve_web_atelier_captcha_attempt(p_email_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hour timestamptz;
begin
  perform public.web_atelier_gateway_assert_email_hash(p_email_hash);
  perform public.web_atelier_gateway_prune();
  v_hour := public.web_atelier_gateway_window('hour');
  perform public.web_atelier_gateway_consume(
    'captcha_email_hour',
    p_email_hash,
    v_hour,
    10
  );
  perform public.web_atelier_gateway_consume(
    'captcha_global_hour',
    'global',
    v_hour,
    60
  );
end;
$$;

comment on function public.reserve_web_atelier_captcha_attempt(text) is
  'Reserves one CAPTCHA verification attempt: 10/hour per email HMAC and 60/hour globally. Does not verify Turnstile and does not submit an inquiry. EXECUTE is service_role only.';

-- Reads an existing confirmation after Turnstile reports timeout-or-duplicate.
-- The row must already exist. This function never inserts and never consumes
-- submission or CAPTCHA quota. Hash mismatch and a missing row share one
-- error so the caller does not learn which one happened. The returned object
-- is only inquiry_id and reference_code, and only when the canonical payload
-- matches. An anonymous role cannot execute this function.
create function public.confirm_web_atelier_inquiry_retry(
  p_idempotency_key uuid,
  p_language text,
  p_package_preference text,
  p_contact_name text,
  p_email text,
  p_phone text,
  p_existing_website text,
  p_referral text,
  p_project_types text[],
  p_project_types_other text,
  p_goals text[],
  p_goals_other text,
  p_content_ready text,
  p_visuals_ready text,
  p_content_links text,
  p_design_mood text[],
  p_design_mood_other text,
  p_design_inspiration text,
  p_features text[],
  p_features_other text,
  p_features_notes text,
  p_budget_range text,
  p_launch_deadline date,
  p_deadline_flexibility text,
  p_contact_preference text,
  p_contact_time text,
  p_extra_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing uuid;
begin
  if p_idempotency_key is null then
    raise exception 'web_atelier_gateway: retry_unavailable';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key::text, 0::bigint)
  );

  select i.id
    into v_existing
  from public.web_atelier_inquiries i
  where i.idempotency_key = p_idempotency_key;

  if v_existing is null then
    raise exception 'web_atelier_gateway: retry_unavailable';
  end if;

  begin
    return public.create_public_web_atelier_inquiry(
      p_idempotency_key,
      p_language,
      p_package_preference,
      p_contact_name,
      p_email,
      p_phone,
      p_existing_website,
      p_referral,
      p_project_types,
      p_project_types_other,
      p_goals,
      p_goals_other,
      p_content_ready,
      p_visuals_ready,
      p_content_links,
      p_design_mood,
      p_design_mood_other,
      p_design_inspiration,
      p_features,
      p_features_other,
      p_features_notes,
      p_budget_range,
      p_launch_deadline,
      p_deadline_flexibility,
      p_contact_preference,
      p_contact_time,
      p_extra_notes
    );
  exception
    when others then
      if pg_catalog.strpos(sqlerrm, 'različit sadržaj') > 0 then
        raise exception 'web_atelier_gateway: retry_unavailable';
      end if;
      raise;
  end;
end;
$$;

comment on function public.confirm_web_atelier_inquiry_retry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) is
  'Returns an existing Web Atelier confirmation for the same key and payload. Does not insert, does not verify CAPTCHA, and does not consume quotas. EXECUTE is service_role only.';

-- Submission entry point. Idempotent replay is decided under the same
-- advisory lock B1 uses, and it happens before any submission counter moves.
-- A new inquiry charges 5/hour and 20/day for the email HMAC plus 30/hour
-- and 200/day globally, then calls the B1 function in this same transaction.
-- B1 still validates, canonicalizes, and applies its own idempotency rule.
-- If B1 raises, the quota increments roll back with the insert.
create function public.submit_web_atelier_inquiry(
  p_email_hash text,
  p_idempotency_key uuid,
  p_language text,
  p_package_preference text,
  p_contact_name text,
  p_email text,
  p_phone text,
  p_existing_website text,
  p_referral text,
  p_project_types text[],
  p_project_types_other text,
  p_goals text[],
  p_goals_other text,
  p_content_ready text,
  p_visuals_ready text,
  p_content_links text,
  p_design_mood text[],
  p_design_mood_other text,
  p_design_inspiration text,
  p_features text[],
  p_features_other text,
  p_features_notes text,
  p_budget_range text,
  p_launch_deadline date,
  p_deadline_flexibility text,
  p_contact_preference text,
  p_contact_time text,
  p_extra_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing uuid;
  v_hour timestamptz;
  v_day timestamptz;
begin
  perform public.web_atelier_gateway_assert_email_hash(p_email_hash);

  if p_idempotency_key is null then
    raise exception 'web_atelier_gateway: idempotency_key_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key::text, 0::bigint)
  );

  select i.id
    into v_existing
  from public.web_atelier_inquiries i
  where i.idempotency_key = p_idempotency_key;

  if v_existing is not null then
    return public.create_public_web_atelier_inquiry(
      p_idempotency_key,
      p_language,
      p_package_preference,
      p_contact_name,
      p_email,
      p_phone,
      p_existing_website,
      p_referral,
      p_project_types,
      p_project_types_other,
      p_goals,
      p_goals_other,
      p_content_ready,
      p_visuals_ready,
      p_content_links,
      p_design_mood,
      p_design_mood_other,
      p_design_inspiration,
      p_features,
      p_features_other,
      p_features_notes,
      p_budget_range,
      p_launch_deadline,
      p_deadline_flexibility,
      p_contact_preference,
      p_contact_time,
      p_extra_notes
    );
  end if;

  perform public.web_atelier_gateway_prune();
  v_hour := public.web_atelier_gateway_window('hour');
  v_day := public.web_atelier_gateway_window('day');
  perform public.web_atelier_gateway_consume(
    'submit_email_hour',
    p_email_hash,
    v_hour,
    5
  );
  perform public.web_atelier_gateway_consume(
    'submit_email_day',
    p_email_hash,
    v_day,
    20
  );
  perform public.web_atelier_gateway_consume(
    'submit_global_hour',
    'global',
    v_hour,
    30
  );
  perform public.web_atelier_gateway_consume(
    'submit_global_day',
    'global',
    v_day,
    200
  );

  return public.create_public_web_atelier_inquiry(
    p_idempotency_key,
    p_language,
    p_package_preference,
    p_contact_name,
    p_email,
    p_phone,
    p_existing_website,
    p_referral,
    p_project_types,
    p_project_types_other,
    p_goals,
    p_goals_other,
    p_content_ready,
    p_visuals_ready,
    p_content_links,
    p_design_mood,
    p_design_mood_other,
    p_design_inspiration,
    p_features,
    p_features_other,
    p_features_notes,
    p_budget_range,
    p_launch_deadline,
    p_deadline_flexibility,
    p_contact_preference,
    p_contact_time,
    p_extra_notes
  );
end;
$$;

comment on function public.submit_web_atelier_inquiry(
  text, uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) is
  'Only submission entry point. Does not verify CAPTCHA. Charges submission quotas only for a new inquiry, in the same transaction as the B1 insert. EXECUTE is service_role only.';

-- ---------------------------------------------------------------------------
-- Grants. Direct B1 RPC is no longer an API entry point. The owning role
-- keeps EXECUTE on that RPC and on the internal helpers so the definer
-- wrappers can call them after PUBLIC execute is removed. service_role
-- receives EXECUTE only on the three gateway functions, and no table
-- privileges.
-- ---------------------------------------------------------------------------

revoke all on function public.create_public_web_atelier_inquiry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) from public;
revoke all on function public.create_public_web_atelier_inquiry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) from anon;
revoke all on function public.create_public_web_atelier_inquiry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) from authenticated;
revoke all on function public.create_public_web_atelier_inquiry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) from service_role;

grant execute on function public.create_public_web_atelier_inquiry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) to current_user;

revoke all on function public.web_atelier_gateway_assert_email_hash(text) from public;
revoke all on function public.web_atelier_gateway_assert_email_hash(text) from anon;
revoke all on function public.web_atelier_gateway_assert_email_hash(text) from authenticated;
revoke all on function public.web_atelier_gateway_assert_email_hash(text) from service_role;
grant execute on function public.web_atelier_gateway_assert_email_hash(text) to current_user;

revoke all on function public.web_atelier_gateway_window(text) from public;
revoke all on function public.web_atelier_gateway_window(text) from anon;
revoke all on function public.web_atelier_gateway_window(text) from authenticated;
revoke all on function public.web_atelier_gateway_window(text) from service_role;
grant execute on function public.web_atelier_gateway_window(text) to current_user;

revoke all on function public.web_atelier_gateway_prune() from public;
revoke all on function public.web_atelier_gateway_prune() from anon;
revoke all on function public.web_atelier_gateway_prune() from authenticated;
revoke all on function public.web_atelier_gateway_prune() from service_role;
grant execute on function public.web_atelier_gateway_prune() to current_user;

revoke all on function public.web_atelier_gateway_consume(text, text, timestamptz, integer) from public;
revoke all on function public.web_atelier_gateway_consume(text, text, timestamptz, integer) from anon;
revoke all on function public.web_atelier_gateway_consume(text, text, timestamptz, integer) from authenticated;
revoke all on function public.web_atelier_gateway_consume(text, text, timestamptz, integer) from service_role;
grant execute on function public.web_atelier_gateway_consume(text, text, timestamptz, integer) to current_user;

revoke all on function public.reserve_web_atelier_captcha_attempt(text) from public;
revoke all on function public.reserve_web_atelier_captcha_attempt(text) from anon;
revoke all on function public.reserve_web_atelier_captcha_attempt(text) from authenticated;
revoke all on function public.reserve_web_atelier_captcha_attempt(text) from service_role;
grant execute on function public.reserve_web_atelier_captcha_attempt(text) to service_role;

revoke all on function public.confirm_web_atelier_inquiry_retry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) from public;
revoke all on function public.confirm_web_atelier_inquiry_retry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) from anon;
revoke all on function public.confirm_web_atelier_inquiry_retry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) from authenticated;
revoke all on function public.confirm_web_atelier_inquiry_retry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) from service_role;
grant execute on function public.confirm_web_atelier_inquiry_retry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) to service_role;

revoke all on function public.submit_web_atelier_inquiry(
  text, uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) from public;
revoke all on function public.submit_web_atelier_inquiry(
  text, uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) from anon;
revoke all on function public.submit_web_atelier_inquiry(
  text, uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) from authenticated;
revoke all on function public.submit_web_atelier_inquiry(
  text, uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) from service_role;
grant execute on function public.submit_web_atelier_inquiry(
  text, uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) to service_role;

-- ---------------------------------------------------------------------------
-- Postflight. Fail the migration if an API role can still execute B1, call
-- an internal helper, miss a gateway grant, or read the bucket table.
-- ---------------------------------------------------------------------------

do $postflight$
declare
  v_owner oid;
begin
  select p.proowner
    into v_owner
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_public_web_atelier_inquiry';

  if v_owner is distinct from current_user::regrole::oid then
    raise exception 'F2.4.16B2-B1: B1 function owner is not the migration role';
  end if;

  if exists (
    select 1
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'create_public_web_atelier_inquiry'
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
      and privilege_type = 'EXECUTE'
  ) then
    raise exception 'F2.4.16B2-B1: API execute remains on create_public_web_atelier_inquiry';
  end if;

  if exists (
    select 1
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name in (
        'web_atelier_gateway_assert_email_hash',
        'web_atelier_gateway_window',
        'web_atelier_gateway_prune',
        'web_atelier_gateway_consume'
      )
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
      and privilege_type = 'EXECUTE'
  ) then
    raise exception 'F2.4.16B2-B1: internal gateway helper is executable by an API role';
  end if;

  if (
    select count(distinct routine_name)
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name in (
        'reserve_web_atelier_captcha_attempt',
        'confirm_web_atelier_inquiry_retry',
        'submit_web_atelier_inquiry'
      )
      and grantee = 'service_role'
      and privilege_type = 'EXECUTE'
  ) <> 3 then
    raise exception 'F2.4.16B2-B1: service_role is missing a gateway execute grant';
  end if;

  if exists (
    select 1
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name in (
        'reserve_web_atelier_captcha_attempt',
        'confirm_web_atelier_inquiry_retry',
        'submit_web_atelier_inquiry'
      )
      and grantee in ('PUBLIC', 'anon', 'authenticated')
      and privilege_type = 'EXECUTE'
  ) then
    raise exception 'F2.4.16B2-B1: anon or authenticated can execute a gateway function';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'web_atelier_submission_buckets'
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ) then
    raise exception 'F2.4.16B2-B1: API role has a bucket table privilege';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'web_atelier_submission_buckets'
      and c.relrowsecurity
  ) then
    raise exception 'F2.4.16B2-B1: bucket RLS is not enabled';
  end if;
end
$postflight$;
