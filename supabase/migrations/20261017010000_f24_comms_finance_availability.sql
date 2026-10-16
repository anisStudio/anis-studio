-- F2.4 G–I — Communications, financial tracking, shared department availability.
--
-- STATUS: Additive migration for local review + controlled production later.
-- Do NOT auto-apply from this agent task to production.
--
-- G Communications
--   * Admin-only manual communication history on WA inquiry/offer/project.
--   * Channels: email, telephone, meeting, other. No automatic e-mail.
--   * Optional reusable admin templates (no send pipeline).
--
-- H Financial tracking
--   * Admin-only payment schedules, Parra document references, payment records.
--   * Parra remains authoritative for invoices / fiscalization / e-invoices.
--   * This schema NEVER generates invoice/fiscal numbers.
--   * Never auto-marks paid from offer/project status.
--   * Not exposed via public tracking tokens.
--
-- I Shared availability
--   * Department windows + reservations for web_atelier, interiors, lrc.
--   * Confirmed reservations cannot exceed window capacity.
--   * Offer acceptance does NOT create reservations.
--
-- Lock order extension (always ascending by id within each tier):
--   1) web_atelier_inquiries
--   2) web_atelier_offers
--   3) web_atelier_projects
--   4) web_atelier_project_tracking_tokens
--   5) web_atelier_material_requirements
--   6) web_atelier_communications / templates
--   7) web_atelier_payment_schedules / financial_documents / payment_records
--   8) department_availability_windows
--   9) department_reservations

-- ---------------------------------------------------------------------------
-- Preflight
-- ---------------------------------------------------------------------------

do $preflight$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'F2.4G-I: public.is_admin() is missing';
  end if;

  if to_regprocedure('public.web_atelier_require_admin()') is null then
    raise exception 'F2.4G-I: public.web_atelier_require_admin() is missing';
  end if;

  if to_regclass('public.web_atelier_projects') is null
    or to_regclass('public.web_atelier_offers') is null
    or to_regclass('public.web_atelier_inquiries') is null
  then
    raise exception 'F2.4G-I: Web Atelier C–F tables missing';
  end if;

  if to_regclass('public.web_atelier_communications') is not null
    or to_regclass('public.web_atelier_payment_schedules') is not null
    or to_regclass('public.department_availability_windows') is not null
  then
    raise exception 'F2.4G-I: target tables already exist';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- G — Communication templates + history
-- ---------------------------------------------------------------------------

create table public.admin_communication_templates (
  id uuid primary key default gen_random_uuid(),
  department text not null
    check (department in ('web_atelier', 'interiors', 'lrc', 'shared')),
  channel text not null
    check (channel in ('email', 'telephone', 'meeting', 'other')),
  name text not null,
  subject_template text,
  body_template text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint admin_communication_templates_name_len
    check (char_length(btrim(name)) between 1 and 200),
  constraint admin_communication_templates_body_len
    check (char_length(body_template) between 1 and 20000)
);

create unique index admin_communication_templates_dept_name_uidx
  on public.admin_communication_templates (department, lower(btrim(name)));

