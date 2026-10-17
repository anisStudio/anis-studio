-- F2.6 Smart Booking & Shared Availability
-- Additive after 20261017120000. Do NOT auto-apply to production from the app.
-- Reuses G–I department_availability_windows / department_reservations.
-- Default: one shared confirmed consultation slot across all departments.
-- Closures never silently move/cancel bookings. No auto emails/SMS/payments.

-- ---------------------------------------------------------------------------
-- Preflight
-- ---------------------------------------------------------------------------

do $preflight$
begin
  if to_regclass('public.department_availability_windows') is null
     or to_regclass('public.department_reservations') is null then
    raise exception 'F2.6: G–I availability tables missing (apply 20261017010000 first)';
  end if;
  if to_regprocedure('public.web_atelier_require_admin()') is null then
    raise exception 'F2.6: web_atelier_require_admin() missing';
  end if;
  if to_regprocedure('public.department_reservation_capacity_ok(uuid,uuid,timestamptz,timestamptz)') is null then
    raise exception 'F2.6: department_reservation_capacity_ok missing';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- Shared settings (singleton)
-- ---------------------------------------------------------------------------

create table public.booking_shared_settings (
  id smallint primary key default 1 check (id = 1),
  shared_consultation_capacity integer not null default 1
    check (shared_consultation_capacity >= 1 and shared_consultation_capacity <= 50),
  default_slot_minutes integer not null default 60
    check (default_slot_minutes >= 15 and default_slot_minutes <= 480),
  notes text,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now(),
  constraint booking_shared_settings_notes_len
    check (notes is null or char_length(notes) < 5000)
);

insert into public.booking_shared_settings (id, shared_consultation_capacity)
values (1, 1)
on conflict (id) do nothing;

comment on table public.booking_shared_settings is
  'F2.6 singleton: shared consultation capacity across web_atelier/interiors/lrc.';

-- ---------------------------------------------------------------------------
-- Closures (admin reason private; never shown publicly)
-- ---------------------------------------------------------------------------

