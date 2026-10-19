-- F2.6 Smart Calendar 2.0
-- Additive after 20261017140000. Do NOT auto-apply to production.
-- Auto Mon–Fri 16:00–19:00 Europe/Zagreb slots, Croatian holidays,
-- annual closure recurrence (opt-in), department monthly project capacity.
-- Preserves existing windows, reservations, and one-time closures.

-- ---------------------------------------------------------------------------
-- Preflight
-- ---------------------------------------------------------------------------

do $preflight$
begin
  if to_regclass('public.booking_shared_settings') is null
     or to_regclass('public.availability_closures') is null
     or to_regclass('public.department_availability_windows') is null then
    raise exception 'F2.6.2: apply 20261017130000 / 20261017140000 first';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- Settings extensions
-- ---------------------------------------------------------------------------

alter table public.booking_shared_settings
  add column if not exists booking_horizon_days integer not null default 90
    check (booking_horizon_days >= 14 and booking_horizon_days <= 366),
  add column if not exists auto_weekly_enabled boolean not null default true,
  add column if not exists auto_weekday_start_time time not null default time '16:00',
  add column if not exists auto_weekday_end_time time not null default time '19:00';

update public.booking_shared_settings
set default_slot_minutes = 30
where id = 1 and default_slot_minutes = 60;

comment on column public.booking_shared_settings.booking_horizon_days is
  'Public auto-slot look-ahead in days (Europe/Zagreb).';
comment on column public.booking_shared_settings.auto_weekly_enabled is
  'When true, Mon–Fri auto hours generate bookable consultation slots.';

-- ---------------------------------------------------------------------------
-- Closures: opt-in annual recurrence (existing rows stay one-time)
-- ---------------------------------------------------------------------------

alter table public.availability_closures
  add column if not exists recurrence text not null default 'none',
  add column if not exists recurrence_end_date date;

do $closure_rec$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'availability_closures_recurrence_check'
  ) then
    alter table public.availability_closures
      add constraint availability_closures_recurrence_check
      check (recurrence in ('none', 'annual'));
  end if;
end
$closure_rec$;

comment on column public.availability_closures.recurrence is
  'none = one-time (default for all pre-2.0 rows). annual = repeat each year until recurrence_end_date.';

-- ---------------------------------------------------------------------------
-- Monthly accepted-project capacity (separate from shared consultation capacity)
-- ---------------------------------------------------------------------------

create table if not exists public.department_monthly_capacity_settings (
  department text primary key
    check (department in ('web_atelier', 'interiors', 'lrc')),
  max_accepted_projects integer not null default 3
    check (max_accepted_projects >= 0 and max_accepted_projects <= 50),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now()
);

insert into public.department_monthly_capacity_settings (department, max_accepted_projects)
values
  ('web_atelier', 3),
  ('interiors', 3),
  ('lrc', 3)
on conflict (department) do nothing;

comment on table public.department_monthly_capacity_settings is
  'Max accepted/confirmed projects per planned START month per department (default 3). Distinct from shared simultaneous consultation capacity.';

create table if not exists public.department_capacity_allocations (
  id uuid primary key default gen_random_uuid(),
  department text not null
    check (department in ('web_atelier', 'interiors', 'lrc')),
  planned_start_month date not null,
  source_kind text not null
    check (source_kind in ('manual', 'web_atelier_project', 'interiors_project')),
  source_id uuid,
  status text not null default 'active'
    check (status in ('active', 'released')),
  title text not null,
  notes text,
  is_override boolean not null default false,
  override_reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint department_capacity_allocations_month_first
    check (planned_start_month = date_trunc('month', planned_start_month)::date),
  constraint department_capacity_allocations_title_len
    check (char_length(title) between 1 and 200),
  constraint department_capacity_allocations_notes_len
    check (notes is null or char_length(notes) < 2000),
  constraint department_capacity_allocations_override_reason_len
    check (override_reason is null or char_length(override_reason) < 2000),
  constraint department_capacity_allocations_source_shape check (
    (source_kind = 'manual' and source_id is null)
    or (source_kind <> 'manual' and source_id is not null)
  ),
  constraint department_capacity_allocations_override_shape check (
    (is_override = false and override_reason is null)
    or (is_override = true and override_reason is not null)
  )
);

create unique index if not exists department_capacity_allocations_active_source_uidx
  on public.department_capacity_allocations (department, source_kind, source_id)
  where status = 'active' and source_id is not null;

create index if not exists department_capacity_allocations_month_idx
  on public.department_capacity_allocations (department, planned_start_month)
  where status = 'active';

comment on table public.department_capacity_allocations is
  'Accepted-project capacity consumption for a planned start month. Manual rows cover LRC / interiors gaps; WA projects may link via source_id.';

alter table public.department_monthly_capacity_settings enable row level security;
alter table public.department_capacity_allocations enable row level security;

revoke all on table public.department_monthly_capacity_settings
  from public, anon, authenticated, service_role;
revoke all on table public.department_capacity_allocations
  from public, anon, authenticated, service_role;

grant select on table public.department_monthly_capacity_settings to authenticated;
grant select on table public.department_capacity_allocations to authenticated;

create policy department_monthly_capacity_settings_admin_select
  on public.department_monthly_capacity_settings for select to authenticated
  using (public.is_admin());

create policy department_capacity_allocations_admin_select
  on public.department_capacity_allocations for select to authenticated
  using (public.is_admin());

-- Optional WA planned start month (additive)
alter table public.web_atelier_projects
  add column if not exists planned_start_month date;

do $wa_month$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'web_atelier_projects_planned_start_month_first'
  ) then
    alter table public.web_atelier_projects
      add constraint web_atelier_projects_planned_start_month_first
      check (
        planned_start_month is null
        or planned_start_month = date_trunc('month', planned_start_month)::date
      );
  end if;
end
$wa_month$;

-- Auto-window uniqueness for generated slots
create unique index if not exists department_availability_windows_auto_slot_uidx
  on public.department_availability_windows (department, starts_at, ends_at)
  where notes = 'f26_auto_slot';