create table public.web_atelier_communications (
  id uuid primary key default gen_random_uuid(),
  channel text not null
    check (channel in ('email', 'telephone', 'meeting', 'other')),
  direction text not null
    check (direction in ('inbound', 'outbound', 'internal')),
  subject text,
  summary text not null,
  occurred_at timestamptz not null default pg_catalog.now(),
  inquiry_id uuid references public.web_atelier_inquiries (id) on delete set null,
  offer_id uuid references public.web_atelier_offers (id) on delete set null,
  project_id uuid references public.web_atelier_projects (id) on delete set null,
  template_id uuid references public.admin_communication_templates (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint web_atelier_communications_summary_len
    check (char_length(btrim(summary)) between 1 and 10000),
  constraint web_atelier_communications_subject_len
    check (subject is null or char_length(subject) between 1 and 500),
  constraint web_atelier_communications_entity_present
    check (inquiry_id is not null or offer_id is not null or project_id is not null)
);

create index web_atelier_communications_inquiry_idx
  on public.web_atelier_communications (inquiry_id, occurred_at desc);
create index web_atelier_communications_offer_idx
  on public.web_atelier_communications (offer_id, occurred_at desc);
create index web_atelier_communications_project_idx
  on public.web_atelier_communications (project_id, occurred_at desc);

create function public.web_atelier_communications_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'communication_delete_forbidden';
  end if;

  if new.inquiry_id is not null then
    perform 1 from public.web_atelier_inquiries i where i.id = new.inquiry_id;
    if not found then
      raise exception 'inquiry_not_found';
    end if;
  end if;

  if new.offer_id is not null then
    perform 1 from public.web_atelier_offers o where o.id = new.offer_id;
    if not found then
      raise exception 'offer_not_found';
    end if;
  end if;

  if new.project_id is not null then
    perform 1 from public.web_atelier_projects p where p.id = new.project_id;
    if not found then
      raise exception 'project_not_found';
    end if;
  end if;

  new.summary := btrim(new.summary);
  if new.subject is not null then
    new.subject := nullif(btrim(new.subject), '');
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger web_atelier_communications_guard_trg
  before insert or update or delete on public.web_atelier_communications
  for each row execute function public.web_atelier_communications_guard();

-- ---------------------------------------------------------------------------
-- H — Financial tracking (manual Parra references only)
-- ---------------------------------------------------------------------------

create table public.web_atelier_payment_schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.web_atelier_projects (id) on delete cascade,
  label text not null,
  due_date date,
  amount_cents bigint not null check (amount_cents >= 0 and amount_cents <= 100000000000),
  currency text not null default 'EUR' check (currency = 'EUR'),
  status text not null default 'planned'
    check (status in ('planned', 'due', 'paid', 'waived', 'cancelled')),
  notes text,
  position integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint web_atelier_payment_schedules_label_len
    check (char_length(btrim(label)) between 1 and 200),
  constraint web_atelier_payment_schedules_notes_len
    check (notes is null or char_length(notes) < 10000)
);

create index web_atelier_payment_schedules_project_idx
  on public.web_atelier_payment_schedules (project_id, position, due_date);

create table public.web_atelier_financial_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.web_atelier_projects (id) on delete cascade,
  doc_kind text not null
    check (doc_kind in ('parra_invoice', 'parra_proforma', 'credit_note', 'other')),
  external_reference text not null,
  issued_on date,
  amount_cents bigint check (amount_cents is null or (amount_cents >= 0 and amount_cents <= 100000000000)),
  currency text not null default 'EUR' check (currency = 'EUR'),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint web_atelier_financial_documents_ref_len
    check (char_length(btrim(external_reference)) between 1 and 200),
  constraint web_atelier_financial_documents_notes_len
    check (notes is null or char_length(notes) < 10000)
);

create index web_atelier_financial_documents_project_idx
  on public.web_atelier_financial_documents (project_id, created_at desc);

create table public.web_atelier_payment_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.web_atelier_projects (id) on delete cascade,
  schedule_id uuid references public.web_atelier_payment_schedules (id) on delete set null,
  document_id uuid references public.web_atelier_financial_documents (id) on delete set null,
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  currency text not null default 'EUR' check (currency = 'EUR'),
  paid_on date not null,
  method text not null
    check (method in ('bank_transfer', 'cash', 'card', 'other')),
  external_reference text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint web_atelier_payment_records_ref_len
    check (external_reference is null or char_length(external_reference) between 1 and 200),
  constraint web_atelier_payment_records_notes_len
    check (notes is null or char_length(notes) < 10000)
);

create index web_atelier_payment_records_project_idx
  on public.web_atelier_payment_records (project_id, paid_on desc);