create table public.availability_closures (
  id uuid primary key default gen_random_uuid(),
  department text
    check (department is null or department in ('web_atelier', 'interiors', 'lrc')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint availability_closures_range check (ends_at > starts_at),
  constraint availability_closures_reason_len
    check (reason is null or char_length(reason) < 2000)
);

create index availability_closures_active_range_idx
  on public.availability_closures (is_active, starts_at, ends_at)
  where is_active;

comment on column public.availability_closures.department is
  'NULL = global closure across all departments.';
comment on column public.availability_closures.reason is
  'Admin-only; never returned by public availability RPCs.';

-- ---------------------------------------------------------------------------
-- Reservation booking metadata (additive columns)
-- ---------------------------------------------------------------------------

alter table public.department_reservations
  add column if not exists booking_kind text not null default 'consultation',
  add column if not exists source text,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists description text,
  add column if not exists consultation_outcome text,
  add column if not exists cancel_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists slot_released_at timestamptz,
  add column if not exists idempotency_key uuid,
  add column if not exists public_client_fingerprint text;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'department_reservations_booking_kind_check'
  ) then
    alter table public.department_reservations
      add constraint department_reservations_booking_kind_check
      check (booking_kind in ('consultation', 'production'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'department_reservations_source_check'
  ) then
    alter table public.department_reservations
      add constraint department_reservations_source_check
      check (
        source is null
        or source in (
          'web', 'phone', 'facebook', 'instagram', 'whatsapp',
          'personal', 'admin', 'other'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'department_reservations_consultation_outcome_check'
  ) then
    alter table public.department_reservations
      add constraint department_reservations_consultation_outcome_check
      check (
        consultation_outcome is null
        or consultation_outcome in (
          'info_sufficient', 'clarification_needed', 'consultation_completed'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'department_reservations_idempotency_key_key'
  ) then
    alter table public.department_reservations
      add constraint department_reservations_idempotency_key_key unique (idempotency_key);
  end if;
end
$constraints$;

-- Expand entity_kind allow-list (keep existing values).
alter table public.department_reservations
  drop constraint if exists department_reservations_entity_kind_check;

alter table public.department_reservations
  add constraint department_reservations_entity_kind_check
  check (entity_kind in (
    'web_atelier_project',
    'web_atelier_inquiry',
    'interiors_project',
    'interiors_inquiry',
    'lrc_inquiry',
    'booking_lead',
    'unlinked'
  ));

alter table public.department_reservations
  drop constraint if exists department_reservations_entity_shape;

alter table public.department_reservations
  add constraint department_reservations_entity_shape check (
    (entity_kind in ('unlinked', 'booking_lead') and entity_id is null)
    or (entity_kind not in ('unlinked', 'booking_lead') and entity_id is not null)
  );

create index if not exists department_reservations_consultation_overlap_idx
  on public.department_reservations (status, booking_kind, starts_at, ends_at)
  where status = 'confirmed' and booking_kind = 'consultation' and slot_released_at is null;

-- ---------------------------------------------------------------------------
-- Reschedule audit (never delete history)
-- ---------------------------------------------------------------------------

create table public.reservation_reschedule_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null
    references public.department_reservations (id) on delete restrict,
  previous_starts_at timestamptz not null,
  previous_ends_at timestamptz not null,
  previous_window_id uuid
    references public.department_availability_windows (id) on delete set null,
  new_starts_at timestamptz not null,
  new_ends_at timestamptz not null,
  new_window_id uuid
    references public.department_availability_windows (id) on delete set null,
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint reservation_reschedule_events_reason_len
    check (reason is null or char_length(reason) < 2000)
);

create index reservation_reschedule_events_reservation_idx
  on public.reservation_reschedule_events (reservation_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Public booking rate limit (narrow, no PII in key beyond hashed fingerprint)
-- ---------------------------------------------------------------------------

create table public.booking_public_rate_limits (
  bucket_key text primary key,
  hit_count integer not null default 0 check (hit_count >= 0),
  window_started_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.booking_shared_settings enable row level security;
alter table public.availability_closures enable row level security;
alter table public.reservation_reschedule_events enable row level security;
alter table public.booking_public_rate_limits enable row level security;

revoke all on table public.booking_shared_settings from public, anon, authenticated, service_role;
revoke all on table public.availability_closures from public, anon, authenticated, service_role;
revoke all on table public.reservation_reschedule_events from public, anon, authenticated, service_role;
revoke all on table public.booking_public_rate_limits from public, anon, authenticated, service_role;

grant select on table public.booking_shared_settings to authenticated;
grant select on table public.availability_closures to authenticated;
grant select on table public.reservation_reschedule_events to authenticated;

create policy booking_shared_settings_admin_select
  on public.booking_shared_settings for select to authenticated
  using (public.is_admin());

create policy availability_closures_admin_select
  on public.availability_closures for select to authenticated
  using (public.is_admin());

create policy reservation_reschedule_events_admin_select
  on public.reservation_reschedule_events for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Capacity helpers (shared + closures)
-- ---------------------------------------------------------------------------

create or replace function public.booking_lock_shared_settings()
returns public.booking_shared_settings
language plpgsql
set search_path = ''
as $$
declare
  v_row public.booking_shared_settings%rowtype;
begin
  select * into v_row
  from public.booking_shared_settings s
  where s.id = 1
  for update;
  if not found then
    insert into public.booking_shared_settings (id, shared_consultation_capacity)
    values (1, 1)
    returning * into v_row;
    select * into v_row from public.booking_shared_settings s where s.id = 1 for update;
  end if;
  return v_row;
end;
$$;

revoke all on function public.booking_lock_shared_settings()
  from public, anon, authenticated, service_role;

create or replace function public.booking_interval_is_closed(
  p_department text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.availability_closures c
    where c.is_active
      and c.starts_at < p_ends_at
      and c.ends_at > p_starts_at
      and (c.department is null or c.department = p_department)
  );
$$;

revoke all on function public.booking_interval_is_closed(text, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.booking_consultation_shared_capacity_ok(
  p_reservation_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_settings public.booking_shared_settings%rowtype;
  v_count integer;
begin
  v_settings := public.booking_lock_shared_settings();

  -- Lock overlapping confirmed consultations in id order (cross-department).
  perform 1
  from public.department_reservations r
  where r.status = 'confirmed'
    and r.booking_kind = 'consultation'
    and r.slot_released_at is null
    and (p_reservation_id is null or r.id <> p_reservation_id)
    and r.starts_at < p_ends_at
    and r.ends_at > p_starts_at
  order by r.id
  for update;

  select count(*)::integer into v_count
  from public.department_reservations r
  where r.status = 'confirmed'
    and r.booking_kind = 'consultation'
    and r.slot_released_at is null
    and (p_reservation_id is null or r.id <> p_reservation_id)
    and r.starts_at < p_ends_at
    and r.ends_at > p_starts_at;

  if v_count >= v_settings.shared_consultation_capacity then
    raise exception 'shared_consultation_capacity_exceeded';
  end if;
end;
$$;

revoke all on function public.booking_consultation_shared_capacity_ok(uuid, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;

-- Keep window capacity; shared check runs from the trigger for consultations.
create or replace function public.department_reservation_capacity_ok(
  p_window_id uuid,
  p_reservation_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_window public.department_availability_windows%rowtype;
  v_count integer;
begin
  v_window := public.department_lock_availability_window(p_window_id);

  if p_starts_at < v_window.starts_at or p_ends_at > v_window.ends_at then
    raise exception 'reservation_outside_window';
  end if;

  perform 1
  from public.department_reservations r
  where r.window_id = p_window_id
    and r.status = 'confirmed'
    and r.slot_released_at is null
    and (p_reservation_id is null or r.id <> p_reservation_id)
    and r.starts_at < p_ends_at
    and r.ends_at > p_starts_at
  order by r.id
  for update;

  select count(*)::integer into v_count
  from public.department_reservations r
  where r.window_id = p_window_id
    and r.status = 'confirmed'
    and r.slot_released_at is null
    and (p_reservation_id is null or r.id <> p_reservation_id)
    and r.starts_at < p_ends_at
    and r.ends_at > p_starts_at;

  if v_count >= v_window.capacity then
    raise exception 'reservation_capacity_exceeded';
  end if;
end;
$$;

create or replace function public.department_reservations_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_window public.department_availability_windows%rowtype;
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
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: shared settings
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
    'updated_at', v_row.updated_at
  );
end;
$$;

create or replace function public.admin_update_booking_shared_settings(
  p_shared_consultation_capacity integer default null,
  p_default_slot_minutes integer default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.web_atelier_require_admin();
  perform public.booking_lock_shared_settings();

  update public.booking_shared_settings s
  set
    shared_consultation_capacity = coalesce(
      p_shared_consultation_capacity, s.shared_consultation_capacity
    ),
    default_slot_minutes = coalesce(p_default_slot_minutes, s.default_slot_minutes),
    notes = case when p_notes is null then s.notes else nullif(btrim(p_notes), '') end,
    updated_by = auth.uid(),
    updated_at = pg_catalog.now()
  where s.id = 1;

  return public.admin_get_booking_shared_settings();
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: closures (warn on conflicts; never auto-cancel)
-- ---------------------------------------------------------------------------

create or replace function public.admin_create_availability_closure(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_department text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_conflicts jsonb;
begin
  perform public.web_atelier_require_admin();

  if p_ends_at <= p_starts_at then
    raise exception 'closure_invalid_range';
  end if;
  if p_department is not null
     and p_department not in ('web_atelier', 'interiors', 'lrc') then
    raise exception 'closure_invalid_department';
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
    department, starts_at, ends_at, reason, created_by
  ) values (
    p_department, p_starts_at, p_ends_at, nullif(btrim(coalesce(p_reason, '')), ''), auth.uid()
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

create or replace function public.admin_reopen_availability_closure(p_closure_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.web_atelier_require_admin();
  update public.availability_closures c
  set is_active = false, updated_at = pg_catalog.now()
  where c.id = p_closure_id and c.is_active;
  if not found then
    -- UPDATE sets FOUND when a row is matched.
    raise exception 'closure_not_found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: enhanced calendar bundle
-- ---------------------------------------------------------------------------

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
begin
  perform public.web_atelier_require_admin();

  v_base := public.admin_list_department_availability(p_department, p_from, p_to);
  v_settings := public.admin_get_booking_shared_settings();

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'department', c.department,
      'starts_at', c.starts_at,
      'ends_at', c.ends_at,
      'reason', c.reason,
      'is_active', c.is_active,
      'created_at', c.created_at
    )
    order by c.starts_at, c.created_at
  ), '[]'::jsonb)
  into v_closures
  from public.availability_closures c
  where c.is_active
    and (p_department is null or c.department is null or c.department = p_department)
    and (p_from is null or c.ends_at > p_from)
    and (p_to is null or c.starts_at < p_to);

  -- Enrich reservations with F2.6 fields (admin-only PII).
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

  return jsonb_build_object(
    'windows', coalesce(v_base->'windows', '[]'::jsonb),
    'reservations', v_history,
    'closures', v_closures,
    'settings', v_settings
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: manual booking + reschedule + cancel + outcome + release
-- ---------------------------------------------------------------------------

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
  p_entity_id uuid default null
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
  end if;

  insert into public.department_reservations (
    department, window_id, starts_at, ends_at, status,
    entity_kind, entity_id, title, notes, created_by,
    booking_kind, source, contact_name, contact_email, contact_phone, description
  ) values (
    v_window.department, p_window_id, p_starts_at, p_ends_at,
    coalesce(nullif(btrim(coalesce(p_status, '')), ''), 'confirmed'),
    v_entity_kind, p_entity_id, v_title, p_notes, auth.uid(),
    coalesce(nullif(btrim(coalesce(p_booking_kind, '')), ''), 'consultation'),
    coalesce(nullif(btrim(coalesce(p_source, '')), ''), 'admin'),
    v_title,
    nullif(btrim(coalesce(p_contact_email, '')), ''),
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    nullif(btrim(coalesce(p_description, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.admin_reschedule_reservation(
  p_reservation_id uuid,
  p_window_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.department_reservations%rowtype;
  v_window public.department_availability_windows%rowtype;
begin
  perform public.web_atelier_require_admin();

  select * into v_row
  from public.department_reservations r
  where r.id = p_reservation_id
  for update;
  if not found then
    raise exception 'reservation_not_found';
  end if;
  if v_row.status = 'cancelled' then
    raise exception 'reservation_already_cancelled';
  end if;

  v_window := public.department_lock_availability_window(p_window_id);
  if v_window.department is distinct from v_row.department then
    raise exception 'reservation_department_mismatch';
  end if;

  insert into public.reservation_reschedule_events (
    reservation_id,
    previous_starts_at, previous_ends_at, previous_window_id,
    new_starts_at, new_ends_at, new_window_id,
    reason, created_by
  ) values (
    p_reservation_id,
    v_row.starts_at, v_row.ends_at, v_row.window_id,
    p_starts_at, p_ends_at, p_window_id,
    nullif(btrim(coalesce(p_reason, '')), ''), auth.uid()
  );

  update public.department_reservations r
  set
    window_id = p_window_id,
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    slot_released_at = null,
    updated_at = pg_catalog.now()
  where r.id = p_reservation_id;
end;
$$;

create or replace function public.admin_cancel_reservation_with_reason(
  p_reservation_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
begin
  perform public.web_atelier_require_admin();
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 1 then
    raise exception 'cancel_reason_required';
  end if;

  update public.department_reservations r
  set
    status = 'cancelled',
    cancel_reason = left(v_reason, 2000),
    cancelled_at = pg_catalog.now(),
    updated_at = pg_catalog.now()
  where r.id = p_reservation_id
    and r.status is distinct from 'cancelled';

  if not found then
    raise exception 'reservation_not_found';
  end if;
end;
$$;

create or replace function public.admin_set_consultation_outcome(
  p_reservation_id uuid,
  p_outcome text,
  p_release_slot boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.web_atelier_require_admin();

  if p_outcome is not null and p_outcome not in (
    'info_sufficient', 'clarification_needed', 'consultation_completed'
  ) then
    raise exception 'invalid_consultation_outcome';
  end if;

  update public.department_reservations r
  set
    consultation_outcome = p_outcome,
    slot_released_at = case
      when p_release_slot then pg_catalog.now()
      else r.slot_released_at
    end,
    updated_at = pg_catalog.now()
  where r.id = p_reservation_id;

  if not found then
    raise exception 'reservation_not_found';
  end if;
end;
$$;

create or replace function public.admin_list_reservation_reschedule_history(
  p_reservation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  perform public.web_atelier_require_admin();

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'previous_starts_at', e.previous_starts_at,
      'previous_ends_at', e.previous_ends_at,
      'previous_window_id', e.previous_window_id,
      'new_starts_at', e.new_starts_at,
      'new_ends_at', e.new_ends_at,
      'new_window_id', e.new_window_id,
      'reason', e.reason,
      'created_at', e.created_at
    )
    order by e.created_at desc
  ), '[]'::jsonb)
  into v_out
  from public.reservation_reschedule_events e
  where e.reservation_id = p_reservation_id;

  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public availability (no PII, no closure reasons)
-- ---------------------------------------------------------------------------

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
begin
  if p_department is null or p_department not in ('web_atelier', 'interiors', 'lrc') then
    raise exception 'booking_invalid_department';
  end if;
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'booking_invalid_range';
  end if;
  -- Cap public look-ahead to 120 days.
  if p_to > p_from + interval '120 days' then
    raise exception 'booking_range_too_large';
  end if;

  select * into v_settings from public.booking_shared_settings where id = 1;
  if not found then
    v_settings.shared_consultation_capacity := 1;
  end if;

  for v_win in
    select w.*
    from public.department_availability_windows w
    where w.department = p_department
      and w.ends_at > greatest(p_from, pg_catalog.now())
      and w.starts_at < p_to
    order by w.starts_at
  loop
    if public.booking_interval_is_closed(p_department, v_win.starts_at, v_win.ends_at) then
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
          'remaining', v_remaining
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'department', p_department,
    'slots', v_slots,
    'timezone', 'Europe/Zagreb',
    'notice_hr',
      'Rezervirajte termin za početak suradnje. Ako ste dovoljno detaljno opisali projekt, dogovor možemo dovršiti bez dodatnog razgovora.',
    'notice_en',
      'Book a slot to start cooperation. If your project details are sufficient, we can finalize without an extra call.'
  );
end;
$$;

create or replace function public.booking_public_rate_limit_check(
  p_bucket_key text,
  p_max_hits integer default 8,
  p_window_seconds integer default 3600
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_row public.booking_public_rate_limits%rowtype;
  v_now timestamptz := pg_catalog.now();
begin
  if p_bucket_key is null or char_length(p_bucket_key) < 8 then
    raise exception 'booking_rate_key_invalid';
  end if;

  insert into public.booking_public_rate_limits (bucket_key, hit_count, window_started_at)
  values (left(p_bucket_key, 200), 1, v_now)
  on conflict (bucket_key) do update
  set
    hit_count = case
      when public.booking_public_rate_limits.window_started_at
           <= v_now - make_interval(secs => p_window_seconds)
        then 1
      else public.booking_public_rate_limits.hit_count + 1
    end,
    window_started_at = case
      when public.booking_public_rate_limits.window_started_at
           <= v_now - make_interval(secs => p_window_seconds)
        then v_now
      else public.booking_public_rate_limits.window_started_at
    end,
    updated_at = v_now
  returning * into v_row;

  if v_row.hit_count > p_max_hits then
    raise exception 'booking_rate_limited';
  end if;
end;
$$;

revoke all on function public.booking_public_rate_limit_check(text, integer, integer)
  from public, anon, authenticated, service_role;

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

  -- Rate limit by email + optional fingerprint (no raw IP stored).
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

  -- Advisory xact lock reduces double-submit races before row locks.
  perform pg_advisory_xact_lock(
    8266001,
    hashtext(p_window_id::text)
  );

  v_window := public.department_lock_availability_window(p_window_id);
  if v_window.department is distinct from p_department then
    raise exception 'booking_window_department_mismatch';
  end if;
  if v_window.ends_at <= pg_catalog.now() then
    raise exception 'booking_slot_stale';
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
      if sqlerrm ~ 'capacity_exceeded|closed_period|outside_window' then
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

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.admin_get_booking_shared_settings()
  from public, anon, authenticated, service_role;
revoke all on function public.admin_update_booking_shared_settings(integer, integer, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_create_availability_closure(timestamptz, timestamptz, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_reopen_availability_closure(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_booking_calendar(text, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_create_manual_booking(uuid, timestamptz, timestamptz, text, text, text, text, text, text, text, text, text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_reschedule_reservation(uuid, uuid, timestamptz, timestamptz, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_cancel_reservation_with_reason(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_set_consultation_outcome(uuid, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_reservation_reschedule_history(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.public_list_consultation_availability(text, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.public_book_consultation_slot(text, uuid, text, text, text, text, uuid, text, text, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_get_booking_shared_settings() to authenticated;
grant execute on function public.admin_update_booking_shared_settings(integer, integer, text) to authenticated;
grant execute on function public.admin_create_availability_closure(timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.admin_reopen_availability_closure(uuid) to authenticated;
grant execute on function public.admin_list_booking_calendar(text, timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_create_manual_booking(uuid, timestamptz, timestamptz, text, text, text, text, text, text, text, text, text, text, uuid) to authenticated;
grant execute on function public.admin_reschedule_reservation(uuid, uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.admin_cancel_reservation_with_reason(uuid, text) to authenticated;
grant execute on function public.admin_set_consultation_outcome(uuid, text, boolean) to authenticated;
grant execute on function public.admin_list_reservation_reschedule_history(uuid) to authenticated;

grant execute on function public.public_list_consultation_availability(text, timestamptz, timestamptz)
  to anon, authenticated;
grant execute on function public.public_book_consultation_slot(text, uuid, text, text, text, text, uuid, text, text, uuid)
  to anon, authenticated;

comment on function public.public_list_consultation_availability(text, timestamptz, timestamptz) is
  'F2.6 public: available consultation windows only. No PII, no closure reasons.';
comment on function public.public_book_consultation_slot(text, uuid, text, text, text, text, uuid, text, text, uuid) is
  'F2.6 public atomic booking. Consumes shared+window capacity. Not offer/project/payment.';
