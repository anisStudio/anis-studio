-- F2.4.16C-D — Web Atelier official offers, acceptance evidence and projects.
--
-- STATUS: DRAFT FOR REVIEW. NOT APPLIED to any database. Do not run
-- `supabase db push` from this repository until the review package is signed off.
--
-- Additive only. Does not alter web_atelier_inquiries, its guard trigger, the
-- B1 / B2 RPCs, Interijeri / LRC tables, Storage, Auth, or any public flag.
--
-- Locked business rules implemented here
--   * An inquiry is NOT a purchase and NOT a project. Nothing in this file is
--     fired by an inquiry insert or an inquiry status change.
--   * An administrator reviews an inquiry, then drafts an official offer.
--   * An offer must be explicitly accepted (a recorded approval row with
--     evidence) before a project can exist. Acceptance is never inferred.
--   * An offer is NOT an invoice. There is no payment, Stripe or invoice object
--     here. Parra remains the source of truth for official invoices.
--   * SENT offers are immutable. Changes require a new version that supersedes it.
--   * All writes go through SECURITY DEFINER RPCs that call public.is_admin().
--     anon and service_role have no privileges on any object created here.
--     authenticated has SELECT only, filtered by an is_admin() RLS policy.
--     Triggers repeat the invariants so a mistaken privileged write is refused too.
--
-- BLOCKER (documented, not solved here): there is no client-facing acceptance
-- path. V1 acceptance is "recorded by an administrator from external evidence"
-- (method = admin_recorded). A secure client acceptance link needs legal and
-- product decisions listed in the review package.
--
-- Issuance vs delivery: admin_mark_web_atelier_offer_sent freezes an immutable
-- snapshot only. It does NOT mean the client received the offer. Delivery is a
-- separate auditable step (admin_record_web_atelier_offer_delivery) with no e-mail.
--
-- Evidence retention: the database stores only a citation
-- (evidence_reference + evidence_retention_note). It does NOT store or verify
-- e-mail bodies or signed PDFs. The operator must keep originals outside the DB.
--
-- Lock order (deadlock prevention), always ascending:
--   1) web_atelier_inquiries by id
--   2) web_atelier_offers by id (every offer touched in the txn)
--   3) web_atelier_projects by id
-- Never lock an offer before its inquiry when both are needed.
--
-- Business calendar: validity and expiry use Europe/Zagreb civil dates.
--
-- Reference prices START 300, PRO 500, PREMIUM 800 EUR are informative until an
-- official offer is issued. They are NOT enforced or stored by the database;
-- the admin enters every line price explicitly.

-- ---------------------------------------------------------------------------
-- Preflight
-- ---------------------------------------------------------------------------

do $preflight$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'F2.4.16C: public.is_admin() is missing';
  end if;

  if to_regclass('public.web_atelier_inquiries') is null then
    raise exception 'F2.4.16C: public.web_atelier_inquiries is missing (B1 not applied)';
  end if;

  if to_regprocedure('extensions.digest(text, text)') is null then
    raise exception 'F2.4.16C: extensions.digest(text, text) is missing';
  end if;

  if to_regclass('public.web_atelier_offers') is not null
    or to_regclass('public.web_atelier_offer_items') is not null
    or to_regclass('public.web_atelier_scope_versions') is not null
    or to_regclass('public.web_atelier_approvals') is not null
    or to_regclass('public.web_atelier_projects') is not null
    or to_regclass('public.web_atelier_project_events') is not null
  then
    raise exception 'F2.4.16C: one of the offer/project tables already exists';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- Sequences and small internal helpers
-- ---------------------------------------------------------------------------

create sequence public.web_atelier_offer_ref_seq;
create sequence public.web_atelier_project_ref_seq;

revoke all on sequence public.web_atelier_offer_ref_seq from public, anon, authenticated, service_role;
revoke all on sequence public.web_atelier_project_ref_seq from public, anon, authenticated, service_role;

create function public.web_atelier_format_ref(p_prefix text, p_seq bigint)
returns text
language sql
stable
set search_path = ''
as $$
  select p_prefix
    || '-'
    || pg_catalog.to_char(pg_catalog.timezone('UTC', pg_catalog.now()), 'YYYY')
    || '-'
    || case
         when pg_catalog.char_length(p_seq::text) >= 6 then p_seq::text
         else pg_catalog.lpad(p_seq::text, 6, '0')
       end;
$$;

create function public.web_atelier_require_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- Civil "today" in the studio's business timezone (CET/CEST).
create function public.web_atelier_business_date(p_at timestamptz default pg_catalog.now())
returns date
language sql
stable
set search_path = ''
as $$
  select (pg_catalog.timezone('Europe/Zagreb', p_at))::date;
$$;

-- Lock helpers: always inquiry → offers(id asc) → project.
create function public.web_atelier_lock_inquiry(p_inquiry_id uuid)
returns public.web_atelier_inquiries
language plpgsql
set search_path = ''
as $$
declare
  v_row public.web_atelier_inquiries%rowtype;
begin
  select * into v_row
  from public.web_atelier_inquiries i
  where i.id = p_inquiry_id
  for update;
  if not found then
    raise exception 'inquiry_not_found';
  end if;
  return v_row;
end;
$$;