create function public.web_atelier_finance_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'web_atelier_payment_schedules' then
    if tg_op = 'DELETE' then
      raise exception 'payment_schedule_delete_forbidden';
    end if;
    new.label := btrim(new.label);
    new.updated_at := pg_catalog.now();
    -- Status 'paid' may only be set by the payment-recording RPC (session flag).
    if tg_op = 'UPDATE'
      and new.status = 'paid'
      and old.status is distinct from 'paid'
      and coalesce(current_setting('anis.finance_allow_paid', true), '') is distinct from '1'
    then
      raise exception 'payment_status_paid_requires_payment_record';
    end if;
    return new;
  end if;

  if tg_table_name = 'web_atelier_financial_documents' then
    if tg_op = 'DELETE' then
      raise exception 'financial_document_delete_forbidden';
    end if;
    new.external_reference := btrim(new.external_reference);
    new.updated_at := pg_catalog.now();
    return new;
  end if;

  if tg_table_name = 'web_atelier_payment_records' then
    if tg_op = 'DELETE' then
      raise exception 'payment_record_delete_forbidden';
    end if;
    if tg_op = 'UPDATE' then
      raise exception 'payment_record_update_forbidden';
    end if;
    if new.external_reference is not null then
      new.external_reference := nullif(btrim(new.external_reference), '');
    end if;
    return new;
  end if;

  return new;
end;
$$;

create trigger web_atelier_payment_schedules_guard_trg
  before insert or update or delete on public.web_atelier_payment_schedules
  for each row execute function public.web_atelier_finance_guard();

create trigger web_atelier_financial_documents_guard_trg
  before insert or update or delete on public.web_atelier_financial_documents
  for each row execute function public.web_atelier_finance_guard();

create trigger web_atelier_payment_records_guard_trg
  before insert or update or delete on public.web_atelier_payment_records
  for each row execute function public.web_atelier_finance_guard();

-- ---------------------------------------------------------------------------
-- I — Shared department availability
-- ---------------------------------------------------------------------------

create table public.department_availability_windows (
  id uuid primary key default gen_random_uuid(),
  department text not null
    check (department in ('web_atelier', 'interiors', 'lrc')),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity >= 1 and capacity <= 100),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint department_availability_windows_range
    check (ends_at > starts_at),
  constraint department_availability_windows_title_len
    check (char_length(btrim(title)) between 1 and 200),
  constraint department_availability_windows_notes_len
    check (notes is null or char_length(notes) < 10000)
);

create index department_availability_windows_dept_range_idx
  on public.department_availability_windows (department, starts_at, ends_at);

create table public.department_reservations (
  id uuid primary key default gen_random_uuid(),
  department text not null
    check (department in ('web_atelier', 'interiors', 'lrc')),
  window_id uuid not null
    references public.department_availability_windows (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'cancelled')),
  entity_kind text not null
    check (entity_kind in (
      'web_atelier_project', 'interiors_project', 'lrc_inquiry', 'unlinked'
    )),
  entity_id uuid,
  title text not null,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint department_reservations_range check (ends_at > starts_at),
  constraint department_reservations_title_len
    check (char_length(btrim(title)) between 1 and 200),
  constraint department_reservations_notes_len
    check (notes is null or char_length(notes) < 10000),
  constraint department_reservations_entity_shape check (
    (entity_kind = 'unlinked' and entity_id is null)
    or (entity_kind <> 'unlinked' and entity_id is not null)
  )
);

create index department_reservations_window_status_idx
  on public.department_reservations (window_id, status, starts_at, ends_at);

create function public.department_lock_availability_window(p_window_id uuid)
returns public.department_availability_windows
language plpgsql
set search_path = ''
as $$
declare
  v_row public.department_availability_windows%rowtype;
begin
  select * into v_row
  from public.department_availability_windows w
  where w.id = p_window_id
  for update;
  if not found then
    raise exception 'availability_window_not_found';
  end if;
  return v_row;
end;
$$;

revoke all on function public.department_lock_availability_window(uuid)
  from public, anon, authenticated, service_role;