-- ---------------------------------------------------------------------------
-- Croatian holidays (SQL mirror of src/lib/croatianHolidays.ts)
-- ---------------------------------------------------------------------------

create or replace function public.booking_easter_sunday(p_year integer)
returns date
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  a integer; b integer; c integer; d integer; e integer; f integer; g integer;
  h integer; i integer; k integer; l integer; m integer; month integer; day integer;
begin
  if p_year < 1900 or p_year > 2200 then
    raise exception 'booking_year_out_of_range';
  end if;
  a := p_year % 19;
  b := p_year / 100;
  c := p_year % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  month := (h + l - 7 * m + 114) / 31;
  day := ((h + l - 7 * m + 114) % 31) + 1;
  return make_date(p_year, month, day);
end;
$$;

create or replace function public.booking_croatian_holiday_dates(p_year integer)
returns setof date
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_easter date;
begin
  return query
  select d from (values
    (make_date(p_year, 1, 1)),
    (make_date(p_year, 1, 6)),
    (make_date(p_year, 5, 1)),
    (make_date(p_year, 5, 30)),
    (make_date(p_year, 6, 22)),
    (make_date(p_year, 8, 5)),
    (make_date(p_year, 8, 15)),
    (make_date(p_year, 11, 1)),
    (make_date(p_year, 11, 18)),
    (make_date(p_year, 12, 25)),
    (make_date(p_year, 12, 26))
  ) as t(d);

  v_easter := public.booking_easter_sunday(p_year);
  return next v_easter;
  return next (v_easter + 1);   -- Easter Monday
  return next (v_easter + 60);  -- Corpus Christi
end;
$$;

create or replace function public.booking_is_croatian_holiday(p_date date)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.booking_croatian_holiday_dates(extract(year from p_date)::integer) h
    where h = p_date
  );
$$;