revoke all on function public.web_atelier_format_ref(text, bigint) from public, anon, authenticated, service_role;
revoke all on function public.web_atelier_require_admin() from public, anon, authenticated, service_role;
revoke all on function public.web_atelier_business_date(timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.web_atelier_lock_inquiry(uuid) from public, anon, authenticated, service_role;
grant execute on function public.web_atelier_business_date(timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Scope versions (append-only, hashed)
-- ---------------------------------------------------------------------------

create function public.web_atelier_normalize_scope(p_scope jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_name text;
  v_item jsonb;
  v_arr jsonb;
  v_clean jsonb;
  v_text text;
  v_out jsonb;
begin
  if p_scope is null or jsonb_typeof(p_scope) <> 'object' then
    raise exception 'scope_invalid';
  end if;

  for v_key in select jsonb_object_keys(p_scope) loop
    if v_key not in (
      'summary', 'deliverables', 'exclusions', 'assumptions',
      'timeline_note', 'revision_rounds'
    ) then
      raise exception 'scope_unknown_key';
    end if;
  end loop;

  if jsonb_typeof(p_scope -> 'summary') is distinct from 'string' then
    raise exception 'scope_summary_required';
  end if;
  v_text := btrim(p_scope ->> 'summary');
  if char_length(v_text) < 1 or char_length(v_text) > 4000 then
    raise exception 'scope_summary_length';
  end if;
  v_out := jsonb_build_object('summary', v_text);

  foreach v_name in array array['deliverables', 'exclusions', 'assumptions'] loop
    v_arr := coalesce(p_scope -> v_name, '[]'::jsonb);
    if jsonb_typeof(v_arr) <> 'array' or jsonb_array_length(v_arr) > 30 then
      raise exception 'scope_list_invalid';
    end if;

    v_clean := '[]'::jsonb;
    for v_item in select e.value from jsonb_array_elements(v_arr) as e(value) loop
      if jsonb_typeof(v_item) <> 'string' then
        raise exception 'scope_list_invalid';
      end if;
      v_text := btrim(v_item #>> '{}');
      if v_text = '' then
        continue;
      end if;
      if char_length(v_text) > 300 then
        raise exception 'scope_list_item_length';
      end if;
      v_clean := v_clean || to_jsonb(v_text);
    end loop;

    if v_name = 'deliverables' and jsonb_array_length(v_clean) < 1 then
      raise exception 'scope_deliverables_required';
    end if;
    v_out := v_out || jsonb_build_object(v_name, v_clean);
  end loop;

  if jsonb_exists(p_scope, 'timeline_note') and jsonb_typeof(p_scope -> 'timeline_note') <> 'null' then
    if jsonb_typeof(p_scope -> 'timeline_note') <> 'string' then
      raise exception 'scope_timeline_invalid';
    end if;
    v_text := btrim(p_scope ->> 'timeline_note');
    if char_length(v_text) > 1000 then
      raise exception 'scope_timeline_invalid';
    end if;
    if v_text <> '' then
      v_out := v_out || jsonb_build_object('timeline_note', v_text);
    end if;
  end if;

  if jsonb_exists(p_scope, 'revision_rounds') and jsonb_typeof(p_scope -> 'revision_rounds') <> 'null' then
    if jsonb_typeof(p_scope -> 'revision_rounds') <> 'number'
      or (p_scope ->> 'revision_rounds')::numeric <> trunc((p_scope ->> 'revision_rounds')::numeric)
      or (p_scope ->> 'revision_rounds')::numeric not between 0 and 20
    then
      raise exception 'scope_revision_rounds_invalid';
    end if;
    v_out := v_out || jsonb_build_object('revision_rounds', (p_scope ->> 'revision_rounds')::integer);
  end if;

  return v_out;
end;
$$;

revoke all on function public.web_atelier_normalize_scope(jsonb) from public, anon, authenticated, service_role;

create table public.web_atelier_scope_versions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  department text not null default 'web_atelier',
  inquiry_id uuid references public.web_atelier_inquiries (id) on delete restrict,
  version_number integer not null,
  scope jsonb not null,
  scope_sha256 text not null,
  created_by uuid,
  created_at timestamptz not null default pg_catalog.now(),
  constraint web_atelier_scope_versions_department_check check (
    department in ('web_atelier', 'interiors', 'lrc')
  ),
  constraint web_atelier_scope_versions_inquiry_check check (
    department <> 'web_atelier' or inquiry_id is not null
  ),
  constraint web_atelier_scope_versions_version_check check (version_number >= 1),
  constraint web_atelier_scope_versions_sha256_check check (scope_sha256 ~ '^[0-9a-f]{64}$'),
  constraint web_atelier_scope_versions_inquiry_version_key unique (inquiry_id, version_number)
);

comment on table public.web_atelier_scope_versions is
  'Append-only, hashed scope of work. An offer points at exactly one version and freezes its content in the offer snapshot. created_by is auth.uid() of the administrator, not an FK, so an Auth deletion can never cascade here.';

create function public.web_atelier_scope_versions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'scope_versions_append_only';
  end if;
  new.scope := public.web_atelier_normalize_scope(new.scope);
  new.scope_sha256 := pg_catalog.encode(extensions.digest(new.scope::text, 'sha256'), 'hex');
  return new;
end;
$$;

revoke all on function public.web_atelier_scope_versions_guard() from public, anon, authenticated, service_role;

create trigger web_atelier_scope_versions_guard_write
  before insert or update or delete on public.web_atelier_scope_versions
  for each row execute function public.web_atelier_scope_versions_guard();

-- ---------------------------------------------------------------------------
-- Offers
-- ---------------------------------------------------------------------------

create table public.web_atelier_offers (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  offer_number text not null,
  department text not null default 'web_atelier',
  inquiry_id uuid references public.web_atelier_inquiries (id) on delete restrict,
  version integer not null default 1,
  status text not null default 'draft',
  supersedes_offer_id uuid references public.web_atelier_offers (id) on delete restrict,
  superseded_by_offer_id uuid references public.web_atelier_offers (id) on delete restrict,
  title text not null,
  package_tier text,
  client_name text not null,
  client_email text not null,
  currency text not null default 'EUR',
  scope_version_id uuid references public.web_atelier_scope_versions (id) on delete restrict,
  valid_until date,
  terms_note text,
  subtotal_cents bigint not null default 0,
  discount_cents bigint not null default 0,
  total_cents bigint not null default 0,
  snapshot jsonb,
  snapshot_sha256 text,
  sent_at timestamptz,
  sent_by uuid,
  delivered_at timestamptz,
  delivered_by uuid,
  delivery_channel text,
  delivery_reference text,
  accepted_at timestamptz,
  rejected_at timestamptz,
  expired_at timestamptz,
  superseded_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint web_atelier_offers_offer_number_key unique (offer_number),
  constraint web_atelier_offers_offer_number_check check (offer_number ~ '^WO-[0-9]{4}-[0-9]{6,}$'),
  constraint web_atelier_offers_department_check check (department in ('web_atelier', 'interiors', 'lrc')),
  constraint web_atelier_offers_inquiry_check check (department <> 'web_atelier' or inquiry_id is not null),
  constraint web_atelier_offers_inquiry_version_key unique (inquiry_id, version),
  constraint web_atelier_offers_version_check check (version >= 1),
  constraint web_atelier_offers_status_check check (
    status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'superseded')
  ),
  constraint web_atelier_offers_not_self_superseding check (
    supersedes_offer_id is null or supersedes_offer_id <> id
  ),
  constraint web_atelier_offers_title_check check (char_length(title) between 1 and 200),
  constraint web_atelier_offers_package_tier_check check (
    package_tier is null or package_tier in ('start', 'pro', 'premium')
  ),
  constraint web_atelier_offers_client_name_check check (char_length(client_name) between 1 and 200),
  constraint web_atelier_offers_client_email_check check (
    char_length(client_email) between 3 and 320 and position('@' in client_email) > 1
  ),
  constraint web_atelier_offers_currency_check check (currency = 'EUR'),
  constraint web_atelier_offers_terms_note_check check (
    terms_note is null or char_length(terms_note) <= 4000
  ),
  constraint web_atelier_offers_amounts_check check (
    subtotal_cents >= 0
    and discount_cents >= 0
    and total_cents >= 0
    and total_cents = subtotal_cents - discount_cents
    and total_cents <= 10000000000
  ),
  constraint web_atelier_offers_snapshot_sha256_check check (
    snapshot_sha256 is null or snapshot_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint web_atelier_offers_draft_shape_check check (
    status <> 'draft'
    or (
      snapshot is null
      and snapshot_sha256 is null
      and sent_at is null
      and sent_by is null
      and delivered_at is null
      and delivered_by is null
      and delivery_channel is null
      and delivery_reference is null
      and accepted_at is null
      and rejected_at is null
      and expired_at is null
      and superseded_at is null
      and superseded_by_offer_id is null
    )
  ),
  constraint web_atelier_offers_issued_shape_check check (
    status = 'draft'
    or (
      snapshot is not null
      and snapshot_sha256 is not null
      and sent_at is not null
      and sent_by is not null
      and valid_until is not null
      and scope_version_id is not null
      and total_cents > 0
    )
  ),
  constraint web_atelier_offers_delivery_shape_check check (
    (
      delivered_at is null
      and delivered_by is null
      and delivery_channel is null
      and delivery_reference is null
    )
    or (
      delivered_at is not null
      and delivered_by is not null
      and delivery_channel in ('email_manual', 'meeting', 'courier', 'other')
      and char_length(delivery_reference) between 10 and 2000
      and sent_at is not null
      and delivered_at >= sent_at
    )
  ),
  constraint web_atelier_offers_terminal_timestamps_check check (
    ((status = 'accepted') = (accepted_at is not null))
    and ((status = 'rejected') = (rejected_at is not null))
    and ((status = 'expired') = (expired_at is not null))
    and ((status = 'superseded') = (superseded_at is not null))
    and ((status = 'superseded') = (superseded_by_offer_id is not null))
  )
);

comment on table public.web_atelier_offers is
  'Official Web Atelier offer. NOT an invoice and NOT a project. Content is editable only in draft; at SENT the content is frozen into snapshot with snapshot_sha256. Changes require a new version that supersedes this one.';

comment on column public.web_atelier_offers.package_tier is
  'Informative tier label only (start/pro/premium). Prices come from offer_items entered by an administrator; the database stores no list price.';

comment on column public.web_atelier_offers.sent_at is
  'Moment the immutable official snapshot was issued (frozen). This is NOT client delivery. Use delivered_at for actual hand-off evidence.';

comment on column public.web_atelier_offers.delivered_at is
  'Moment an administrator recorded that the issued snapshot was delivered to the client by a manual channel. No e-mail is sent by the system.';

create unique index web_atelier_offers_one_draft_per_inquiry_idx
  on public.web_atelier_offers (inquiry_id)
  where status = 'draft';

create unique index web_atelier_offers_one_open_per_inquiry_idx
  on public.web_atelier_offers (inquiry_id)
  where status in ('sent', 'accepted');

create unique index web_atelier_offers_one_successor_idx
  on public.web_atelier_offers (supersedes_offer_id)
  where supersedes_offer_id is not null;

create index web_atelier_offers_status_created_idx
  on public.web_atelier_offers (status, created_at desc);

create index web_atelier_offers_inquiry_idx
  on public.web_atelier_offers (inquiry_id);

create index web_atelier_offers_scope_version_idx
  on public.web_atelier_offers (scope_version_id);

-- Defined after web_atelier_offers so the composite return type exists.
create function public.web_atelier_lock_offer(p_offer_id uuid)
returns public.web_atelier_offers
language plpgsql
set search_path = ''
as $$
declare
  v_row public.web_atelier_offers%rowtype;
begin
  select * into v_row
  from public.web_atelier_offers o
  where o.id = p_offer_id
  for update;
  if not found then
    raise exception 'offer_not_found';
  end if;
  return v_row;
end;
$$;

revoke all on function public.web_atelier_lock_offer(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Offer items (editable only while the offer is a draft)
-- ---------------------------------------------------------------------------

create table public.web_atelier_offer_items (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  offer_id uuid not null references public.web_atelier_offers (id) on delete restrict,
  position integer not null,
  item_type text not null,
  description text not null,
  details text,
  quantity numeric(10, 2) not null,
  unit_price_cents bigint not null,
  line_total_cents bigint not null default 0,
  created_at timestamptz not null default pg_catalog.now(),
  constraint web_atelier_offer_items_position_key unique (offer_id, position),
  constraint web_atelier_offer_items_position_check check (position between 1 and 50),
  constraint web_atelier_offer_items_type_check check (
    item_type in ('service', 'addon', 'discount', 'other')
  ),
  constraint web_atelier_offer_items_description_check check (char_length(description) between 1 and 300),
  constraint web_atelier_offer_items_details_check check (details is null or char_length(details) <= 1000),
  constraint web_atelier_offer_items_quantity_check check (quantity > 0 and quantity <= 1000),
  constraint web_atelier_offer_items_unit_price_check check (unit_price_cents between 0 and 100000000),
  constraint web_atelier_offer_items_line_total_check check (line_total_cents >= 0)
);

comment on table public.web_atelier_offer_items is
  'Offer line items in integer euro cents. line_total_cents is always recomputed by trigger as round(quantity * unit_price_cents). A discount line has a positive amount that is subtracted in the offer totals.';

create index web_atelier_offer_items_offer_idx
  on public.web_atelier_offer_items (offer_id, position);

-- ---------------------------------------------------------------------------
-- Approvals (acceptance / rejection evidence, append-only)
-- ---------------------------------------------------------------------------

create table public.web_atelier_approvals (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  offer_id uuid not null references public.web_atelier_offers (id) on delete restrict,
  decision text not null,
  offer_number text not null,
  offer_version integer not null,
  offer_snapshot_sha256 text not null,
  method text not null default 'admin_recorded',
  decided_by_name text not null,
  decided_at timestamptz not null,
  evidence_channel text not null,
  evidence_reference text not null,
  evidence_retention_note text not null,
  note text,
  admin_confirmed_evidence boolean not null,
  recorded_by uuid not null,
  recorded_at timestamptz not null default pg_catalog.now(),
  constraint web_atelier_approvals_offer_key unique (offer_id),
  constraint web_atelier_approvals_decision_check check (decision in ('accepted', 'rejected')),
  constraint web_atelier_approvals_method_check check (method in ('admin_recorded')),
  constraint web_atelier_approvals_offer_number_check check (offer_number ~ '^WO-[0-9]{4}-[0-9]{6,}$'),
  constraint web_atelier_approvals_version_check check (offer_version >= 1),
  constraint web_atelier_approvals_sha256_check check (offer_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  constraint web_atelier_approvals_name_check check (char_length(decided_by_name) between 1 and 200),
  constraint web_atelier_approvals_channel_check check (
    evidence_channel in ('email', 'signed_document', 'written_message', 'meeting_minutes', 'other')
  ),
  constraint web_atelier_approvals_reference_check check (
    char_length(evidence_reference) between 10 and 2000
  ),
  constraint web_atelier_approvals_retention_check check (
    char_length(evidence_retention_note) between 10 and 2000
  ),
  constraint web_atelier_approvals_note_check check (note is null or char_length(note) <= 2000),
  constraint web_atelier_approvals_confirmed_check check (admin_confirmed_evidence is true)
);

comment on table public.web_atelier_approvals is
  'One explicit, append-only decision per offer. V1 method is admin_recorded: an administrator attests that external evidence exists, cites it, names where the original is retained, and binds the decision to offer_number + offer_version + snapshot_sha256. The database does NOT independently verify e-mail or signed documents.';

comment on column public.web_atelier_approvals.evidence_retention_note is
  'Operator-owned retention location for the original evidence (e.g. mailbox archive path, Drive folder, physical file). Not verified by the database.';

-- ---------------------------------------------------------------------------
-- Projects (exist only for an accepted offer, once)
-- ---------------------------------------------------------------------------

create table public.web_atelier_projects (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  project_number text not null,
  department text not null default 'web_atelier',
  inquiry_id uuid references public.web_atelier_inquiries (id) on delete restrict,
  offer_id uuid not null references public.web_atelier_offers (id) on delete restrict,
  approval_id uuid not null references public.web_atelier_approvals (id) on delete restrict,
  scope_version_id uuid not null references public.web_atelier_scope_versions (id) on delete restrict,
  title text not null,
  client_name text not null,
  client_email text not null,
  currency text not null default 'EUR',
  agreed_total_cents bigint not null,
  status text not null default 'preparing',
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint web_atelier_projects_project_number_key unique (project_number),
  constraint web_atelier_projects_one_per_offer_key unique (offer_id),
  constraint web_atelier_projects_one_per_approval_key unique (approval_id),
  constraint web_atelier_projects_number_check check (project_number ~ '^WP-[0-9]{4}-[0-9]{6,}$'),
  constraint web_atelier_projects_department_check check (department in ('web_atelier', 'interiors', 'lrc')),
  constraint web_atelier_projects_inquiry_check check (department <> 'web_atelier' or inquiry_id is not null),
  constraint web_atelier_projects_status_check check (
    status in (
      'preparing', 'waiting_for_client', 'ready_to_start', 'scheduled',
      'in_progress', 'client_review', 'revision', 'final_approval',
      'completed', 'on_hold', 'cancelled'
    )
  ),
  constraint web_atelier_projects_currency_check check (currency = 'EUR'),
  constraint web_atelier_projects_total_check check (agreed_total_cents > 0),
  constraint web_atelier_projects_title_check check (char_length(title) between 1 and 200),
  constraint web_atelier_projects_notes_check check (notes is null or char_length(notes) <= 4000),
  constraint web_atelier_projects_terminal_timestamps_check check (
    ((status = 'completed') = (completed_at is not null))
    and ((status = 'cancelled') = (cancelled_at is not null))
  )
);

comment on table public.web_atelier_projects is
  'Web Atelier delivery project. Created only from an ACCEPTED offer with an accepted approval, at most once per offer (unique offer_id and approval_id). Carries no invoice or payment data; Parra remains the source of truth for invoices.';

create index web_atelier_projects_status_created_idx
  on public.web_atelier_projects (status, created_at desc);

create index web_atelier_projects_inquiry_idx
  on public.web_atelier_projects (inquiry_id);

create table public.web_atelier_project_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  project_id uuid not null references public.web_atelier_projects (id) on delete restrict,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  actor uuid,
  created_at timestamptz not null default pg_catalog.now(),
  constraint web_atelier_project_events_type_check check (
    event_type in ('project_created', 'status_changed', 'details_updated')
  ),
  constraint web_atelier_project_events_note_check check (note is null or char_length(note) <= 2000)
);

comment on table public.web_atelier_project_events is
  'Append-only project activity log written by the admin RPCs.';

create index web_atelier_project_events_project_idx
  on public.web_atelier_project_events (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Trigger functions (defence in depth; the RPCs below are the supported path)
-- ---------------------------------------------------------------------------

create function public.web_atelier_offers_guard_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'draft' then
    raise exception 'offer_must_start_as_draft';
  end if;
  return new;
end;
$$;

create function public.web_atelier_offers_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_subtotal bigint;
  v_discount bigint;
begin
  if new.id is distinct from old.id
    or new.offer_number is distinct from old.offer_number
    or new.department is distinct from old.department
    or new.inquiry_id is distinct from old.inquiry_id
    or new.version is distinct from old.version
    or new.supersedes_offer_id is distinct from old.supersedes_offer_id
    or new.currency is distinct from old.currency
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'offer_identity_immutable';
  end if;

  if old.status = 'draft' then
    if new.status not in ('draft', 'sent') then
      raise exception 'offer_invalid_transition % -> %', old.status, new.status;
    end if;

    -- Totals are server-derived: they must equal the sum of the stored items.
    select
      coalesce(sum(i.line_total_cents) filter (where i.item_type <> 'discount'), 0),
      coalesce(sum(i.line_total_cents) filter (where i.item_type = 'discount'), 0)
    into v_subtotal, v_discount
    from public.web_atelier_offer_items i
    where i.offer_id = old.id;

    if new.subtotal_cents <> v_subtotal
      or new.discount_cents <> v_discount
      or new.total_cents <> v_subtotal - v_discount
    then
      raise exception 'offer_totals_must_match_items';
    end if;

    new.updated_at := pg_catalog.now();
    return new;
  end if;

  -- Issued offers: content is frozen.
  if new.title is distinct from old.title
    or new.package_tier is distinct from old.package_tier
    or new.client_name is distinct from old.client_name
    or new.client_email is distinct from old.client_email
    or new.scope_version_id is distinct from old.scope_version_id
    or new.valid_until is distinct from old.valid_until
    or new.terms_note is distinct from old.terms_note
    or new.subtotal_cents is distinct from old.subtotal_cents
    or new.discount_cents is distinct from old.discount_cents
    or new.total_cents is distinct from old.total_cents
    or new.snapshot is distinct from old.snapshot
    or new.snapshot_sha256 is distinct from old.snapshot_sha256
    or new.sent_at is distinct from old.sent_at
    or new.sent_by is distinct from old.sent_by
  then
    raise exception 'offer_immutable_after_sent';
  end if;

  if new.status = old.status then
    if new.accepted_at is distinct from old.accepted_at
      or new.rejected_at is distinct from old.rejected_at
      or new.expired_at is distinct from old.expired_at
      or new.superseded_at is distinct from old.superseded_at
      or new.superseded_by_offer_id is distinct from old.superseded_by_offer_id
    then
      raise exception 'offer_immutable_after_sent';
    end if;
    -- Delivery fields may be filled once after issuance; they cannot be cleared or rewritten.
    if old.delivered_at is not null then
      if new.delivered_at is distinct from old.delivered_at
        or new.delivered_by is distinct from old.delivered_by
        or new.delivery_channel is distinct from old.delivery_channel
        or new.delivery_reference is distinct from old.delivery_reference
      then
        raise exception 'offer_delivery_immutable';
      end if;
    elsif new.delivered_at is not null and old.status not in ('sent', 'accepted', 'rejected', 'expired') then
      raise exception 'offer_delivery_requires_issued_snapshot';
    end if;
    new.updated_at := pg_catalog.now();
    return new;
  end if;

  if old.status <> 'sent' or new.status not in ('accepted', 'rejected', 'expired', 'superseded') then
    raise exception 'offer_invalid_transition % -> %', old.status, new.status;
  end if;

  if new.status in ('accepted', 'rejected') and old.delivered_at is null then
    raise exception 'offer_delivery_required_before_decision';
  end if;

  if new.status = 'accepted' and not exists (
    select 1
    from public.web_atelier_approvals a
    where a.offer_id = old.id
      and a.decision = 'accepted'
      and a.offer_snapshot_sha256 = old.snapshot_sha256
      and a.offer_version = old.version
      and a.offer_number = old.offer_number
  ) then
    raise exception 'offer_acceptance_record_required';
  end if;

  if new.status = 'rejected' and not exists (
    select 1
    from public.web_atelier_approvals a
    where a.offer_id = old.id
      and a.decision = 'rejected'
      and a.offer_snapshot_sha256 = old.snapshot_sha256
      and a.offer_version = old.version
      and a.offer_number = old.offer_number
  ) then
    raise exception 'offer_decision_record_required';
  end if;

  if new.status = 'expired' and old.valid_until >= public.web_atelier_business_date() then
    raise exception 'offer_not_yet_expired';
  end if;

  if new.status = 'superseded' and (
    new.superseded_by_offer_id is null
    or not exists (
      select 1
      from public.web_atelier_offers s
      where s.id = new.superseded_by_offer_id
        and s.supersedes_offer_id = old.id
        and s.inquiry_id is not distinct from old.inquiry_id
    )
  ) then
    raise exception 'offer_successor_required';
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create function public.web_atelier_offers_guard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    raise exception 'offer_immutable_after_sent';
  end if;
  return old;
end;
$$;

create function public.web_atelier_offer_items_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_offer_id uuid := case when tg_op = 'DELETE' then old.offer_id else new.offer_id end;
  v_status text;
begin
  select o.status into v_status
  from public.web_atelier_offers o
  where o.id = v_offer_id;

  if v_status is null then
    raise exception 'offer_not_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'offer_items_locked';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' and new.offer_id is distinct from old.offer_id then
    raise exception 'offer_items_locked';
  end if;

  -- Server-calculated line total. Any client-supplied value is discarded.
  new.line_total_cents := pg_catalog.round(new.quantity * new.unit_price_cents)::bigint;
  return new;
end;
$$;

create function public.web_atelier_offer_items_recalc()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_offer_id uuid := case when tg_op = 'DELETE' then old.offer_id else new.offer_id end;
  v_subtotal bigint;
  v_discount bigint;
begin
  select
    coalesce(sum(i.line_total_cents) filter (where i.item_type <> 'discount'), 0),
    coalesce(sum(i.line_total_cents) filter (where i.item_type = 'discount'), 0)
  into v_subtotal, v_discount
  from public.web_atelier_offer_items i
  where i.offer_id = v_offer_id;

  update public.web_atelier_offers o
  set subtotal_cents = v_subtotal,
      discount_cents = v_discount,
      total_cents = v_subtotal - v_discount
  where o.id = v_offer_id
    and o.status = 'draft';

  return null;
end;
$$;

create function public.web_atelier_approvals_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_offer public.web_atelier_offers%rowtype;
begin
  if tg_op <> 'INSERT' then
    raise exception 'approvals_append_only';
  end if;

  select * into v_offer
  from public.web_atelier_offers o
  where o.id = new.offer_id;

  if not found then
    raise exception 'offer_not_found';
  end if;
  if v_offer.status <> 'sent' then
    raise exception 'offer_not_open_for_decision';
  end if;
  if new.offer_version is distinct from v_offer.version
    or new.offer_snapshot_sha256 is distinct from v_offer.snapshot_sha256
  then
    raise exception 'snapshot_mismatch';
  end if;
  if v_offer.delivered_at is null then
    raise exception 'offer_delivery_required_before_decision';
  end if;
  if new.offer_number is distinct from v_offer.offer_number
    or new.offer_version is distinct from v_offer.version
    or new.offer_snapshot_sha256 is distinct from v_offer.snapshot_sha256
  then
    raise exception 'snapshot_mismatch';
  end if;
  if position(lower(v_offer.offer_number) in lower(new.evidence_reference)) = 0 then
    raise exception 'evidence_must_cite_offer_number';
  end if;
  -- Exact version token "#vN" avoids false positives (v1 matching v10).
  if position(('#v' || v_offer.version::text) in lower(new.evidence_reference)) = 0 then
    raise exception 'evidence_must_cite_offer_version';
  end if;
  if new.decided_at < v_offer.sent_at then
    raise exception 'decision_before_offer_issued';
  end if;
  if new.decided_at < v_offer.delivered_at then
    raise exception 'decision_before_offer_delivered';
  end if;
  if new.decided_at > pg_catalog.now() + interval '5 minutes' then
    raise exception 'decision_in_future';
  end if;
  if new.decision = 'accepted'
    and public.web_atelier_business_date(new.decided_at) > v_offer.valid_until
  then
    raise exception 'offer_expired_at_decision';
  end if;

  return new;
end;
$$;

create function public.web_atelier_projects_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_offer public.web_atelier_offers%rowtype;
  v_approval_id uuid;
begin
  if tg_op = 'DELETE' then
    raise exception 'projects_cannot_be_deleted';
  end if;

  if tg_op = 'INSERT' then
    select * into v_offer
    from public.web_atelier_offers o
    where o.id = new.offer_id;

    if not found or v_offer.status <> 'accepted' then
      raise exception 'project_requires_accepted_offer';
    end if;

    select a.id into v_approval_id
    from public.web_atelier_approvals a
    where a.offer_id = new.offer_id
      and a.decision = 'accepted'
      and a.offer_snapshot_sha256 = v_offer.snapshot_sha256;

    if v_approval_id is null or new.approval_id is distinct from v_approval_id then
      raise exception 'project_requires_acceptance_record';
    end if;

    if new.department is distinct from v_offer.department
      or new.inquiry_id is distinct from v_offer.inquiry_id
      or new.scope_version_id is distinct from v_offer.scope_version_id
      or new.agreed_total_cents is distinct from v_offer.total_cents
      or new.currency is distinct from v_offer.currency
      or new.client_name is distinct from v_offer.client_name
      or new.client_email is distinct from v_offer.client_email
    then
      raise exception 'project_offer_mismatch';
    end if;

    if new.status <> 'preparing' then
      raise exception 'project_must_start_preparing';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.id is distinct from old.id
    or new.project_number is distinct from old.project_number
    or new.department is distinct from old.department
    or new.inquiry_id is distinct from old.inquiry_id
    or new.offer_id is distinct from old.offer_id
    or new.approval_id is distinct from old.approval_id
    or new.scope_version_id is distinct from old.scope_version_id
    or new.client_name is distinct from old.client_name
    or new.client_email is distinct from old.client_email
    or new.currency is distinct from old.currency
    or new.agreed_total_cents is distinct from old.agreed_total_cents
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'project_identity_immutable';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'preparing' and new.status in ('waiting_for_client', 'ready_to_start', 'on_hold', 'cancelled'))
      or (old.status = 'waiting_for_client' and new.status in ('preparing', 'ready_to_start', 'on_hold', 'cancelled'))
      or (old.status = 'ready_to_start' and new.status in ('scheduled', 'in_progress', 'on_hold', 'cancelled'))
      or (old.status = 'scheduled' and new.status in ('in_progress', 'on_hold', 'cancelled'))
      or (old.status = 'in_progress' and new.status in ('client_review', 'on_hold', 'cancelled'))
      or (old.status = 'client_review' and new.status in ('revision', 'final_approval', 'in_progress', 'on_hold', 'cancelled'))
      or (old.status = 'revision' and new.status in ('in_progress', 'client_review', 'on_hold', 'cancelled'))
      or (old.status = 'final_approval' and new.status in ('completed', 'revision', 'on_hold', 'cancelled'))
      or (old.status = 'on_hold' and new.status in (
        'preparing', 'waiting_for_client', 'ready_to_start', 'scheduled',
        'in_progress', 'client_review', 'revision', 'final_approval', 'cancelled'
      ))
    ) then
      raise exception 'project_invalid_transition % -> %', old.status, new.status;
    end if;

    if new.status = 'in_progress' and old.started_at is null then
      new.started_at := pg_catalog.now();
    end if;
    if new.status = 'completed' then
      new.completed_at := pg_catalog.now();
    end if;
    if new.status = 'cancelled' then
      new.cancelled_at := pg_catalog.now();
    end if;
  else
    if new.started_at is distinct from old.started_at
      or new.completed_at is distinct from old.completed_at
      or new.cancelled_at is distinct from old.cancelled_at
    then
      raise exception 'project_timestamps_are_derived';
    end if;
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create function public.web_atelier_project_events_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'project_events_append_only';
  end if;
  return new;
end;
$$;

revoke all on function public.web_atelier_offers_guard_insert() from public, anon, authenticated, service_role;
revoke all on function public.web_atelier_offers_guard_update() from public, anon, authenticated, service_role;
revoke all on function public.web_atelier_offers_guard_delete() from public, anon, authenticated, service_role;
revoke all on function public.web_atelier_offer_items_guard() from public, anon, authenticated, service_role;
revoke all on function public.web_atelier_offer_items_recalc() from public, anon, authenticated, service_role;
revoke all on function public.web_atelier_approvals_guard() from public, anon, authenticated, service_role;
revoke all on function public.web_atelier_projects_guard() from public, anon, authenticated, service_role;
revoke all on function public.web_atelier_project_events_guard() from public, anon, authenticated, service_role;

create trigger web_atelier_offers_guard_insert
  before insert on public.web_atelier_offers
  for each row execute function public.web_atelier_offers_guard_insert();

create trigger web_atelier_offers_guard_update
  before update on public.web_atelier_offers
  for each row execute function public.web_atelier_offers_guard_update();

create trigger web_atelier_offers_guard_delete
  before delete on public.web_atelier_offers
  for each row execute function public.web_atelier_offers_guard_delete();

create trigger web_atelier_offer_items_guard
  before insert or update or delete on public.web_atelier_offer_items
  for each row execute function public.web_atelier_offer_items_guard();

create trigger web_atelier_offer_items_recalc
  after insert or update or delete on public.web_atelier_offer_items
  for each row execute function public.web_atelier_offer_items_recalc();

create trigger web_atelier_approvals_guard
  before insert or update or delete on public.web_atelier_approvals
  for each row execute function public.web_atelier_approvals_guard();

create trigger web_atelier_projects_guard
  before insert or update or delete on public.web_atelier_projects
  for each row execute function public.web_atelier_projects_guard();

create trigger web_atelier_project_events_guard
  before insert or update or delete on public.web_atelier_project_events
  for each row execute function public.web_atelier_project_events_guard();

-- ---------------------------------------------------------------------------
-- RLS and grants: admin SELECT only. No direct writes for any API role.
-- ---------------------------------------------------------------------------

alter table public.web_atelier_scope_versions enable row level security;
alter table public.web_atelier_offers enable row level security;
alter table public.web_atelier_offer_items enable row level security;
alter table public.web_atelier_approvals enable row level security;
alter table public.web_atelier_projects enable row level security;
alter table public.web_atelier_project_events enable row level security;

revoke all on table public.web_atelier_scope_versions from public, anon, authenticated, service_role;
revoke all on table public.web_atelier_offers from public, anon, authenticated, service_role;
revoke all on table public.web_atelier_offer_items from public, anon, authenticated, service_role;
revoke all on table public.web_atelier_approvals from public, anon, authenticated, service_role;
revoke all on table public.web_atelier_projects from public, anon, authenticated, service_role;
revoke all on table public.web_atelier_project_events from public, anon, authenticated, service_role;

grant select on table public.web_atelier_scope_versions to authenticated;
grant select on table public.web_atelier_offers to authenticated;
grant select on table public.web_atelier_offer_items to authenticated;
grant select on table public.web_atelier_approvals to authenticated;
grant select on table public.web_atelier_projects to authenticated;
grant select on table public.web_atelier_project_events to authenticated;

create policy web_atelier_scope_versions_admin_select
  on public.web_atelier_scope_versions for select to authenticated
  using (public.is_admin());

create policy web_atelier_offers_admin_select
  on public.web_atelier_offers for select to authenticated
  using (public.is_admin());

create policy web_atelier_offer_items_admin_select
  on public.web_atelier_offer_items for select to authenticated
  using (public.is_admin());

create policy web_atelier_approvals_admin_select
  on public.web_atelier_approvals for select to authenticated
  using (public.is_admin());

create policy web_atelier_projects_admin_select
  on public.web_atelier_projects for select to authenticated
  using (public.is_admin());

create policy web_atelier_project_events_admin_select
  on public.web_atelier_project_events for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Admin RPCs. SECURITY DEFINER, empty search_path, is_admin() first.
-- ---------------------------------------------------------------------------

create function public.admin_create_web_atelier_scope_version(
  p_inquiry_id uuid,
  p_scope jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inquiry public.web_atelier_inquiries%rowtype;
  v_version integer;
  v_id uuid;
begin
  perform public.web_atelier_require_admin();

  v_inquiry := public.web_atelier_lock_inquiry(p_inquiry_id);

  if v_inquiry.archived_at is not null then
    raise exception 'inquiry_archived';
  end if;

  select coalesce(max(s.version_number), 0) + 1 into v_version
  from public.web_atelier_scope_versions s
  where s.inquiry_id = p_inquiry_id;

  insert into public.web_atelier_scope_versions (
    department, inquiry_id, version_number, scope, scope_sha256, created_by
  )
  values ('web_atelier', p_inquiry_id, v_version, p_scope, repeat('0', 64), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

create function public.admin_create_web_atelier_offer_draft(
  p_inquiry_id uuid,
  p_copy_from_offer_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inquiry public.web_atelier_inquiries%rowtype;
  v_source public.web_atelier_offers%rowtype;
  v_open public.web_atelier_offers%rowtype;
  v_version integer;
  v_id uuid;
  v_number text;
  v_lock_id uuid;
begin
  perform public.web_atelier_require_admin();

  -- Lock order: inquiry first, then every related offer by id ascending.
  v_inquiry := public.web_atelier_lock_inquiry(p_inquiry_id);

  if v_inquiry.archived_at is not null then
    raise exception 'inquiry_archived';
  end if;
  if v_inquiry.status not in ('under_review', 'accepted') then
    raise exception 'inquiry_not_reviewed';
  end if;
  if v_inquiry.risk_state in ('suspected', 'blocked') then
    raise exception 'inquiry_risk_blocked';
  end if;

  for v_lock_id in
    select o.id
    from public.web_atelier_offers o
    where o.inquiry_id = p_inquiry_id
    order by o.id
    for update
  loop
    null;
  end loop;

  if exists (
    select 1 from public.web_atelier_offers o
    where o.inquiry_id = p_inquiry_id and o.status = 'draft'
  ) then
    raise exception 'draft_already_exists';
  end if;

  select * into v_open
  from public.web_atelier_offers o
  where o.inquiry_id = p_inquiry_id and o.status in ('sent', 'accepted');

  if found then
    if v_open.status = 'accepted' then
      raise exception 'offer_already_accepted';
    end if;
    if p_copy_from_offer_id is distinct from v_open.id then
      raise exception 'open_offer_exists';
    end if;
  end if;

  if p_copy_from_offer_id is not null then
    select * into v_source
    from public.web_atelier_offers o
    where o.id = p_copy_from_offer_id
      and o.inquiry_id = p_inquiry_id;

    if not found then
      raise exception 'source_offer_not_found';
    end if;
    if v_source.status in ('draft', 'accepted') then
      raise exception 'source_offer_not_revisable';
    end if;
  end if;

  select coalesce(max(o.version), 0) + 1 into v_version
  from public.web_atelier_offers o
  where o.inquiry_id = p_inquiry_id;

  v_number := public.web_atelier_format_ref(
    'WO', pg_catalog.nextval('public.web_atelier_offer_ref_seq')
  );

  insert into public.web_atelier_offers (
    offer_number, department, inquiry_id, version, status,
    supersedes_offer_id, title, package_tier, client_name, client_email,
    scope_version_id, terms_note, created_by
  )
  values (
    v_number,
    'web_atelier',
    p_inquiry_id,
    v_version,
    'draft',
    case when v_source.status = 'sent' then v_source.id else null end,
    coalesce(v_source.title, 'Ponuda za web projekt'),
    coalesce(
      v_source.package_tier,
      case
        when v_inquiry.package_preference in ('start', 'pro', 'premium')
          then v_inquiry.package_preference
        else null
      end
    ),
    coalesce(v_source.client_name, v_inquiry.contact_name),
    coalesce(v_source.client_email, v_inquiry.email),
    v_source.scope_version_id,
    v_source.terms_note,
    auth.uid()
  )
  returning id into v_id;

  if p_copy_from_offer_id is not null then
    insert into public.web_atelier_offer_items (
      offer_id, position, item_type, description, details, quantity, unit_price_cents
    )
    select v_id, i.position, i.item_type, i.description, i.details, i.quantity, i.unit_price_cents
    from public.web_atelier_offer_items i
    where i.offer_id = p_copy_from_offer_id;
  end if;

  return v_id;
end;
$$;

create function public.admin_update_web_atelier_offer_draft(
  p_offer_id uuid,
  p_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.web_atelier_offers%rowtype;
  v_key text;
  v_scope_inquiry uuid;
  v_inquiry_id uuid;
begin
  perform public.web_atelier_require_admin();

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch_invalid';
  end if;

  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in (
      'title', 'package_tier', 'client_name', 'client_email',
      'valid_until', 'terms_note', 'scope_version_id'
    ) then
      raise exception 'patch_unknown_key';
    end if;
  end loop;

  select o.inquiry_id into v_inquiry_id
  from public.web_atelier_offers o
  where o.id = p_offer_id;
  if v_inquiry_id is null then
    raise exception 'offer_not_found';
  end if;

  -- Lock order: inquiry → offer.
  perform public.web_atelier_lock_inquiry(v_inquiry_id);
  v_offer := public.web_atelier_lock_offer(p_offer_id);

  if v_offer.status <> 'draft' then
    raise exception 'offer_not_draft';
  end if;

  if jsonb_exists(p_patch, 'scope_version_id') and p_patch ->> 'scope_version_id' is not null then
    select s.inquiry_id into v_scope_inquiry
    from public.web_atelier_scope_versions s
    where s.id = (p_patch ->> 'scope_version_id')::uuid;

    if v_scope_inquiry is distinct from v_offer.inquiry_id then
      raise exception 'scope_version_mismatch';
    end if;
  end if;

  update public.web_atelier_offers o
  set title = case when jsonb_exists(p_patch, 'title') then btrim(p_patch ->> 'title') else o.title end,
      package_tier = case when jsonb_exists(p_patch, 'package_tier')
        then nullif(btrim(coalesce(p_patch ->> 'package_tier', '')), '') else o.package_tier end,
      client_name = case when jsonb_exists(p_patch, 'client_name') then btrim(p_patch ->> 'client_name') else o.client_name end,
      client_email = case when jsonb_exists(p_patch, 'client_email')
        then lower(btrim(p_patch ->> 'client_email')) else o.client_email end,
      valid_until = case when jsonb_exists(p_patch, 'valid_until')
        then nullif(btrim(coalesce(p_patch ->> 'valid_until', '')), '')::date else o.valid_until end,
      terms_note = case when jsonb_exists(p_patch, 'terms_note')
        then nullif(btrim(coalesce(p_patch ->> 'terms_note', '')), '') else o.terms_note end,
      scope_version_id = case when jsonb_exists(p_patch, 'scope_version_id')
        then (p_patch ->> 'scope_version_id')::uuid else o.scope_version_id end
  where o.id = p_offer_id;
end;
$$;

create function public.admin_set_web_atelier_offer_items(
  p_offer_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.web_atelier_offers%rowtype;
  v_item jsonb;
  v_key text;
  v_pos integer := 0;
  v_clean jsonb := '[]'::jsonb;
  v_desc text;
  v_details text;
  v_qty numeric;
  v_price numeric;
  v_inquiry_id uuid;
begin
  perform public.web_atelier_require_admin();

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'items_invalid';
  end if;

  select o.inquiry_id into v_inquiry_id
  from public.web_atelier_offers o
  where o.id = p_offer_id;
  if v_inquiry_id is null then
    raise exception 'offer_not_found';
  end if;

  -- Lock order: inquiry → offer.
  perform public.web_atelier_lock_inquiry(v_inquiry_id);
  v_offer := public.web_atelier_lock_offer(p_offer_id);

  if v_offer.status <> 'draft' then
    raise exception 'offer_not_draft';
  end if;

  for v_item in select e.value from jsonb_array_elements(p_items) as e(value) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'items_invalid';
    end if;
    for v_key in select jsonb_object_keys(v_item) loop
      if v_key not in ('item_type', 'description', 'details', 'quantity', 'unit_price_cents') then
        raise exception 'items_unknown_key';
      end if;
    end loop;

    if jsonb_typeof(v_item -> 'item_type') is distinct from 'string'
      or (v_item ->> 'item_type') not in ('service', 'addon', 'discount', 'other')
    then
      raise exception 'items_type_invalid';
    end if;

    if jsonb_typeof(v_item -> 'description') is distinct from 'string' then
      raise exception 'items_description_invalid';
    end if;
    v_desc := btrim(v_item ->> 'description');
    if char_length(v_desc) < 1 or char_length(v_desc) > 300 then
      raise exception 'items_description_invalid';
    end if;

    v_details := null;
    if jsonb_exists(v_item, 'details') and jsonb_typeof(v_item -> 'details') <> 'null' then
      if jsonb_typeof(v_item -> 'details') <> 'string' then
        raise exception 'items_details_invalid';
      end if;
      v_details := nullif(btrim(v_item ->> 'details'), '');
      if v_details is not null and char_length(v_details) > 1000 then
        raise exception 'items_details_invalid';
      end if;
    end if;

    if jsonb_typeof(v_item -> 'quantity') is distinct from 'number' then
      raise exception 'items_quantity_invalid';
    end if;
    v_qty := (v_item ->> 'quantity')::numeric;
    if v_qty <= 0 or v_qty > 1000 or v_qty <> pg_catalog.round(v_qty, 2) then
      raise exception 'items_quantity_invalid';
    end if;

    if jsonb_typeof(v_item -> 'unit_price_cents') is distinct from 'number' then
      raise exception 'items_price_invalid';
    end if;
    v_price := (v_item ->> 'unit_price_cents')::numeric;
    if v_price <> trunc(v_price) or v_price < 0 or v_price > 100000000 then
      raise exception 'items_price_invalid';
    end if;

    v_pos := v_pos + 1;
    v_clean := v_clean || jsonb_build_array(jsonb_build_object(
      'position', v_pos,
      'item_type', v_item ->> 'item_type',
      'description', v_desc,
      'details', v_details,
      'quantity', v_qty,
      'unit_price_cents', v_price::bigint
    ));
  end loop;

  delete from public.web_atelier_offer_items where offer_id = p_offer_id;

  -- One statement, so the totals trigger sees the complete item set and a
  -- discount line cannot transiently exceed a not-yet-inserted subtotal.
  insert into public.web_atelier_offer_items (
    offer_id, position, item_type, description, details, quantity, unit_price_cents
  )
  select p_offer_id, x.position, x.item_type, x.description, x.details, x.quantity, x.unit_price_cents
  from jsonb_to_recordset(v_clean) as x(
    position integer, item_type text, description text, details text,
    quantity numeric, unit_price_cents bigint
  );

  return (
    select jsonb_build_object(
      'subtotal_cents', o.subtotal_cents,
      'discount_cents', o.discount_cents,
      'total_cents', o.total_cents
    )
    from public.web_atelier_offers o
    where o.id = p_offer_id
  );
end;
$$;

create function public.admin_discard_web_atelier_offer_draft(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.web_atelier_offers%rowtype;
  v_inquiry_id uuid;
begin
  perform public.web_atelier_require_admin();

  select o.inquiry_id into v_inquiry_id
  from public.web_atelier_offers o
  where o.id = p_offer_id;
  if v_inquiry_id is null then
    raise exception 'offer_not_found';
  end if;

  -- Lock order: inquiry → offer (same as create/send/decision).
  perform public.web_atelier_lock_inquiry(v_inquiry_id);
  v_offer := public.web_atelier_lock_offer(p_offer_id);

  if v_offer.status <> 'draft' then
    raise exception 'offer_not_draft';
  end if;

  delete from public.web_atelier_offer_items where offer_id = p_offer_id;
  delete from public.web_atelier_offers where id = p_offer_id;
end;
$$;

create function public.admin_mark_web_atelier_offer_sent(p_offer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.web_atelier_offers%rowtype;
  v_inquiry public.web_atelier_inquiries%rowtype;
  v_scope public.web_atelier_scope_versions%rowtype;
  v_old public.web_atelier_offers%rowtype;
  v_items jsonb;
  v_item_count integer;
  v_snapshot jsonb;
  v_hash text;
  v_now timestamptz := pg_catalog.now();
  v_today date := public.web_atelier_business_date();
  v_lock_id uuid;
  v_inquiry_id uuid;
begin
  perform public.web_atelier_require_admin();

  -- Peek inquiry_id without locking offer first (deadlock-safe order).
  select o.inquiry_id into v_inquiry_id
  from public.web_atelier_offers o
  where o.id = p_offer_id;
  if v_inquiry_id is null then
    raise exception 'offer_not_found';
  end if;

  v_inquiry := public.web_atelier_lock_inquiry(v_inquiry_id);

  -- Lock every offer on this inquiry in id order (includes this draft and any predecessor).
  for v_lock_id in
    select o.id
    from public.web_atelier_offers o
    where o.inquiry_id = v_inquiry_id
    order by o.id
    for update
  loop
    null;
  end loop;

  select * into v_offer
  from public.web_atelier_offers o
  where o.id = p_offer_id;

  if not found then
    raise exception 'offer_not_found';
  end if;
  if v_offer.status <> 'draft' then
    raise exception 'offer_not_draft';
  end if;

  if v_inquiry.archived_at is not null
    or v_inquiry.status not in ('under_review', 'accepted')
    or v_inquiry.risk_state in ('suspected', 'blocked')
  then
    raise exception 'inquiry_not_eligible';
  end if;

  if v_offer.valid_until is null or v_offer.valid_until <= v_today
    or v_offer.valid_until > v_today + 366
  then
    raise exception 'offer_valid_until_invalid';
  end if;

  if v_offer.scope_version_id is null then
    raise exception 'offer_scope_required';
  end if;

  select * into v_scope
  from public.web_atelier_scope_versions s
  where s.id = v_offer.scope_version_id;

  if not found or v_scope.inquiry_id is distinct from v_offer.inquiry_id then
    raise exception 'scope_version_mismatch';
  end if;

  select count(*) into v_item_count
  from public.web_atelier_offer_items i
  where i.offer_id = p_offer_id;

  if v_item_count < 1 then
    raise exception 'offer_items_required';
  end if;
  if v_offer.total_cents <= 0 then
    raise exception 'offer_total_must_be_positive';
  end if;

  if v_offer.supersedes_offer_id is not null then
    select * into v_old
    from public.web_atelier_offers o
    where o.id = v_offer.supersedes_offer_id;

    if not found or v_old.status <> 'sent' then
      raise exception 'superseded_offer_not_open';
    end if;
    if v_old.inquiry_id is distinct from v_offer.inquiry_id then
      raise exception 'superseded_offer_inquiry_mismatch';
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position', i.position,
    'item_type', i.item_type,
    'description', i.description,
    'details', i.details,
    'quantity', i.quantity,
    'unit_price_cents', i.unit_price_cents,
    'line_total_cents', i.line_total_cents
  ) order by i.position), '[]'::jsonb)
  into v_items
  from public.web_atelier_offer_items i
  where i.offer_id = p_offer_id;

  v_snapshot := jsonb_build_object(
    'schema', 'web_atelier_offer_snapshot_v1',
    'offer_number', v_offer.offer_number,
    'version', v_offer.version,
    'department', v_offer.department,
    'issued_at', to_jsonb(v_now),
    'inquiry', jsonb_build_object('id', v_inquiry.id, 'reference_code', v_inquiry.reference_code),
    'client', jsonb_build_object('name', v_offer.client_name, 'email', v_offer.client_email),
    'title', v_offer.title,
    'package_tier', v_offer.package_tier,
    'currency', v_offer.currency,
    'valid_until', v_offer.valid_until,
    'terms_note', v_offer.terms_note,
    'items', v_items,
    'totals', jsonb_build_object(
      'subtotal_cents', v_offer.subtotal_cents,
      'discount_cents', v_offer.discount_cents,
      'total_cents', v_offer.total_cents
    ),
    'scope', jsonb_build_object(
      'id', v_scope.id,
      'version_number', v_scope.version_number,
      'sha256', v_scope.scope_sha256,
      'content', v_scope.scope
    ),
    'notices', jsonb_build_object(
      'not_an_invoice', true,
      'invoice_source', 'parra'
    )
  );

  v_hash := pg_catalog.encode(extensions.digest(v_snapshot::text, 'sha256'), 'hex');

  -- Supersede the previous open version first so the one-open-offer-per-inquiry
  -- unique index is never violated.
  if v_offer.supersedes_offer_id is not null then
    update public.web_atelier_offers o
    set status = 'superseded',
        superseded_at = v_now,
        superseded_by_offer_id = p_offer_id
    where o.id = v_offer.supersedes_offer_id;
  end if;

  update public.web_atelier_offers o
  set status = 'sent',
      snapshot = v_snapshot,
      snapshot_sha256 = v_hash,
      sent_at = v_now,
      sent_by = auth.uid()
  where o.id = p_offer_id;

  return jsonb_build_object(
    'offer_id', p_offer_id,
    'offer_number', v_offer.offer_number,
    'snapshot_sha256', v_hash,
    'sent_at', v_now
  );
end;
$$;

create function public.admin_expire_web_atelier_offers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_today date := public.web_atelier_business_date();
  v_inquiry_id uuid;
  v_offer_id uuid;
begin
  perform public.web_atelier_require_admin();

  -- Lock order: inquiries by id, then their offers by id (same family as send/decision).
  for v_inquiry_id in
    select distinct o.inquiry_id
    from public.web_atelier_offers o
    where o.status = 'sent'
      and o.valid_until < v_today
      and o.inquiry_id is not null
    order by 1
  loop
    perform public.web_atelier_lock_inquiry(v_inquiry_id);
    for v_offer_id in
      select o.id
      from public.web_atelier_offers o
      where o.inquiry_id = v_inquiry_id
      order by o.id
      for update
    loop
      null;
    end loop;
  end loop;

  with expired as (
    update public.web_atelier_offers o
    set status = 'expired',
        expired_at = pg_catalog.now()
    where o.status = 'sent'
      and o.valid_until < v_today
    returning 1
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;

create function public.admin_record_web_atelier_offer_delivery(
  p_offer_id uuid,
  p_delivered_at timestamptz,
  p_delivery_channel text,
  p_delivery_reference text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.web_atelier_offers%rowtype;
  v_inquiry_id uuid;
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

  if v_offer.status <> 'sent' then
    raise exception 'offer_not_open_for_delivery';
  end if;
  if v_offer.delivered_at is not null then
    raise exception 'offer_already_delivered';
  end if;
  if p_delivered_at is null then
    raise exception 'delivered_at_required';
  end if;
  if p_delivered_at < v_offer.sent_at then
    raise exception 'delivery_before_issuance';
  end if;
  if p_delivered_at > pg_catalog.now() + interval '5 minutes' then
    raise exception 'delivery_in_future';
  end if;
  if p_delivery_channel is null
    or p_delivery_channel not in ('email_manual', 'meeting', 'courier', 'other')
  then
    raise exception 'delivery_channel_invalid';
  end if;
  if char_length(btrim(coalesce(p_delivery_reference, ''))) < 10 then
    raise exception 'delivery_reference_required';
  end if;

  update public.web_atelier_offers o
  set delivered_at = p_delivered_at,
      delivered_by = auth.uid(),
      delivery_channel = p_delivery_channel,
      delivery_reference = btrim(p_delivery_reference)
  where o.id = p_offer_id;
end;
$$;

create function public.admin_record_web_atelier_offer_decision(
  p_offer_id uuid,
  p_decision text,
  p_expected_offer_version integer,
  p_expected_snapshot_sha256 text,
  p_decided_by_name text,
  p_decided_at timestamptz,
  p_evidence_channel text,
  p_evidence_reference text,
  p_evidence_retention_note text,
  p_note text,
  p_admin_confirmed boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.web_atelier_offers%rowtype;
  v_approval_id uuid;
  v_now timestamptz := pg_catalog.now();
  v_inquiry_id uuid;
begin
  perform public.web_atelier_require_admin();

  if p_decision is null or p_decision not in ('accepted', 'rejected') then
    raise exception 'decision_invalid';
  end if;
  if p_admin_confirmed is distinct from true then
    raise exception 'admin_confirmation_required';
  end if;
  if p_decided_at is null then
    raise exception 'decided_at_required';
  end if;
  if p_expected_offer_version is null then
    raise exception 'offer_version_required';
  end if;
  if char_length(btrim(coalesce(p_evidence_retention_note, ''))) < 10 then
    raise exception 'evidence_retention_note_required';
  end if;

  select o.inquiry_id into v_inquiry_id
  from public.web_atelier_offers o
  where o.id = p_offer_id;
  if v_inquiry_id is null then
    raise exception 'offer_not_found';
  end if;

  perform public.web_atelier_lock_inquiry(v_inquiry_id);
  v_offer := public.web_atelier_lock_offer(p_offer_id);

  if v_offer.status <> 'sent' then
    raise exception 'offer_not_open_for_decision';
  end if;
  if v_offer.delivered_at is null then
    raise exception 'offer_delivery_required_before_decision';
  end if;
  if p_expected_offer_version is distinct from v_offer.version
    or p_expected_snapshot_sha256 is distinct from v_offer.snapshot_sha256
  then
    raise exception 'snapshot_mismatch';
  end if;

  insert into public.web_atelier_approvals (
    offer_id, decision, offer_number, offer_version, offer_snapshot_sha256, method,
    decided_by_name, decided_at, evidence_channel, evidence_reference,
    evidence_retention_note, note, admin_confirmed_evidence, recorded_by
  )
  values (
    p_offer_id, p_decision, v_offer.offer_number, v_offer.version, v_offer.snapshot_sha256,
    'admin_recorded', btrim(coalesce(p_decided_by_name, '')), p_decided_at,
    coalesce(p_evidence_channel, ''), btrim(coalesce(p_evidence_reference, '')),
    btrim(p_evidence_retention_note), nullif(btrim(coalesce(p_note, '')), ''),
    true, auth.uid()
  )
  returning id into v_approval_id;

  update public.web_atelier_offers o
  set status = p_decision,
      accepted_at = case when p_decision = 'accepted' then v_now else null end,
      rejected_at = case when p_decision = 'rejected' then v_now else null end
  where o.id = p_offer_id;

  return v_approval_id;
end;
$$;

create function public.admin_create_web_atelier_project_from_offer(p_offer_id uuid)
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
      'created', false
    );
  end if;

  v_number := public.web_atelier_format_ref(
    'WP', pg_catalog.nextval('public.web_atelier_project_ref_seq')
  );

  insert into public.web_atelier_projects (
    project_number, department, inquiry_id, offer_id, approval_id, scope_version_id,
    title, client_name, client_email, currency, agreed_total_cents, status, created_by
  )
  values (
    v_number, v_offer.department, v_offer.inquiry_id, v_offer.id, v_approval_id,
    v_offer.scope_version_id, v_offer.title, v_offer.client_name, v_offer.client_email,
    v_offer.currency, v_offer.total_cents, 'preparing', auth.uid()
  )
  returning id into v_id;

  insert into public.web_atelier_project_events (project_id, event_type, to_status, actor)
  values (v_id, 'project_created', 'preparing', auth.uid());

  return jsonb_build_object('project_id', v_id, 'project_number', v_number, 'created', true);
end;
$$;

create function public.admin_update_web_atelier_project(
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
begin
  perform public.web_atelier_require_admin();

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch_invalid';
  end if;

  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in ('title', 'notes', 'status') then
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

  if jsonb_exists(p_patch, 'title') and btrim(coalesce(p_patch ->> 'title', '')) is distinct from v_project.title then
    v_details_changed := true;
  end if;
  if jsonb_exists(p_patch, 'notes')
    and nullif(btrim(coalesce(p_patch ->> 'notes', '')), '') is distinct from v_project.notes
  then
    v_details_changed := true;
  end if;

  update public.web_atelier_projects p
  set title = case when jsonb_exists(p_patch, 'title') then btrim(coalesce(p_patch ->> 'title', '')) else p.title end,
      notes = case when jsonb_exists(p_patch, 'notes')
        then nullif(btrim(coalesce(p_patch ->> 'notes', '')), '') else p.notes end,
      status = v_new_status
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
end;
$$;

-- Only authenticated may call; each function re-checks is_admin() itself.
revoke all on function public.admin_create_web_atelier_scope_version(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.admin_create_web_atelier_offer_draft(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_update_web_atelier_offer_draft(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.admin_set_web_atelier_offer_items(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.admin_discard_web_atelier_offer_draft(uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_mark_web_atelier_offer_sent(uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_expire_web_atelier_offers() from public, anon, authenticated, service_role;
revoke all on function public.admin_record_web_atelier_offer_delivery(uuid, timestamptz, text, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_record_web_atelier_offer_decision(uuid, text, integer, text, text, timestamptz, text, text, text, text, boolean) from public, anon, authenticated, service_role;
revoke all on function public.admin_create_web_atelier_project_from_offer(uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_update_web_atelier_project(uuid, jsonb) from public, anon, authenticated, service_role;

grant execute on function public.admin_create_web_atelier_scope_version(uuid, jsonb) to authenticated;
grant execute on function public.admin_create_web_atelier_offer_draft(uuid, uuid) to authenticated;
grant execute on function public.admin_update_web_atelier_offer_draft(uuid, jsonb) to authenticated;
grant execute on function public.admin_set_web_atelier_offer_items(uuid, jsonb) to authenticated;
grant execute on function public.admin_discard_web_atelier_offer_draft(uuid) to authenticated;
grant execute on function public.admin_mark_web_atelier_offer_sent(uuid) to authenticated;
grant execute on function public.admin_expire_web_atelier_offers() to authenticated;
grant execute on function public.admin_record_web_atelier_offer_delivery(uuid, timestamptz, text, text) to authenticated;
grant execute on function public.admin_record_web_atelier_offer_decision(uuid, text, integer, text, text, timestamptz, text, text, text, text, boolean) to authenticated;
grant execute on function public.admin_create_web_atelier_project_from_offer(uuid) to authenticated;
grant execute on function public.admin_update_web_atelier_project(uuid, jsonb) to authenticated;

comment on function public.admin_mark_web_atelier_offer_sent(uuid) is
  'Freezes a complete draft into an immutable SENT snapshot with SHA-256 and supersedes the previous open version. Does NOT record client delivery, send e-mail, or create an invoice.';

comment on function public.admin_record_web_atelier_offer_delivery(uuid, timestamptz, text, text) is
  'Records that an issued snapshot was manually delivered to the client. Auditable; sends no e-mail.';

comment on function public.admin_record_web_atelier_offer_decision(uuid, text, integer, text, text, timestamptz, text, text, text, text, boolean) is
  'Records an explicit accepted/rejected decision bound to offer_number + offer_version + snapshot hash after delivery. Requires admin_confirmed and a retention note. Database does not verify the external evidence.';

comment on function public.admin_create_web_atelier_project_from_offer(uuid) is
  'Creates at most one project (status preparing) for an ACCEPTED offer that has a matching acceptance approval. Idempotent.';