create function public.department_reservation_capacity_ok(
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

  -- Lock overlapping confirmed peers in id order to avoid deadlocks.
  perform 1
  from public.department_reservations r
  where r.window_id = p_window_id
    and r.status = 'confirmed'
    and (p_reservation_id is null or r.id <> p_reservation_id)
    and r.starts_at < p_ends_at
    and r.ends_at > p_starts_at
  order by r.id
  for update;

  select count(*)::integer into v_count
  from public.department_reservations r
  where r.window_id = p_window_id
    and r.status = 'confirmed'
    and (p_reservation_id is null or r.id <> p_reservation_id)
    and r.starts_at < p_ends_at
    and r.ends_at > p_starts_at;

  if v_count >= v_window.capacity then
    raise exception 'reservation_capacity_exceeded';
  end if;
end;
$$;

revoke all on function public.department_reservation_capacity_ok(uuid, uuid, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;

create function public.department_reservations_guard()
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

  -- Soft refs for interiors/lrc: presence checked only when tables exist.
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

  if new.status = 'confirmed' then
    perform public.department_reservation_capacity_ok(
      new.window_id,
      case when tg_op = 'UPDATE' then new.id else null end,
      new.starts_at,
      new.ends_at
    );
  end if;

  return new;
end;
$$;

create trigger department_reservations_guard_trg
  before insert or update or delete on public.department_reservations
  for each row execute function public.department_reservations_guard();

create function public.department_availability_windows_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.department_reservations r
      where r.window_id = old.id and r.status <> 'cancelled'
    ) then
      raise exception 'availability_window_has_active_reservations';
    end if;
    return old;
  end if;

  new.title := btrim(new.title);
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger department_availability_windows_guard_trg
  before insert or update or delete on public.department_availability_windows
  for each row execute function public.department_availability_windows_guard();

-- ---------------------------------------------------------------------------
-- RLS + grants (admin SELECT via is_admin; writes only through RPCs)
-- ---------------------------------------------------------------------------

alter table public.admin_communication_templates enable row level security;
alter table public.web_atelier_communications enable row level security;
alter table public.web_atelier_payment_schedules enable row level security;
alter table public.web_atelier_financial_documents enable row level security;
alter table public.web_atelier_payment_records enable row level security;
alter table public.department_availability_windows enable row level security;
alter table public.department_reservations enable row level security;

revoke all on table public.admin_communication_templates from public, anon, authenticated, service_role;
revoke all on table public.web_atelier_communications from public, anon, authenticated, service_role;
revoke all on table public.web_atelier_payment_schedules from public, anon, authenticated, service_role;
revoke all on table public.web_atelier_financial_documents from public, anon, authenticated, service_role;
revoke all on table public.web_atelier_payment_records from public, anon, authenticated, service_role;
revoke all on table public.department_availability_windows from public, anon, authenticated, service_role;
revoke all on table public.department_reservations from public, anon, authenticated, service_role;

grant select on table public.admin_communication_templates to authenticated;
grant select on table public.web_atelier_communications to authenticated;
grant select on table public.web_atelier_payment_schedules to authenticated;
grant select on table public.web_atelier_financial_documents to authenticated;
grant select on table public.web_atelier_payment_records to authenticated;
grant select on table public.department_availability_windows to authenticated;
grant select on table public.department_reservations to authenticated;

create policy admin_communication_templates_admin_select
  on public.admin_communication_templates for select to authenticated
  using (public.is_admin());

create policy web_atelier_communications_admin_select
  on public.web_atelier_communications for select to authenticated
  using (public.is_admin());

create policy web_atelier_payment_schedules_admin_select
  on public.web_atelier_payment_schedules for select to authenticated
  using (public.is_admin());

create policy web_atelier_financial_documents_admin_select
  on public.web_atelier_financial_documents for select to authenticated
  using (public.is_admin());

create policy web_atelier_payment_records_admin_select
  on public.web_atelier_payment_records for select to authenticated
  using (public.is_admin());

create policy department_availability_windows_admin_select
  on public.department_availability_windows for select to authenticated
  using (public.is_admin());

create policy department_reservations_admin_select
  on public.department_reservations for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- G RPCs
-- ---------------------------------------------------------------------------

create function public.admin_upsert_communication_template(
  p_id uuid,
  p_department text,
  p_channel text,
  p_name text,
  p_subject_template text,
  p_body_template text,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.web_atelier_require_admin();

  if p_id is null then
    insert into public.admin_communication_templates (
      department, channel, name, subject_template, body_template, is_active, created_by
    ) values (
      p_department, p_channel, btrim(p_name), nullif(btrim(coalesce(p_subject_template, '')), ''),
      p_body_template, coalesce(p_is_active, true), auth.uid()
    )
    returning id into v_id;
  else
    update public.admin_communication_templates t
    set
      department = p_department,
      channel = p_channel,
      name = btrim(p_name),
      subject_template = nullif(btrim(coalesce(p_subject_template, '')), ''),
      body_template = p_body_template,
      is_active = coalesce(p_is_active, true),
      updated_at = pg_catalog.now()
    where t.id = p_id
    returning t.id into v_id;
    if v_id is null then
      raise exception 'template_not_found';
    end if;
  end if;

  return v_id;
end;
$$;

create function public.admin_list_communication_templates(p_department text default null)
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
      'id', t.id,
      'department', t.department,
      'channel', t.channel,
      'name', t.name,
      'subject_template', t.subject_template,
      'body_template', t.body_template,
      'is_active', t.is_active,
      'created_at', t.created_at,
      'updated_at', t.updated_at
    )
    order by t.department, t.name
  ), '[]'::jsonb)
  into v_out
  from public.admin_communication_templates t
  where p_department is null or t.department = p_department;

  return v_out;