revoke all on function public.booking_easter_sunday(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.booking_croatian_holiday_dates(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.booking_is_croatian_holiday(date)
  from public, anon, authenticated, service_role;
-- Admin calendar + service_role; not granted to anon.
grant execute on function public.booking_is_croatian_holiday(date) to authenticated, service_role;
revoke all on function public.booking_interval_is_closed(text, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.booking_interval_is_closed(text, timestamptz, timestamptz)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Closure matching with annual recurrence
-- ---------------------------------------------------------------------------

create or replace function public.booking_closure_matches_interval(
  p_closure public.availability_closures,
  p_department text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_year integer;
  v_c_start timestamptz;
  v_c_end timestamptz;
  v_span interval;
begin
  if not p_closure.is_active then
    return false;
  end if;
  if p_closure.department is not null and p_closure.department is distinct from p_department then
    return false;
  end if;

  if p_closure.recurrence = 'none' then
    return p_closure.starts_at < p_ends_at and p_closure.ends_at > p_starts_at;
  end if;

  -- Annual: shift the original Zagreb calendar span into each year touched by the interval.
  v_span := p_closure.ends_at - p_closure.starts_at;
  for v_year in
    extract(year from (p_starts_at at time zone 'Europe/Zagreb'))::integer
    .. extract(year from ((p_ends_at - interval '1 second') at time zone 'Europe/Zagreb'))::integer
  loop
    if p_closure.recurrence_end_date is not null
       and make_date(v_year, 1, 1) > p_closure.recurrence_end_date then
      continue;
    end if;
    v_c_start := (
      make_timestamp(
        v_year,
        extract(month from (p_closure.starts_at at time zone 'Europe/Zagreb'))::integer,
        extract(day from (p_closure.starts_at at time zone 'Europe/Zagreb'))::integer,
        extract(hour from (p_closure.starts_at at time zone 'Europe/Zagreb'))::integer,
        extract(minute from (p_closure.starts_at at time zone 'Europe/Zagreb'))::integer,
        extract(second from (p_closure.starts_at at time zone 'Europe/Zagreb'))
      ) at time zone 'Europe/Zagreb'
    );
    -- Skip invalid Feb 29 shifts by catching: use last valid day if needed
    if extract(month from (p_closure.starts_at at time zone 'Europe/Zagreb'))::integer = 2
       and extract(day from (p_closure.starts_at at time zone 'Europe/Zagreb'))::integer = 29
       and not (
         (v_year % 400 = 0) or (v_year % 4 = 0 and v_year % 100 <> 0)
       ) then
      v_c_start := (make_timestamp(v_year, 2, 28, 0, 0, 0) at time zone 'Europe/Zagreb');
    end if;
    v_c_end := v_c_start + v_span;
    if v_c_start < p_ends_at and v_c_end > p_starts_at then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

create or replace function public.booking_interval_is_closed(
  p_department text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_day date;
  v_closure public.availability_closures%rowtype;
begin
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    return true;
  end if;

  -- Any Zagreb civil day touched by the interval that is a Croatian holiday => closed.
  v_day := (p_starts_at at time zone 'Europe/Zagreb')::date;
  while v_day <= ((p_ends_at - interval '1 second') at time zone 'Europe/Zagreb')::date loop
    if public.booking_is_croatian_holiday(v_day) then
      return true;
    end if;
    v_day := v_day + 1;
  end loop;

  for v_closure in
    select c.*
    from public.availability_closures c
    where c.is_active
  loop
    if public.booking_closure_matches_interval(
      v_closure, p_department, p_starts_at, p_ends_at
    ) then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Monthly capacity helpers
-- ---------------------------------------------------------------------------

create or replace function public.booking_department_month_accepted_count(
  p_department text,
  p_month date
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.department_capacity_allocations a
  where a.department = p_department
    and a.status = 'active'
    and a.planned_start_month = date_trunc('month', p_month)::date;
$$;

create or replace function public.booking_department_month_has_capacity(
  p_department text,
  p_month date
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_max integer;
  v_used integer;
begin
  select s.max_accepted_projects into v_max
  from public.department_monthly_capacity_settings s
  where s.department = p_department;
  if not found then
    v_max := 3;
  end if;
  v_used := public.booking_department_month_accepted_count(
    p_department, date_trunc('month', p_month)::date
  );
  return v_used < v_max;
end;
$$;

create or replace function public.booking_lock_department_month(
  p_department text,
  p_month date
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(
    8266202,
    hashtext(p_department || ':' || date_trunc('month', p_month)::date::text)
  );
end;
$$;

revoke all on function public.booking_department_month_accepted_count(text, date)
  from public, anon, authenticated, service_role;
revoke all on function public.booking_department_month_has_capacity(text, date)
  from public, anon, authenticated, service_role;
revoke all on function public.booking_lock_department_month(text, date)
  from public, anon, authenticated, service_role;
grant execute on function public.booking_department_month_has_capacity(text, date)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Auto slot generation + public list rewrite
-- ---------------------------------------------------------------------------

-- Materialize auto slots as windows (insert + unique_violation catch for races)
create or replace function public.booking_ensure_auto_window(
  p_department text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select w.id into v_id
  from public.department_availability_windows w
  where w.department = p_department
    and w.starts_at = p_starts_at
    and w.ends_at = p_ends_at
    and coalesce(w.notes, '') = 'f26_auto_slot'
  for update;

  if found then
    return v_id;
  end if;

  begin
    insert into public.department_availability_windows (
      department, title, starts_at, ends_at, capacity, notes, created_by
    ) values (
      p_department, 'Auto termin', p_starts_at, p_ends_at, 1, 'f26_auto_slot', null
    )
    returning id into v_id;
  exception
    when unique_violation then
      select w.id into v_id
      from public.department_availability_windows w
      where w.department = p_department
        and w.starts_at = p_starts_at
        and w.ends_at = p_ends_at
        and coalesce(w.notes, '') = 'f26_auto_slot';
  end;
  return v_id;
end;
$$;

revoke all on function public.booking_ensure_auto_window(text, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.public_list_consultation_availability(
  p_department text,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.booking_shared_settings%rowtype;
  v_slots jsonb := '[]'::jsonb;
  v_win record;
  v_window_used integer;
  v_shared_used integer;
  v_remaining integer;
  v_horizon_end timestamptz;
  v_day date;
  v_dow integer;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_day_start timestamptz;
  v_cursor timestamptz;
  v_window_id uuid;
  v_month date;
begin
  if p_department is null or p_department not in ('web_atelier', 'interiors', 'lrc') then
    raise exception 'booking_invalid_department';
  end if;
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'booking_invalid_range';
  end if;
  if p_to > p_from + interval '120 days' then
    raise exception 'booking_range_too_large';
  end if;

  select * into v_settings from public.booking_shared_settings where id = 1;
  if not found then
    v_settings.shared_consultation_capacity := 1;
    v_settings.default_slot_minutes := 30;
    v_settings.booking_horizon_days := 90;
    v_settings.auto_weekly_enabled := true;
    v_settings.auto_weekday_start_time := time '16:00';
    v_settings.auto_weekday_end_time := time '19:00';
  end if;

  v_horizon_end := least(
    p_to,
    pg_catalog.now() + make_interval(days => v_settings.booking_horizon_days)
  );

  -- 1) Legacy manually created windows
  for v_win in
    select w.*
    from public.department_availability_windows w
    where w.department = p_department
      and coalesce(w.notes, '') is distinct from 'f26_auto_slot'
      and w.ends_at > greatest(p_from, pg_catalog.now())
      and w.starts_at < v_horizon_end
    order by w.starts_at
  loop
    if public.booking_interval_is_closed(p_department, v_win.starts_at, v_win.ends_at) then
      continue;
    end if;
    v_month := date_trunc('month', (v_win.starts_at at time zone 'Europe/Zagreb')::date)::date;
    if not public.booking_department_month_has_capacity(p_department, v_month) then
      continue;
    end if;

    select count(*)::integer into v_window_used
    from public.department_reservations r
    where r.window_id = v_win.id
      and r.status = 'confirmed'
      and r.slot_released_at is null
      and r.starts_at < v_win.ends_at
      and r.ends_at > v_win.starts_at;

    select count(*)::integer into v_shared_used
    from public.department_reservations r
    where r.status = 'confirmed'
      and r.booking_kind = 'consultation'
      and r.slot_released_at is null
      and r.starts_at < v_win.ends_at
      and r.ends_at > v_win.starts_at;

    v_remaining := least(
      v_win.capacity - v_window_used,
      v_settings.shared_consultation_capacity - v_shared_used
    );
    if v_remaining > 0 then
      v_slots := v_slots || jsonb_build_array(
        jsonb_build_object(
          'window_id', v_win.id,
          'department', v_win.department,
          'starts_at', v_win.starts_at,
          'ends_at', v_win.ends_at,
          'remaining', v_remaining,
          'source', 'manual_window'
        )
      );
    end if;
  end loop;

  -- 2) Auto Mon–Fri slots (16:00–19:00 Europe/Zagreb by default)
  if v_settings.auto_weekly_enabled
     and v_settings.auto_weekday_end_time > v_settings.auto_weekday_start_time then
    v_day := greatest(
      (greatest(p_from, pg_catalog.now()) at time zone 'Europe/Zagreb')::date,
      (pg_catalog.now() at time zone 'Europe/Zagreb')::date
    );
    while v_day < (v_horizon_end at time zone 'Europe/Zagreb')::date
          or (
            v_day = (v_horizon_end at time zone 'Europe/Zagreb')::date
          )
    loop
      if v_day > (v_horizon_end at time zone 'Europe/Zagreb')::date then
        exit;
      end if;

      v_dow := extract(isodow from v_day)::integer; -- 1=Mon .. 7=Sun
      if v_dow between 1 and 5
         and not public.booking_is_croatian_holiday(v_day) then
        v_month := date_trunc('month', v_day)::date;
        if public.booking_department_month_has_capacity(p_department, v_month) then
          v_day_start := (
            (v_day + v_settings.auto_weekday_start_time) at time zone 'Europe/Zagreb'
          );
          v_cursor := v_day_start;
          while v_cursor + make_interval(mins => v_settings.default_slot_minutes)
                <= ((v_day + v_settings.auto_weekday_end_time) at time zone 'Europe/Zagreb')
          loop
            v_slot_start := v_cursor;
            v_slot_end := v_cursor + make_interval(mins => v_settings.default_slot_minutes);
            if v_slot_end > pg_catalog.now()
               and v_slot_start >= p_from
               and v_slot_start < v_horizon_end
               and not public.booking_interval_is_closed(p_department, v_slot_start, v_slot_end)
            then
              select count(*)::integer into v_shared_used
              from public.department_reservations r
              where r.status = 'confirmed'
                and r.booking_kind = 'consultation'
                and r.slot_released_at is null
                and r.starts_at < v_slot_end
                and r.ends_at > v_slot_start;

              v_remaining := v_settings.shared_consultation_capacity - v_shared_used;
              if v_remaining > 0 then
                v_window_id := public.booking_ensure_auto_window(
                  p_department, v_slot_start, v_slot_end
                );
                v_slots := v_slots || jsonb_build_array(
                  jsonb_build_object(
                    'window_id', v_window_id,
                    'department', p_department,
                    'starts_at', v_slot_start,
                    'ends_at', v_slot_end,
                    'remaining', v_remaining,
                    'source', 'auto_weekly'
                  )
                );
              end if;
            end if;
            v_cursor := v_slot_end;
          end loop;
        end if;
      end if;
      v_day := v_day + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'department', p_department,
    'slots', v_slots,
    'timezone', 'Europe/Zagreb',
    'notice_hr',
      'Rezervirajte termin za početak suradnje (obično pon–pet 16–19). Ako ste dovoljno detaljno opisali projekt, dogovor možemo dovršiti bez dodatnog razgovora.',
    'notice_en',
      'Book a start-of-cooperation slot (usually Mon–Fri 16:00–19:00). If your project details are sufficient, we can finalize without an extra call.'
  );
end;
$$;

-- Enforce monthly capacity + closures on public book
create or replace function public.public_book_consultation_slot(
  p_department text,
  p_window_id uuid,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_description text,
  p_idempotency_key uuid,
  p_client_fingerprint text default null,
  p_entity_kind text default 'booking_lead',
  p_entity_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window public.department_availability_windows%rowtype;
  v_existing public.department_reservations%rowtype;
  v_id uuid;
  v_name text;
  v_email text;
  v_phone text;
  v_desc text;
  v_entity_kind text;
  v_fp text;
  v_month date;
begin
  if p_department is null or p_department not in ('web_atelier', 'interiors', 'lrc') then
    raise exception 'booking_invalid_department';
  end if;
  if p_idempotency_key is null then
    raise exception 'booking_idempotency_key_required';
  end if;

  v_name := left(btrim(coalesce(p_contact_name, '')), 120);
  v_email := left(lower(btrim(coalesce(p_contact_email, ''))), 254);
  v_phone := left(btrim(coalesce(p_contact_phone, '')), 40);
  v_desc := left(btrim(coalesce(p_description, '')), 4000);
  v_fp := left(btrim(coalesce(p_client_fingerprint, '')), 128);

  if char_length(v_name) < 2 then
    raise exception 'booking_contact_name_required';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'booking_contact_email_invalid';
  end if;
  if char_length(v_phone) < 5 then
    raise exception 'booking_contact_phone_required';
  end if;
  if char_length(v_desc) < 10 then
    raise exception 'booking_description_required';
  end if;

  perform public.booking_public_rate_limit_check(
    encode(
      extensions.digest(v_email || '|' || coalesce(v_fp, 'na'), 'sha256'),
      'hex'
    ),
    8,
    3600
  );

  select * into v_existing
  from public.department_reservations r
  where r.idempotency_key = p_idempotency_key;
  if found then
    if lower(coalesce(v_existing.contact_email, '')) is distinct from v_email
       or v_existing.window_id is distinct from p_window_id
       or v_existing.department is distinct from p_department then
      raise exception 'booking_idempotency_conflict';
    end if;
    return jsonb_build_object(
      'reservation_id', v_existing.id,
      'department', v_existing.department,
      'starts_at', v_existing.starts_at,
      'ends_at', v_existing.ends_at,
      'replay', true
    );
  end if;

  perform pg_advisory_xact_lock(8266001, hashtext(p_window_id::text));

  v_window := public.department_lock_availability_window(p_window_id);
  if v_window.department is distinct from p_department then
    raise exception 'booking_window_department_mismatch';
  end if;
  if v_window.ends_at <= pg_catalog.now() then
    raise exception 'booking_slot_stale';
  end if;

  if public.booking_interval_is_closed(p_department, v_window.starts_at, v_window.ends_at) then
    raise exception 'booking_slot_unavailable';
  end if;

  v_month := date_trunc(
    'month', (v_window.starts_at at time zone 'Europe/Zagreb')::date
  )::date;
  perform public.booking_lock_department_month(p_department, v_month);
  if not public.booking_department_month_has_capacity(p_department, v_month) then
    raise exception 'booking_month_capacity_full';
  end if;

  v_entity_kind := coalesce(nullif(btrim(coalesce(p_entity_kind, '')), ''), 'booking_lead');
  if v_entity_kind = 'booking_lead' then
    p_entity_id := null;
  elsif p_entity_id is null then
    raise exception 'booking_entity_id_required';
  end if;

  begin
    insert into public.department_reservations (
      department, window_id, starts_at, ends_at, status,
      entity_kind, entity_id, title, notes, created_by,
      booking_kind, source, contact_name, contact_email, contact_phone,
      description, idempotency_key, public_client_fingerprint
    ) values (
      p_department, p_window_id, v_window.starts_at, v_window.ends_at, 'confirmed',
      v_entity_kind, p_entity_id, v_name, null, null,
      'consultation', 'web', v_name, v_email, v_phone,
      v_desc, p_idempotency_key, nullif(v_fp, '')
    )
    returning id into v_id;
  exception
    when unique_violation then
      select * into v_existing
      from public.department_reservations r
      where r.idempotency_key = p_idempotency_key;
      if found then
        return jsonb_build_object(
          'reservation_id', v_existing.id,
          'department', v_existing.department,
          'starts_at', v_existing.starts_at,
          'ends_at', v_existing.ends_at,
          'replay', true
        );
      end if;
      raise;
    when others then
      if sqlerrm ~ 'capacity_exceeded|closed_period|outside_window|month_capacity' then
        raise exception 'booking_slot_unavailable';
      end if;
      raise;
  end;

  return jsonb_build_object(
    'reservation_id', v_id,
    'department', p_department,
    'starts_at', v_window.starts_at,
    'ends_at', v_window.ends_at,
    'replay', false,
    'notice_hr',
      'Termin je rezerviran za početak suradnje. To nije prihvat ponude ni jamstvo završetka projekta.',
    'notice_en',
      'Slot booked for starting cooperation. This is not offer acceptance or a project completion guarantee.'
  );
end;
$$;

-- Keep revoke: anon must not EXECUTE public_book (hardening migration remains in force).
-- Re-assert grants for rewritten list RPC only.
revoke all on function public.public_list_consultation_availability(text, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.public_list_consultation_availability(text, timestamptz, timestamptz)
  to anon, authenticated, service_role;

revoke all on function public.public_book_consultation_slot(
  text, uuid, text, text, text, text, uuid, text, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.public_book_consultation_slot(
  text, uuid, text, text, text, text, uuid, text, text, uuid
) to service_role;

-- ---------------------------------------------------------------------------
-- Guard: consultation bookings blocked when month project capacity is full
-- ---------------------------------------------------------------------------

create or replace function public.department_reservations_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_window public.department_availability_windows%rowtype;
  v_month date;
  v_allow_override text;
begin
  if tg_op = 'DELETE' then
    raise exception 'reservation_delete_forbidden';
  end if;

  new.title := btrim(new.title);
  new.updated_at := pg_catalog.now();

  if new.booking_kind is null then
    new.booking_kind := 'consultation';
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, pg_catalog.now());
  end if;

  select * into v_window
  from public.department_availability_windows w
  where w.id = new.window_id;
  if not found then
    raise exception 'availability_window_not_found';
  end if;

  if new.department is distinct from v_window.department then
    raise exception 'reservation_department_mismatch';
  end if;

  if new.entity_kind = 'web_atelier_project' and new.entity_id is not null then
    if new.department is distinct from 'web_atelier' then
      raise exception 'reservation_entity_department_mismatch';
    end if;
    perform 1 from public.web_atelier_projects p where p.id = new.entity_id;
    if not found then
      raise exception 'project_not_found';
    end if;
  end if;

  if new.entity_kind = 'web_atelier_inquiry' and new.entity_id is not null then
    if new.department is distinct from 'web_atelier' then
      raise exception 'reservation_entity_department_mismatch';
    end if;
    if to_regclass('public.web_atelier_inquiries') is not null then
      perform 1 from public.web_atelier_inquiries i where i.id = new.entity_id;
      if not found then
        raise exception 'web_atelier_inquiry_not_found';
      end if;
    end if;
  end if;

  if new.entity_kind = 'interiors_project' and new.entity_id is not null then
    if new.department is distinct from 'interiors' then
      raise exception 'reservation_entity_department_mismatch';
    end if;
    if to_regclass('public.projects') is not null then
      perform 1 from public.projects p where p.id = new.entity_id;
      if not found then
        raise exception 'interiors_project_not_found';
      end if;
    end if;
  end if;

  if new.entity_kind = 'lrc_inquiry' and new.entity_id is not null then
    if new.department is distinct from 'lrc' then
      raise exception 'reservation_entity_department_mismatch';
    end if;
    if to_regclass('public.lrc_inquiries') is not null then
      perform 1 from public.lrc_inquiries i where i.id = new.entity_id;
      if not found then
        raise exception 'lrc_inquiry_not_found';
      end if;
    end if;
  end if;

  if new.status = 'confirmed' and new.slot_released_at is null then
    if public.booking_interval_is_closed(new.department, new.starts_at, new.ends_at) then
      raise exception 'reservation_in_closed_period';
    end if;

    perform public.department_reservation_capacity_ok(
      new.window_id,
      case when tg_op = 'UPDATE' then new.id else null end,
      new.starts_at,
      new.ends_at
    );

    if new.booking_kind = 'consultation' then
      perform public.booking_consultation_shared_capacity_ok(
        case when tg_op = 'UPDATE' then new.id else null end,
        new.starts_at,
        new.ends_at
      );

      -- Distinct from shared simultaneous capacity: block new consultations in a
      -- month that already has max accepted projects (unless audited admin override).
      v_month := date_trunc(
        'month', (new.starts_at at time zone 'Europe/Zagreb')::date
      )::date;
      v_allow_override := current_setting('booking.allow_month_capacity_override', true);
      if coalesce(v_allow_override, '') is distinct from 'on'
         and not public.booking_department_month_has_capacity(new.department, v_month) then
        raise exception 'booking_month_capacity_full';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: extended settings / closures / calendar / capacity RPCs
-- ---------------------------------------------------------------------------

create or replace function public.admin_get_booking_shared_settings()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.booking_shared_settings%rowtype;
begin
  perform public.web_atelier_require_admin();
  select * into v_row from public.booking_shared_settings where id = 1;
  if not found then
    insert into public.booking_shared_settings (id) values (1)
    returning * into v_row;
  end if;
  return jsonb_build_object(
    'shared_consultation_capacity', v_row.shared_consultation_capacity,
    'default_slot_minutes', v_row.default_slot_minutes,
    'notes', v_row.notes,
    'booking_horizon_days', v_row.booking_horizon_days,
    'auto_weekly_enabled', v_row.auto_weekly_enabled,
    'auto_weekday_start_time', v_row.auto_weekday_start_time::text,
    'auto_weekday_end_time', v_row.auto_weekday_end_time::text,
    'updated_at', v_row.updated_at
  );
end;
$$;

drop function if exists public.admin_update_booking_shared_settings(integer, integer, text);

create or replace function public.admin_update_booking_shared_settings(
  p_shared_consultation_capacity integer default null,
  p_default_slot_minutes integer default null,
  p_notes text default null,
  p_booking_horizon_days integer default null,
  p_auto_weekly_enabled boolean default null,
  p_auto_weekday_start_time time default null,
  p_auto_weekday_end_time time default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.web_atelier_require_admin();
  perform public.booking_lock_shared_settings();

  if p_auto_weekday_start_time is not null
     and p_auto_weekday_end_time is not null
     and p_auto_weekday_end_time <= p_auto_weekday_start_time then
    raise exception 'booking_auto_hours_invalid';
  end if;

  update public.booking_shared_settings s
  set
    shared_consultation_capacity = coalesce(
      p_shared_consultation_capacity, s.shared_consultation_capacity
    ),
    default_slot_minutes = coalesce(p_default_slot_minutes, s.default_slot_minutes),
    notes = case when p_notes is null then s.notes else nullif(btrim(p_notes), '') end,
    booking_horizon_days = coalesce(p_booking_horizon_days, s.booking_horizon_days),
    auto_weekly_enabled = coalesce(p_auto_weekly_enabled, s.auto_weekly_enabled),
    auto_weekday_start_time = coalesce(p_auto_weekday_start_time, s.auto_weekday_start_time),
    auto_weekday_end_time = coalesce(p_auto_weekday_end_time, s.auto_weekday_end_time),
    updated_by = auth.uid(),
    updated_at = pg_catalog.now()
  where s.id = 1;

  return public.admin_get_booking_shared_settings();
end;
$$;

drop function if exists public.admin_create_availability_closure(timestamptz, timestamptz, text, text);

create or replace function public.admin_create_availability_closure(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_department text default null,
  p_reason text default null,
  p_recurrence text default 'none',
  p_recurrence_end_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_conflicts jsonb;
  v_recurrence text;
begin
  perform public.web_atelier_require_admin();

  if p_ends_at <= p_starts_at then
    raise exception 'closure_invalid_range';
  end if;
  if p_department is not null
     and p_department not in ('web_atelier', 'interiors', 'lrc') then
    raise exception 'closure_invalid_department';
  end if;

  v_recurrence := coalesce(nullif(btrim(p_recurrence), ''), 'none');
  if v_recurrence not in ('none', 'annual') then
    raise exception 'closure_invalid_recurrence';
  end if;
  if v_recurrence = 'none' then
    p_recurrence_end_date := null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'department', r.department,
      'title', r.title,
      'starts_at', r.starts_at,
      'ends_at', r.ends_at,
      'status', r.status
    )
    order by r.starts_at
  ), '[]'::jsonb)
  into v_conflicts
  from public.department_reservations r
  where r.status = 'confirmed'
    and r.slot_released_at is null
    and r.starts_at < p_ends_at
    and r.ends_at > p_starts_at
    and (p_department is null or r.department = p_department);

  insert into public.availability_closures (
    department, starts_at, ends_at, reason, created_by, recurrence, recurrence_end_date
  ) values (
    p_department, p_starts_at, p_ends_at,
    nullif(btrim(coalesce(p_reason, '')), ''),
    auth.uid(),
    v_recurrence,
    p_recurrence_end_date
  )
  returning id into v_id;

  return jsonb_build_object(
    'closure_id', v_id,
    'conflicting_reservations', v_conflicts,
    'has_conflicts', jsonb_array_length(v_conflicts) > 0,
    'warning', case
      when jsonb_array_length(v_conflicts) > 0 then
        'Closure saved. Existing confirmed bookings were NOT moved or cancelled — resolve them manually.'
      else null
    end
  );
end;
$$;

create or replace function public.admin_set_closure_recurrence(
  p_closure_id uuid,
  p_recurrence text,
  p_recurrence_end_date date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recurrence text;
begin
  perform public.web_atelier_require_admin();
  v_recurrence := coalesce(nullif(btrim(p_recurrence), ''), 'none');
  if v_recurrence not in ('none', 'annual') then
    raise exception 'closure_invalid_recurrence';
  end if;
  update public.availability_closures c
  set
    recurrence = v_recurrence,
    recurrence_end_date = case when v_recurrence = 'none' then null else p_recurrence_end_date end,
    updated_at = pg_catalog.now()
  where c.id = p_closure_id and c.is_active;
  if not found then
    raise exception 'closure_not_found';
  end if;
end;
$$;

create or replace function public.admin_list_booking_calendar(
  p_department text default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_closures jsonb;
  v_settings jsonb;
  v_history jsonb;
  v_capacity jsonb;
  v_month date;
begin
  perform public.web_atelier_require_admin();

  v_base := public.admin_list_department_availability(p_department, p_from, p_to);
  v_settings := public.admin_get_booking_shared_settings();
  v_month := date_trunc(
    'month',
    coalesce((p_from at time zone 'Europe/Zagreb')::date, (pg_catalog.now() at time zone 'Europe/Zagreb')::date)
  )::date;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'department', c.department,
      'starts_at', c.starts_at,
      'ends_at', c.ends_at,
      'reason', c.reason,
      'is_active', c.is_active,
      'recurrence', c.recurrence,
      'recurrence_end_date', c.recurrence_end_date,
      'created_at', c.created_at
    )
    order by c.starts_at, c.created_at
  ), '[]'::jsonb)
  into v_closures
  from public.availability_closures c
  where c.is_active
    and (p_department is null or c.department is null or c.department = p_department)
    and (
      c.recurrence = 'annual'
      or (
        (p_from is null or c.ends_at > p_from)
        and (p_to is null or c.starts_at < p_to)
      )
    );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'department', r.department,
      'window_id', r.window_id,
      'starts_at', r.starts_at,
      'ends_at', r.ends_at,
      'status', r.status,
      'entity_kind', r.entity_kind,
      'entity_id', r.entity_id,
      'title', r.title,
      'notes', r.notes,
      'booking_kind', r.booking_kind,
      'source', r.source,
      'contact_name', r.contact_name,
      'contact_email', r.contact_email,
      'contact_phone', r.contact_phone,
      'description', r.description,
      'consultation_outcome', r.consultation_outcome,
      'cancel_reason', r.cancel_reason,
      'cancelled_at', r.cancelled_at,
      'slot_released_at', r.slot_released_at,
      'created_at', r.created_at
    )
    order by r.starts_at, r.created_at
  ), '[]'::jsonb)
  into v_history
  from public.department_reservations r
  where (p_department is null or r.department = p_department)
    and (p_from is null or r.ends_at > p_from)
    and (p_to is null or r.starts_at < p_to);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'department', s.department,
      'planned_start_month', v_month,
      'max_accepted_projects', s.max_accepted_projects,
      'used', public.booking_department_month_accepted_count(s.department, v_month),
      'remaining', greatest(
        0,
        s.max_accepted_projects
          - public.booking_department_month_accepted_count(s.department, v_month)
      ),
      'is_full', not public.booking_department_month_has_capacity(s.department, v_month)
    )
    order by s.department
  ), '[]'::jsonb)
  into v_capacity
  from public.department_monthly_capacity_settings s
  where p_department is null or s.department = p_department;

  return jsonb_build_object(
    'windows', coalesce(v_base->'windows', '[]'::jsonb),
    'reservations', v_history,
    'closures', v_closures,
    'settings', v_settings,
    'month_capacity', v_capacity
  );
end;
$$;

create or replace function public.admin_list_department_month_capacity(
  p_department text,
  p_month date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date;
  v_max integer;
  v_used integer;
  v_rows jsonb;
begin
  perform public.web_atelier_require_admin();
  if p_department is null or p_department not in ('web_atelier', 'interiors', 'lrc') then
    raise exception 'booking_invalid_department';
  end if;
  v_month := date_trunc('month', p_month)::date;

  select s.max_accepted_projects into v_max
  from public.department_monthly_capacity_settings s
  where s.department = p_department;
  if not found then
    v_max := 3;
  end if;
  v_used := public.booking_department_month_accepted_count(p_department, v_month);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'department', a.department,
      'planned_start_month', a.planned_start_month,
      'source_kind', a.source_kind,
      'source_id', a.source_id,
      'status', a.status,
      'title', a.title,
      'notes', a.notes,
      'is_override', a.is_override,
      'override_reason', a.override_reason,
      'created_at', a.created_at
    )
    order by a.created_at
  ), '[]'::jsonb)
  into v_rows
  from public.department_capacity_allocations a
  where a.department = p_department
    and a.planned_start_month = v_month
    and a.status = 'active';

  return jsonb_build_object(
    'department', p_department,
    'planned_start_month', v_month,
    'max_accepted_projects', v_max,
    'used', v_used,
    'remaining', greatest(0, v_max - v_used),
    'is_full', v_used >= v_max,
    'allocations', v_rows
  );
