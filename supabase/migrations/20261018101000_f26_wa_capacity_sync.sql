-- F2.6 Smart Calendar 2.0 — Web Atelier capacity sync
-- Additive after 20261018100000. Do NOT auto-apply to production.
-- Wires accepted WA project lifecycle to department_capacity_allocations.
-- Interiors/LRC remain manual (no reliable accepted-project status).

do $preflight$
begin
  if to_regclass('public.department_capacity_allocations') is null then
    raise exception 'F2.6.2 WA capacity sync: apply 20261018100000 first';
  end if;
  if to_regclass('public.web_atelier_projects') is null then
    raise exception 'F2.6.2 WA capacity sync: web_atelier_projects missing';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- Internal helpers (service/admin SECURITY DEFINER callers only)
-- ---------------------------------------------------------------------------

create or replace function public.booking_sync_web_atelier_capacity_allocate(
  p_project_id uuid,
  p_title text,
  p_planned_start_month date,
  p_allow_override boolean default false,
  p_override_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date;
  v_id uuid;
  v_override boolean;
  v_reason text;
begin
  v_month := date_trunc('month', p_planned_start_month)::date;
  v_override := coalesce(p_allow_override, false);
  v_reason := nullif(btrim(coalesce(p_override_reason, '')), '');
  if v_override and v_reason is null then
    raise exception 'capacity_override_reason_required';
  end if;
  if not v_override then
    v_reason := null;
  end if;

  -- Idempotent: active allocation for this project already exists.
  select a.id into v_id
  from public.department_capacity_allocations a
  where a.department = 'web_atelier'
    and a.source_kind = 'web_atelier_project'
    and a.source_id = p_project_id
    and a.status = 'active';
  if found then
    if (select a.planned_start_month from public.department_capacity_allocations a where a.id = v_id)
       is distinct from v_month then
      perform public.booking_sync_web_atelier_capacity_move(p_project_id, v_month, v_override, v_reason);
      select a.id into v_id
      from public.department_capacity_allocations a
      where a.department = 'web_atelier'
        and a.source_kind = 'web_atelier_project'
        and a.source_id = p_project_id
        and a.status = 'active';
    end if;
    return v_id;
  end if;

  perform public.booking_lock_department_month('web_atelier', v_month);

  if not v_override
     and not public.booking_department_month_has_capacity('web_atelier', v_month) then
    raise exception 'booking_month_capacity_full';
  end if;

  insert into public.department_capacity_allocations (
    department, planned_start_month, source_kind, source_id, status,
    title, notes, is_override, override_reason, created_by
  ) values (
    'web_atelier', v_month, 'web_atelier_project', p_project_id, 'active',
    left(btrim(coalesce(p_title, 'Web Atelier project')), 200),
    'auto: admin_create_web_atelier_project_from_offer',
    v_override, v_reason, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.booking_sync_web_atelier_capacity_release(
  p_project_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.department_capacity_allocations a
  set
    status = 'released',
    notes = case
      when nullif(btrim(coalesce(p_reason, '')), '') is null then a.notes
      else left(coalesce(a.notes || E'\n', '') || btrim(p_reason), 2000)
    end,
    updated_at = pg_catalog.now()
  where a.department = 'web_atelier'
    and a.source_kind = 'web_atelier_project'
    and a.source_id = p_project_id
    and a.status = 'active';
end;
$$;

create or replace function public.booking_sync_web_atelier_capacity_move(
  p_project_id uuid,
  p_new_month date,
  p_allow_override boolean default false,
  p_override_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old date;
  v_new date;
  v_override boolean;
  v_reason text;
begin
  v_new := date_trunc('month', p_new_month)::date;
  v_override := coalesce(p_allow_override, false);
  v_reason := nullif(btrim(coalesce(p_override_reason, '')), '');
  if v_override and v_reason is null then
    raise exception 'capacity_override_reason_required';
  end if;

  select a.planned_start_month into v_old
  from public.department_capacity_allocations a
  where a.department = 'web_atelier'
    and a.source_kind = 'web_atelier_project'
    and a.source_id = p_project_id
    and a.status = 'active'
  for update;

  if not found then
    return;
  end if;
  if v_old = v_new then
    return;
  end if;

  -- Lock both months in stable order to avoid deadlocks.
  if v_old < v_new then
    perform public.booking_lock_department_month('web_atelier', v_old);
    perform public.booking_lock_department_month('web_atelier', v_new);
  else
    perform public.booking_lock_department_month('web_atelier', v_new);
    perform public.booking_lock_department_month('web_atelier', v_old);
  end if;

  if not v_override
     and not public.booking_department_month_has_capacity('web_atelier', v_new) then
    raise exception 'booking_month_capacity_full';
  end if;

  update public.department_capacity_allocations a
  set
    planned_start_month = v_new,
    is_override = case when v_override then true else a.is_override end,
    override_reason = case when v_override then v_reason else a.override_reason end,
    notes = left(
      coalesce(a.notes || E'\n', '') || 'moved planned_start_month ' || v_old::text || ' -> ' || v_new::text,
      2000
    ),
    updated_at = pg_catalog.now()
  where a.department = 'web_atelier'
    and a.source_kind = 'web_atelier_project'
    and a.source_id = p_project_id
    and a.status = 'active';
end;
$$;

revoke all on function public.booking_sync_web_atelier_capacity_allocate(uuid, text, date, boolean, text)
  from public, anon, authenticated, service_role;
revoke all on function public.booking_sync_web_atelier_capacity_release(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.booking_sync_web_atelier_capacity_move(uuid, date, boolean, text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Create project from accepted offer → allocate capacity
-- ---------------------------------------------------------------------------

-- Drop old 1-arg overload so PostgREST resolves the new signature cleanly.
drop function if exists public.admin_create_web_atelier_project_from_offer(uuid);

create or replace function public.admin_create_web_atelier_project_from_offer(
  p_offer_id uuid,
  p_planned_start_month date default null,
  p_capacity_override boolean default false,
  p_capacity_override_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.web_atelier_offers%rowtype;
  v_approval_id uuid;
  v_project public.web_atelier_projects%rowtype;
  v_id uuid;
  v_number text;
  v_inquiry_id uuid;
  v_month date;
  v_alloc uuid;
begin
  perform public.web_atelier_require_admin();

  select o.inquiry_id into v_inquiry_id
  from public.web_atelier_offers o
  where o.id = p_offer_id;
  if v_inquiry_id is null then
    raise exception 'offer_not_found';
  end if;

  perform public.web_atelier_lock_inquiry(v_inquiry_id);
  v_offer := public.web_atelier_lock_offer(p_offer_id);

  if v_offer.status <> 'accepted' then
    raise exception 'offer_not_accepted';
  end if;

  select a.id into v_approval_id
  from public.web_atelier_approvals a
  where a.offer_id = p_offer_id
    and a.decision = 'accepted'
    and a.offer_snapshot_sha256 = v_offer.snapshot_sha256;

  if v_approval_id is null then
    raise exception 'offer_acceptance_record_required';
  end if;

  select * into v_project
  from public.web_atelier_projects p
  where p.offer_id = p_offer_id;

  if found then
    return jsonb_build_object(
      'project_id', v_project.id,
      'project_number', v_project.project_number,
      'created', false,
      'planned_start_month', v_project.planned_start_month
    );
  end if;

  v_month := date_trunc(
    'month',
    coalesce(
      p_planned_start_month,
      (pg_catalog.now() at time zone 'Europe/Zagreb')::date
    )
  )::date;

  v_number := public.web_atelier_format_ref(
    'WP', pg_catalog.nextval('public.web_atelier_project_ref_seq')
  );

  insert into public.web_atelier_projects (
    project_number, department, inquiry_id, offer_id, approval_id, scope_version_id,
    title, client_name, client_email, currency, agreed_total_cents, status,
    planned_start_month, created_by
  )
  values (
    v_number, v_offer.department, v_offer.inquiry_id, v_offer.id, v_approval_id,
    v_offer.scope_version_id, v_offer.title, v_offer.client_name, v_offer.client_email,
    v_offer.currency, v_offer.total_cents, 'preparing',
    v_month, auth.uid()
  )
  returning id into v_id;

  insert into public.web_atelier_project_events (project_id, event_type, to_status, actor)
  values (v_id, 'project_created', 'preparing', auth.uid());

  v_alloc := public.booking_sync_web_atelier_capacity_allocate(
    v_id, v_offer.title, v_month, coalesce(p_capacity_override, false), p_capacity_override_reason
  );

  return jsonb_build_object(
    'project_id', v_id,
    'project_number', v_number,
    'created', true,
    'planned_start_month', v_month,
    'capacity_allocation_id', v_alloc
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Update project: planned_start_month move + cancel releases capacity
-- ---------------------------------------------------------------------------

create or replace function public.admin_update_web_atelier_project(
  p_project_id uuid,
  p_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.web_atelier_projects%rowtype;
  v_key text;
  v_new_status text;
  v_details_changed boolean := false;
  v_new_month date;
  v_override boolean := false;
  v_override_reason text := null;
begin
  perform public.web_atelier_require_admin();

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch_invalid';
  end if;

  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in (
      'title', 'notes', 'status', 'planned_start_month',
      'capacity_override', 'capacity_override_reason'
    ) then
      raise exception 'patch_unknown_key';
    end if;
  end loop;

  select * into v_project
  from public.web_atelier_projects p
  where p.id = p_project_id
  for update;

  if not found then
    raise exception 'project_not_found';
  end if;

  v_new_status := case when jsonb_exists(p_patch, 'status') then p_patch ->> 'status' else v_project.status end;
  if v_new_status is null
    or v_new_status not in (
      'preparing', 'waiting_for_client', 'ready_to_start', 'scheduled',
      'in_progress', 'client_review', 'revision', 'final_approval',
      'completed', 'on_hold', 'cancelled'
    )
  then
    raise exception 'project_status_invalid';
  end if;

  if jsonb_exists(p_patch, 'capacity_override') then
    v_override := coalesce((p_patch ->> 'capacity_override')::boolean, false);
  end if;
  if jsonb_exists(p_patch, 'capacity_override_reason') then
    v_override_reason := nullif(btrim(coalesce(p_patch ->> 'capacity_override_reason', '')), '');
  end if;

  if jsonb_exists(p_patch, 'title') and btrim(coalesce(p_patch ->> 'title', '')) is distinct from v_project.title then
    v_details_changed := true;
  end if;
  if jsonb_exists(p_patch, 'notes')
    and nullif(btrim(coalesce(p_patch ->> 'notes', '')), '') is distinct from v_project.notes
  then
    v_details_changed := true;
  end if;

  if jsonb_exists(p_patch, 'planned_start_month') then
    v_new_month := date_trunc('month', (p_patch ->> 'planned_start_month')::date)::date;
  else
    v_new_month := v_project.planned_start_month;
  end if;

  -- Backfill planned start for legacy projects that predate Smart Calendar 2.0.
  if v_new_month is null and v_new_status is distinct from 'cancelled' then
    v_new_month := date_trunc(
      'month', (pg_catalog.now() at time zone 'Europe/Zagreb')::date
    )::date;
  end if;

  update public.web_atelier_projects p
  set title = case when jsonb_exists(p_patch, 'title') then btrim(coalesce(p_patch ->> 'title', '')) else p.title end,
      notes = case when jsonb_exists(p_patch, 'notes')
        then nullif(btrim(coalesce(p_patch ->> 'notes', '')), '') else p.notes end,
      status = v_new_status,
      planned_start_month = case
        when v_new_status = 'cancelled' then p.planned_start_month
        else coalesce(v_new_month, p.planned_start_month)
      end
  where p.id = p_project_id;

  if v_new_status is distinct from v_project.status then
    insert into public.web_atelier_project_events (
      project_id, event_type, from_status, to_status, actor
    )
    values (p_project_id, 'status_changed', v_project.status, v_new_status, auth.uid());
  end if;

  if v_details_changed then
    insert into public.web_atelier_project_events (project_id, event_type, actor)
    values (p_project_id, 'details_updated', auth.uid());
  end if;

  -- Capacity lifecycle
  if v_new_status = 'cancelled' and v_project.status is distinct from 'cancelled' then
    perform public.booking_sync_web_atelier_capacity_release(p_project_id, 'project cancelled');
  elsif v_new_status is distinct from 'cancelled' then
    if v_project.planned_start_month is distinct from v_new_month and v_new_month is not null then
      perform public.booking_sync_web_atelier_capacity_move(
        p_project_id, v_new_month, v_override, v_override_reason
      );
    end if;
    -- Ensure allocation exists if project was created before sync migration
    if v_new_month is not null then
      perform public.booking_sync_web_atelier_capacity_allocate(
        p_project_id,
        coalesce(
          case when jsonb_exists(p_patch, 'title') then btrim(coalesce(p_patch ->> 'title', '')) end,
          v_project.title
        ),
        v_new_month,
        v_override,
        v_override_reason
      );
    end if;
  end if;
end;
$$;

revoke all on function public.admin_create_web_atelier_project_from_offer(uuid, date, boolean, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_update_web_atelier_project(uuid, jsonb)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_create_web_atelier_project_from_offer(uuid, date, boolean, text)
  to authenticated;
grant execute on function public.admin_update_web_atelier_project(uuid, jsonb)
  to authenticated;

comment on function public.admin_create_web_atelier_project_from_offer(uuid, date, boolean, text) is
  'Creates WA project from accepted offer and allocates monthly accepted-project capacity (default start = current Zagreb month).';
comment on function public.booking_sync_web_atelier_capacity_allocate(uuid, text, date, boolean, text) is
  'Internal: link web_atelier_project to department_capacity_allocations.';