end;
$$;

create function public.admin_create_web_atelier_communication(
  p_channel text,
  p_direction text,
  p_subject text,
  p_summary text,
  p_occurred_at timestamptz,
  p_inquiry_id uuid default null,
  p_offer_id uuid default null,
  p_project_id uuid default null,
  p_template_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.web_atelier_require_admin();

  -- Lock related entities in documented order when present.
  if p_inquiry_id is not null then
    perform public.web_atelier_lock_inquiry(p_inquiry_id);
  end if;
  if p_offer_id is not null then
    perform public.web_atelier_lock_offer(p_offer_id);
  end if;
  if p_project_id is not null then
    perform public.web_atelier_lock_project(p_project_id);
  end if;

  insert into public.web_atelier_communications (
    channel, direction, subject, summary, occurred_at,
    inquiry_id, offer_id, project_id, template_id, created_by
  ) values (
    p_channel, p_direction, p_subject, p_summary,
    coalesce(p_occurred_at, pg_catalog.now()),
    p_inquiry_id, p_offer_id, p_project_id, p_template_id, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create function public.admin_list_web_atelier_communications(
  p_inquiry_id uuid default null,
  p_offer_id uuid default null,
  p_project_id uuid default null
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

  if p_inquiry_id is null and p_offer_id is null and p_project_id is null then
    raise exception 'communication_filter_required';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'channel', c.channel,
      'direction', c.direction,
      'subject', c.subject,
      'summary', c.summary,
      'occurred_at', c.occurred_at,
      'inquiry_id', c.inquiry_id,
      'offer_id', c.offer_id,
      'project_id', c.project_id,
      'template_id', c.template_id,
      'created_at', c.created_at
    )
    order by c.occurred_at desc, c.created_at desc
  ), '[]'::jsonb)
  into v_out
  from public.web_atelier_communications c
  where (p_inquiry_id is null or c.inquiry_id = p_inquiry_id)
    and (p_offer_id is null or c.offer_id = p_offer_id)
    and (p_project_id is null or c.project_id = p_project_id);

  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- H RPCs
-- ---------------------------------------------------------------------------