end;
$$;

create or replace function public.admin_update_department_monthly_capacity_settings(
  p_department text,
  p_max_accepted_projects integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.web_atelier_require_admin();
  if p_department is null or p_department not in ('web_atelier', 'interiors', 'lrc') then
    raise exception 'booking_invalid_department';
  end if;
  if p_max_accepted_projects is null
     or p_max_accepted_projects < 0
     or p_max_accepted_projects > 50 then
    raise exception 'capacity_max_invalid';
  end if;

  insert into public.department_monthly_capacity_settings (
    department, max_accepted_projects, updated_by, updated_at
  ) values (
    p_department, p_max_accepted_projects, auth.uid(), pg_catalog.now()
  )
  on conflict (department) do update
  set
    max_accepted_projects = excluded.max_accepted_projects,
    updated_by = auth.uid(),
    updated_at = pg_catalog.now();

  return public.admin_list_department_month_capacity(
    p_department,
    date_trunc('month', (pg_catalog.now() at time zone 'Europe/Zagreb')::date)::date
  );
end;
$$;

create or replace function public.admin_allocate_department_capacity(
  p_department text,
  p_planned_start_month date,
  p_title text,
  p_source_kind text default 'manual',
  p_source_id uuid default null,
  p_notes text default null,
  p_is_override boolean default false,
  p_override_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date;
  v_id uuid;
  v_kind text;
  v_title text;
  v_override boolean;
  v_reason text;
begin
  perform public.web_atelier_require_admin();
  if p_department is null or p_department not in ('web_atelier', 'interiors', 'lrc') then
    raise exception 'booking_invalid_department';
  end if;
  v_month := date_trunc('month', p_planned_start_month)::date;
  v_kind := coalesce(nullif(btrim(p_source_kind), ''), 'manual');
  if v_kind not in ('manual', 'web_atelier_project', 'interiors_project') then
    raise exception 'capacity_source_invalid';
  end if;
  if v_kind = 'manual' then
    p_source_id := null;
  elsif p_source_id is null then
    raise exception 'capacity_source_id_required';
  end if;

  v_title := left(btrim(coalesce(p_title, '')), 200);
  if char_length(v_title) < 1 then
    raise exception 'capacity_title_required';
  end if;

  v_override := coalesce(p_is_override, false);
  v_reason := nullif(btrim(coalesce(p_override_reason, '')), '');
  if v_override and v_reason is null then
    raise exception 'capacity_override_reason_required';
  end if;
  if not v_override then
    v_reason := null;
  end if;

  perform public.booking_lock_department_month(p_department, v_month);

  if not v_override
     and not public.booking_department_month_has_capacity(p_department, v_month) then
    raise exception 'booking_month_capacity_full';
  end if;

  insert into public.department_capacity_allocations (
    department, planned_start_month, source_kind, source_id, status,
    title, notes, is_override, override_reason, created_by
  ) values (
    p_department, v_month, v_kind, p_source_id, 'active',
    v_title, nullif(btrim(coalesce(p_notes, '')), ''),
    v_override, v_reason, auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object(
    'allocation_id', v_id,
    'department', p_department,
    'planned_start_month', v_month,
    'is_override', v_override,
    'snapshot', public.admin_list_department_month_capacity(p_department, v_month)
  );
end;
$$;

create or replace function public.admin_release_department_capacity(
  p_allocation_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.web_atelier_require_admin();
  update public.department_capacity_allocations a
  set
    status = 'released',
    notes = case
      when nullif(btrim(coalesce(p_reason, '')), '') is null then a.notes
      else left(coalesce(a.notes || E'\n', '') || btrim(p_reason), 2000)
    end,
    updated_at = pg_catalog.now()
  where a.id = p_allocation_id and a.status = 'active';
  if not found then
    raise exception 'capacity_allocation_not_found';
  end if;
end;
$$;

drop function if exists public.admin_create_manual_booking(
  uuid, timestamptz, timestamptz, text, text, text, text, text, text, text, text, text, text, uuid
);

create or replace function public.admin_create_manual_booking(
  p_window_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_contact_name text,
  p_department text default null,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_description text default null,
  p_source text default 'admin',
  p_booking_kind text default 'consultation',
  p_status text default 'confirmed',
  p_notes text default null,
  p_entity_kind text default 'booking_lead',
  p_entity_id uuid default null,
  p_month_capacity_override boolean default false,
  p_month_capacity_override_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window public.department_availability_windows%rowtype;
  v_id uuid;
  v_title text;
  v_entity_kind text;
  v_month date;
  v_override boolean;
begin
  perform public.web_atelier_require_admin();
  v_window := public.department_lock_availability_window(p_window_id);

  if p_department is not null and p_department is distinct from v_window.department then
    raise exception 'reservation_department_mismatch';
  end if;

  v_title := left(btrim(coalesce(p_contact_name, '')), 200);
  if char_length(v_title) < 1 then
    raise exception 'booking_contact_name_required';
  end if;

  v_entity_kind := coalesce(nullif(btrim(coalesce(p_entity_kind, '')), ''), 'booking_lead');
  if v_entity_kind = 'booking_lead' then
    p_entity_id := null;
  elsif p_entity_id is null then
    raise exception 'booking_entity_id_required';
  end if;

  v_override := coalesce(p_month_capacity_override, false);
  if v_override then
    if nullif(btrim(coalesce(p_month_capacity_override_reason, '')), '') is null then
      raise exception 'capacity_override_reason_required';
    end if;
    perform set_config('booking.allow_month_capacity_override', 'on', true);
  end if;

  if coalesce(p_booking_kind, 'consultation') = 'consultation'
     and coalesce(p_status, 'confirmed') = 'confirmed' then
    v_month := date_trunc(
      'month', (p_starts_at at time zone 'Europe/Zagreb')::date
    )::date;
    perform public.booking_lock_department_month(v_window.department, v_month);
    if not v_override
       and not public.booking_department_month_has_capacity(v_window.department, v_month) then
      raise exception 'booking_month_capacity_full';
    end if;
  end if;

  insert into public.department_reservations (
    department, window_id, starts_at, ends_at, status,
    entity_kind, entity_id, title, notes, created_by,
    booking_kind, source, contact_name, contact_email, contact_phone,
    description
  ) values (
    v_window.department, p_window_id, p_starts_at, p_ends_at,
    coalesce(nullif(btrim(p_status), ''), 'confirmed'),
    v_entity_kind, p_entity_id, v_title,
    case
      when v_override then
        left(
          coalesce(nullif(btrim(coalesce(p_notes, '')), '') || E'\n', '')
            || 'month_capacity_override: ' || btrim(p_month_capacity_override_reason),
          2000
        )
      else nullif(btrim(coalesce(p_notes, '')), '')
    end,
    auth.uid(),
    coalesce(nullif(btrim(p_booking_kind), ''), 'consultation'),
    coalesce(nullif(btrim(p_source), ''), 'admin'),
    v_title,
    nullif(btrim(coalesce(p_contact_email, '')), ''),
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    nullif(btrim(coalesce(p_description, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_get_booking_shared_settings()
  from public, anon, authenticated, service_role;
revoke all on function public.admin_update_booking_shared_settings(
  integer, integer, text, integer, boolean, time, time
) from public, anon, authenticated, service_role;
revoke all on function public.admin_create_availability_closure(
  timestamptz, timestamptz, text, text, text, date
) from public, anon, authenticated, service_role;
revoke all on function public.admin_set_closure_recurrence(uuid, text, date)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_booking_calendar(text, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_department_month_capacity(text, date)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_update_department_monthly_capacity_settings(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_allocate_department_capacity(
  text, date, text, text, uuid, text, boolean, text
) from public, anon, authenticated, service_role;
revoke all on function public.admin_release_department_capacity(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_create_manual_booking(
  uuid, timestamptz, timestamptz, text, text, text, text, text, text, text, text, text, text, uuid,
  boolean, text
) from public, anon, authenticated, service_role;

grant execute on function public.admin_get_booking_shared_settings() to authenticated;
grant execute on function public.admin_update_booking_shared_settings(
  integer, integer, text, integer, boolean, time, time
) to authenticated;
grant execute on function public.admin_create_availability_closure(
  timestamptz, timestamptz, text, text, text, date
) to authenticated;
grant execute on function public.admin_set_closure_recurrence(uuid, text, date) to authenticated;
grant execute on function public.admin_list_booking_calendar(text, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.admin_list_department_month_capacity(text, date) to authenticated;
grant execute on function public.admin_update_department_monthly_capacity_settings(text, integer)
  to authenticated;
grant execute on function public.admin_allocate_department_capacity(
  text, date, text, text, uuid, text, boolean, text
) to authenticated;
grant execute on function public.admin_release_department_capacity(uuid, text) to authenticated;
grant execute on function public.admin_create_manual_booking(
  uuid, timestamptz, timestamptz, text, text, text, text, text, text, text, text, text, text, uuid,
  boolean, text
) to authenticated;