create function public.admin_create_web_atelier_payment_schedule(
  p_project_id uuid,
  p_label text,
  p_due_date date,
  p_amount_cents bigint,
  p_notes text default null,
  p_position integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.web_atelier_require_admin();
  perform public.web_atelier_lock_project(p_project_id);

  insert into public.web_atelier_payment_schedules (
    project_id, label, due_date, amount_cents, notes, position, created_by
  ) values (
    p_project_id, p_label, p_due_date, p_amount_cents, p_notes, coalesce(p_position, 0), auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create function public.admin_update_web_atelier_payment_schedule(
  p_schedule_id uuid,
  p_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.web_atelier_payment_schedules%rowtype;
  v_status text;
begin
  perform public.web_atelier_require_admin();

  select * into v_row
  from public.web_atelier_payment_schedules s
  where s.id = p_schedule_id
  for update;
  if not found then
    raise exception 'payment_schedule_not_found';
  end if;

  perform public.web_atelier_lock_project(v_row.project_id);

  v_status := coalesce(p_patch->>'status', v_row.status);
  if v_status = 'paid' and v_row.status is distinct from 'paid' then
    raise exception 'payment_status_paid_requires_payment_record';
  end if;

  update public.web_atelier_payment_schedules s
  set
    label = coalesce(nullif(btrim(coalesce(p_patch->>'label', '')), ''), s.label),
    due_date = case when p_patch ? 'due_date' then nullif(p_patch->>'due_date', '')::date else s.due_date end,
    amount_cents = coalesce((p_patch->>'amount_cents')::bigint, s.amount_cents),
    status = v_status,
    notes = case when p_patch ? 'notes' then nullif(p_patch->>'notes', '') else s.notes end,
    position = coalesce((p_patch->>'position')::integer, s.position),
    updated_at = pg_catalog.now()
  where s.id = p_schedule_id;
end;
$$;

create function public.admin_create_web_atelier_financial_document(
  p_project_id uuid,
  p_doc_kind text,
  p_external_reference text,
  p_issued_on date default null,
  p_amount_cents bigint default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.web_atelier_require_admin();
  perform public.web_atelier_lock_project(p_project_id);

  insert into public.web_atelier_financial_documents (
    project_id, doc_kind, external_reference, issued_on, amount_cents, notes, created_by
  ) values (
    p_project_id, p_doc_kind, p_external_reference, p_issued_on, p_amount_cents, p_notes, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create function public.admin_record_web_atelier_payment(
  p_project_id uuid,
  p_amount_cents bigint,
  p_paid_on date,
  p_method text,
  p_schedule_id uuid default null,
  p_document_id uuid default null,
  p_external_reference text default null,
  p_notes text default null,
  p_mark_schedule_paid boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_schedule public.web_atelier_payment_schedules%rowtype;
begin
  perform public.web_atelier_require_admin();
  perform public.web_atelier_lock_project(p_project_id);

  if p_schedule_id is not null then
    select * into v_schedule
    from public.web_atelier_payment_schedules s
    where s.id = p_schedule_id
    for update;
    if not found then
      raise exception 'payment_schedule_not_found';
    end if;
    if v_schedule.project_id is distinct from p_project_id then
      raise exception 'payment_schedule_project_mismatch';
    end if;
  end if;

  if p_document_id is not null then
    perform 1
    from public.web_atelier_financial_documents d
    where d.id = p_document_id and d.project_id = p_project_id
    for update;
    if not found then
      raise exception 'financial_document_not_found';
    end if;
  end if;

  insert into public.web_atelier_payment_records (
    project_id, schedule_id, document_id, amount_cents, paid_on, method,
    external_reference, notes, created_by
  ) values (
    p_project_id, p_schedule_id, p_document_id, p_amount_cents, p_paid_on, p_method,
    p_external_reference, p_notes, auth.uid()
  )
  returning id into v_id;

  if p_schedule_id is not null and coalesce(p_mark_schedule_paid, true) then
    perform set_config('anis.finance_allow_paid', '1', true);
    update public.web_atelier_payment_schedules s
    set status = 'paid', updated_at = pg_catalog.now()
    where s.id = p_schedule_id;
  end if;

  return v_id;
end;
$$;

create function public.admin_list_web_atelier_finance(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_schedules jsonb;
  v_documents jsonb;
  v_payments jsonb;
begin
  perform public.web_atelier_require_admin();

  if not exists (select 1 from public.web_atelier_projects p where p.id = p_project_id) then
    raise exception 'project_not_found';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'project_id', s.project_id,
      'label', s.label,
      'due_date', s.due_date,
      'amount_cents', s.amount_cents,
      'currency', s.currency,
      'status', s.status,
      'notes', s.notes,
      'position', s.position,
      'created_at', s.created_at
    )
    order by s.position, s.due_date nulls last, s.created_at
  ), '[]'::jsonb)
  into v_schedules
  from public.web_atelier_payment_schedules s
  where s.project_id = p_project_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'project_id', d.project_id,
      'doc_kind', d.doc_kind,
      'external_reference', d.external_reference,
      'issued_on', d.issued_on,
      'amount_cents', d.amount_cents,
      'currency', d.currency,
      'notes', d.notes,
      'created_at', d.created_at
    )
    order by d.created_at desc
  ), '[]'::jsonb)
  into v_documents
  from public.web_atelier_financial_documents d
  where d.project_id = p_project_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'project_id', p.project_id,
      'schedule_id', p.schedule_id,
      'document_id', p.document_id,
      'amount_cents', p.amount_cents,
      'currency', p.currency,
      'paid_on', p.paid_on,
      'method', p.method,
      'external_reference', p.external_reference,
      'notes', p.notes,
      'created_at', p.created_at
    )
    order by p.paid_on desc, p.created_at desc
  ), '[]'::jsonb)
  into v_payments
  from public.web_atelier_payment_records p
  where p.project_id = p_project_id;

  return jsonb_build_object(
    'schedules', v_schedules,
    'documents', v_documents,
    'payments', v_payments
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- I RPCs
-- ---------------------------------------------------------------------------

create function public.admin_create_department_availability_window(
  p_department text,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_capacity integer,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.web_atelier_require_admin();

  insert into public.department_availability_windows (
    department, title, starts_at, ends_at, capacity, notes, created_by
  ) values (
    p_department, p_title, p_starts_at, p_ends_at, p_capacity, p_notes, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create function public.admin_create_department_reservation(
  p_window_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_title text,
  p_status text default 'draft',
  p_entity_kind text default 'unlinked',
  p_entity_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window public.department_availability_windows%rowtype;
  v_id uuid;
begin
  perform public.web_atelier_require_admin();
  v_window := public.department_lock_availability_window(p_window_id);

  if p_entity_kind = 'web_atelier_project' and p_entity_id is not null then
    perform public.web_atelier_lock_project(p_entity_id);
  end if;

  insert into public.department_reservations (
    department, window_id, starts_at, ends_at, status,
    entity_kind, entity_id, title, notes, created_by
  ) values (
    v_window.department, p_window_id, p_starts_at, p_ends_at, coalesce(p_status, 'draft'),
    coalesce(p_entity_kind, 'unlinked'), p_entity_id, p_title, p_notes, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create function public.admin_update_department_reservation(
  p_reservation_id uuid,
  p_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.department_reservations%rowtype;
begin
  perform public.web_atelier_require_admin();

  select * into v_row
  from public.department_reservations r
  where r.id = p_reservation_id
  for update;
  if not found then
    raise exception 'reservation_not_found';
  end if;

  perform public.department_lock_availability_window(v_row.window_id);

  update public.department_reservations r
  set
    starts_at = coalesce((p_patch->>'starts_at')::timestamptz, r.starts_at),
    ends_at = coalesce((p_patch->>'ends_at')::timestamptz, r.ends_at),
    status = coalesce(p_patch->>'status', r.status),
    title = coalesce(nullif(btrim(coalesce(p_patch->>'title', '')), ''), r.title),
    notes = case when p_patch ? 'notes' then nullif(p_patch->>'notes', '') else r.notes end,
    entity_kind = coalesce(p_patch->>'entity_kind', r.entity_kind),
    entity_id = case
      when p_patch ? 'entity_id' then nullif(p_patch->>'entity_id', '')::uuid
      else r.entity_id
    end,
    updated_at = pg_catalog.now()
  where r.id = p_reservation_id;
end;
$$;

create function public.admin_list_department_availability(
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
  v_windows jsonb;
  v_reservations jsonb;
begin
  perform public.web_atelier_require_admin();

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', w.id,
      'department', w.department,
      'title', w.title,
      'starts_at', w.starts_at,
      'ends_at', w.ends_at,
      'capacity', w.capacity,
      'notes', w.notes,
      'created_at', w.created_at
    )
    order by w.starts_at, w.created_at
  ), '[]'::jsonb)
  into v_windows
  from public.department_availability_windows w
  where (p_department is null or w.department = p_department)
    and (p_from is null or w.ends_at > p_from)
    and (p_to is null or w.starts_at < p_to);

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
      'created_at', r.created_at
    )
    order by r.starts_at, r.created_at
  ), '[]'::jsonb)
  into v_reservations
  from public.department_reservations r
  where (p_department is null or r.department = p_department)
    and (p_from is null or r.ends_at > p_from)
    and (p_to is null or r.starts_at < p_to);

  return jsonb_build_object(
    'windows', v_windows,
    'reservations', v_reservations
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Function grants
-- ---------------------------------------------------------------------------

revoke all on function public.admin_upsert_communication_template(uuid, text, text, text, text, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_communication_templates(text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_create_web_atelier_communication(text, text, text, text, timestamptz, uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_web_atelier_communications(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_create_web_atelier_payment_schedule(uuid, text, date, bigint, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_update_web_atelier_payment_schedule(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_create_web_atelier_financial_document(uuid, text, text, date, bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_record_web_atelier_payment(uuid, bigint, date, text, uuid, uuid, text, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_web_atelier_finance(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_create_department_availability_window(text, text, timestamptz, timestamptz, integer, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_create_department_reservation(uuid, timestamptz, timestamptz, text, text, text, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_update_department_reservation(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_department_availability(text, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_upsert_communication_template(uuid, text, text, text, text, text, boolean)
  to authenticated;
grant execute on function public.admin_list_communication_templates(text)
  to authenticated;
grant execute on function public.admin_create_web_atelier_communication(text, text, text, text, timestamptz, uuid, uuid, uuid, uuid)
  to authenticated;
grant execute on function public.admin_list_web_atelier_communications(uuid, uuid, uuid)
  to authenticated;
grant execute on function public.admin_create_web_atelier_payment_schedule(uuid, text, date, bigint, text, integer)
  to authenticated;
grant execute on function public.admin_update_web_atelier_payment_schedule(uuid, jsonb)
  to authenticated;
grant execute on function public.admin_create_web_atelier_financial_document(uuid, text, text, date, bigint, text)
  to authenticated;
grant execute on function public.admin_record_web_atelier_payment(uuid, bigint, date, text, uuid, uuid, text, text, boolean)
  to authenticated;
grant execute on function public.admin_list_web_atelier_finance(uuid)
  to authenticated;
grant execute on function public.admin_create_department_availability_window(text, text, timestamptz, timestamptz, integer, text)
  to authenticated;
grant execute on function public.admin_create_department_reservation(uuid, timestamptz, timestamptz, text, text, text, uuid, text)
  to authenticated;
grant execute on function public.admin_update_department_reservation(uuid, jsonb)
  to authenticated;
grant execute on function public.admin_list_department_availability(text, timestamptz, timestamptz)
  to authenticated;

comment on table public.web_atelier_financial_documents is
  'Manual Parra/external document references only. Never generates fiscal invoices.';
comment on table public.web_atelier_communications is
  'Manual admin communication log. No automatic e-mail or delivery confirmation.';
comment on table public.department_reservations is
  'V1 capacity reservations. Offer acceptance never auto-creates rows here.';
