-- F2.4 finance simplification — installment receipt confirmation (no second ledger).
-- Additive after 20261017010000. Do NOT auto-apply to production from this task.
--
-- Parra remains authoritative for invoices / fiscalization / actual payments.
-- Confirmation marks that an admin verified receipt in Parra or the bank account.
-- Never inserts into web_atelier_payment_records.
-- Public tracking may see label + confirmation status/date only (no amounts).

-- ---------------------------------------------------------------------------
-- Preflight
-- ---------------------------------------------------------------------------

do $preflight$
begin
  if to_regclass('public.web_atelier_payment_schedules') is null then
    raise exception 'F2.4 receipt: payment_schedules missing (apply G–I first)';
  end if;
  if to_regprocedure('public.get_web_atelier_project_public_status(text)') is null then
    raise exception 'F2.4 receipt: public tracking RPC missing';
  end if;
  if to_regprocedure('public.web_atelier_require_admin()') is null then
    raise exception 'F2.4 receipt: web_atelier_require_admin() missing';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- Schedule confirmation columns
-- ---------------------------------------------------------------------------

alter table public.web_atelier_payment_schedules
  add column if not exists receipt_confirmed_at timestamptz,
  add column if not exists receipt_confirmed_by uuid references auth.users (id) on delete set null;

comment on column public.web_atelier_payment_schedules.receipt_confirmed_at is
  'Admin confirmed receipt after checking Parra/bank. Not an invoice or ledger entry.';

-- ---------------------------------------------------------------------------
-- Narrow audit trail (admin-only)
-- ---------------------------------------------------------------------------

create table if not exists public.web_atelier_payment_receipt_events (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.web_atelier_payment_schedules (id) on delete cascade,
  project_id uuid not null references public.web_atelier_projects (id) on delete cascade,
  event_type text not null
    check (event_type in ('confirmed', 'corrected')),
  reason text,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint web_atelier_payment_receipt_events_reason_len
    check (
      (event_type = 'confirmed' and reason is null)
      or (
        event_type = 'corrected'
        and reason is not null
        and char_length(btrim(reason)) between 3 and 2000
      )
    )
);

create index if not exists web_atelier_payment_receipt_events_schedule_idx
  on public.web_atelier_payment_receipt_events (schedule_id, created_at desc);

create index if not exists web_atelier_payment_receipt_events_project_idx
  on public.web_atelier_payment_receipt_events (project_id, created_at desc);

alter table public.web_atelier_payment_receipt_events enable row level security;

revoke all on table public.web_atelier_payment_receipt_events
  from public, anon, authenticated, service_role;

grant select on table public.web_atelier_payment_receipt_events to authenticated;

drop policy if exists web_atelier_payment_receipt_events_admin_select
  on public.web_atelier_payment_receipt_events;

create policy web_atelier_payment_receipt_events_admin_select
  on public.web_atelier_payment_receipt_events for select to authenticated
  using (public.is_admin());

-- Prevent direct mutation of confirmation columns except via RPCs (session flag).
create or replace function public.web_atelier_finance_guard()
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

    if tg_op = 'UPDATE'
      and new.status = 'paid'
      and old.status is distinct from 'paid'
      and coalesce(current_setting('anis.finance_allow_paid', true), '') is distinct from '1'
    then
      raise exception 'payment_status_paid_requires_payment_record';
    end if;

    -- Confirmation metadata is RPC-only.
    if tg_op = 'UPDATE'
      and (
        new.receipt_confirmed_at is distinct from old.receipt_confirmed_at
        or new.receipt_confirmed_by is distinct from old.receipt_confirmed_by
      )
      and coalesce(current_setting('anis.finance_allow_receipt', true), '') is distinct from '1'
    then
      raise exception 'payment_receipt_mutation_forbidden';
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

  if tg_table_name = 'web_atelier_payment_receipt_events' then
    if tg_op = 'DELETE' then
      raise exception 'payment_receipt_event_delete_forbidden';
    end if;
    if tg_op = 'UPDATE' then
      raise exception 'payment_receipt_event_update_forbidden';
    end if;
    if new.reason is not null then
      new.reason := nullif(btrim(new.reason), '');
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists web_atelier_payment_receipt_events_guard_trg
  on public.web_atelier_payment_receipt_events;

create trigger web_atelier_payment_receipt_events_guard_trg
  before insert or update or delete on public.web_atelier_payment_receipt_events
  for each row execute function public.web_atelier_finance_guard();

-- ---------------------------------------------------------------------------
-- Admin: confirm / correct receipt (no payment_records writes)
-- ---------------------------------------------------------------------------

create or replace function public.admin_confirm_web_atelier_payment_receipt(p_schedule_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.web_atelier_payment_schedules%rowtype;
  v_already boolean := false;
begin
  perform public.web_atelier_require_admin();

  if p_schedule_id is null then
    raise exception 'payment_schedule_id_required';
  end if;

  select * into v_row
  from public.web_atelier_payment_schedules s
  where s.id = p_schedule_id
  for update;

  if not found then
    raise exception 'payment_schedule_not_found';
  end if;

  perform public.web_atelier_lock_project(v_row.project_id);

  if v_row.status in ('cancelled', 'waived') then
    raise exception 'payment_schedule_not_confirmable';
  end if;

  if v_row.receipt_confirmed_at is not null then
    v_already := true;
    return jsonb_build_object(
      'schedule_id', v_row.id,
      'already_confirmed', true,
      'receipt_confirmed_at', v_row.receipt_confirmed_at,
      'receipt_confirmed_by', v_row.receipt_confirmed_by
    );
  end if;

  perform set_config('anis.finance_allow_receipt', '1', true);

  update public.web_atelier_payment_schedules s
  set
    receipt_confirmed_at = pg_catalog.now(),
    receipt_confirmed_by = auth.uid(),
    updated_at = pg_catalog.now()
  where s.id = p_schedule_id
  returning * into v_row;

  insert into public.web_atelier_payment_receipt_events (
    schedule_id, project_id, event_type, reason, actor_id
  ) values (
    v_row.id, v_row.project_id, 'confirmed', null, auth.uid()
  );

  return jsonb_build_object(
    'schedule_id', v_row.id,
    'already_confirmed', false,
    'receipt_confirmed_at', v_row.receipt_confirmed_at,
    'receipt_confirmed_by', v_row.receipt_confirmed_by
  );
end;
$$;

create or replace function public.admin_correct_web_atelier_payment_receipt(
  p_schedule_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.web_atelier_payment_schedules%rowtype;
  v_reason text;
begin
  perform public.web_atelier_require_admin();

  if p_schedule_id is null then
    raise exception 'payment_schedule_id_required';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 3 or char_length(v_reason) > 2000 then
    raise exception 'payment_receipt_correction_reason_invalid';
  end if;

  select * into v_row
  from public.web_atelier_payment_schedules s
  where s.id = p_schedule_id
  for update;

  if not found then
    raise exception 'payment_schedule_not_found';
  end if;

  perform public.web_atelier_lock_project(v_row.project_id);

  if v_row.receipt_confirmed_at is null then
    raise exception 'payment_receipt_not_confirmed';
  end if;

  perform set_config('anis.finance_allow_receipt', '1', true);

  update public.web_atelier_payment_schedules s
  set
    receipt_confirmed_at = null,
    receipt_confirmed_by = null,
    updated_at = pg_catalog.now()
  where s.id = p_schedule_id
  returning * into v_row;

  insert into public.web_atelier_payment_receipt_events (
    schedule_id, project_id, event_type, reason, actor_id
  ) values (
    v_row.id, v_row.project_id, 'corrected', v_reason, auth.uid()
  );

  return jsonb_build_object(
    'schedule_id', v_row.id,
    'receipt_confirmed_at', null,
    'corrected', true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: save payment plan (full / advance+balance / custom)
-- Does not overwrite existing installments.
-- ---------------------------------------------------------------------------

create or replace function public.admin_save_web_atelier_payment_plan(
  p_project_id uuid,
  p_plan_kind text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.web_atelier_projects%rowtype;
  v_kind text;
  v_items jsonb;
  v_item jsonb;
  v_sum bigint := 0;
  v_amount bigint;
  v_label text;
  v_due date;
  v_pos integer;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_count integer;
begin
  perform public.web_atelier_require_admin();

  if p_project_id is null then
    raise exception 'project_id_required';
  end if;

  select * into v_project
  from public.web_atelier_projects p
  where p.id = p_project_id
  for update;

  if not found then
    raise exception 'project_not_found';
  end if;

  if exists (
    select 1
    from public.web_atelier_payment_schedules s
    where s.project_id = p_project_id
      and s.status is distinct from 'cancelled'
  ) then
    raise exception 'payment_plan_already_exists';
  end if;

  v_kind := btrim(coalesce(p_plan_kind, ''));
  if v_kind not in ('full', 'advance_balance', 'custom') then
    raise exception 'payment_plan_kind_invalid';
  end if;

  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'payment_plan_items_invalid';
  end if;

  v_items := p_items;
  v_count := jsonb_array_length(v_items);

  if v_kind = 'full' and v_count is distinct from 1 then
    raise exception 'payment_plan_full_requires_one_item';
  end if;
  if v_kind = 'advance_balance' and v_count is distinct from 2 then
    raise exception 'payment_plan_advance_requires_two_items';
  end if;
  if v_kind = 'custom' and v_count < 1 then
    raise exception 'payment_plan_custom_requires_items';
  end if;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_amount := (v_item->>'amount_cents')::bigint;
    if v_amount is null or v_amount < 0 or v_amount > 100000000000 then
      raise exception 'payment_plan_amount_invalid';
    end if;
    v_sum := v_sum + v_amount;
  end loop;

  if v_sum is distinct from v_project.agreed_total_cents then
    raise exception 'payment_plan_total_mismatch';
  end if;

  v_pos := 0;
  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_label := btrim(coalesce(v_item->>'label', ''));
    if char_length(v_label) < 1 or char_length(v_label) > 200 then
      raise exception 'payment_plan_label_invalid';
    end if;
    v_due := nullif(v_item->>'due_date', '')::date;
    v_amount := (v_item->>'amount_cents')::bigint;

    insert into public.web_atelier_payment_schedules (
      project_id, label, due_date, amount_cents, notes, position, created_by, status
    ) values (
      p_project_id, v_label, v_due, v_amount, null, v_pos, auth.uid(), 'planned'
    )
    returning id into v_id;

    v_ids := array_append(v_ids, v_id);
    v_pos := v_pos + 1;
  end loop;

  return jsonb_build_object(
    'project_id', p_project_id,
    'plan_kind', v_kind,
    'schedule_ids', to_jsonb(v_ids),
    'agreed_total_cents', v_project.agreed_total_cents
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Extend admin finance list with confirmation fields + audit (still admin-only)
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_web_atelier_finance(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_schedules jsonb;
  v_documents jsonb;
  v_payments jsonb;
  v_receipt_events jsonb;
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
      'created_at', s.created_at,
      'receipt_confirmed_at', s.receipt_confirmed_at,
      'receipt_confirmed_by', s.receipt_confirmed_by,
      'receipt_status', case
        when s.receipt_confirmed_at is not null then 'confirmed'
        when s.status in ('cancelled', 'waived') then s.status
        else 'awaiting'
      end
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

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'schedule_id', e.schedule_id,
      'event_type', e.event_type,
      'reason', e.reason,
      'actor_id', e.actor_id,
      'created_at', e.created_at
    )
    order by e.created_at desc
  ), '[]'::jsonb)
  into v_receipt_events
  from public.web_atelier_payment_receipt_events e
  where e.project_id = p_project_id;

  return jsonb_build_object(
    'schedules', v_schedules,
    'documents', v_documents,
    'payments', v_payments,
    'receipt_events', v_receipt_events
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Public tracking: optional receipts allowlist (no amounts / Parra / admin ids)
-- ---------------------------------------------------------------------------

create or replace function public.get_web_atelier_project_public_status(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_hash text;
  v_tok public.web_atelier_project_tracking_tokens%rowtype;
  v_project public.web_atelier_projects%rowtype;
  v_copy jsonb;
  v_receipts jsonb;
begin
  v_token := btrim(coalesce(p_token, ''));
  if v_token !~ '^wat_[0-9a-f]{64}$' then
    raise exception 'tracking_token_invalid';
  end if;

  v_hash := public.web_atelier_hash_tracking_token(v_token);

  select * into v_tok
  from public.web_atelier_project_tracking_tokens t
  where t.token_hash = v_hash
  for update;

  if not found then
    raise exception 'tracking_token_invalid';
  end if;

  if v_tok.revoked_at is not null then
    raise exception 'tracking_token_revoked';
  end if;

  if v_tok.expires_at <= now() then
    raise exception 'tracking_token_expired';
  end if;

  if v_tok.purpose is distinct from 'project_status_read' then
    raise exception 'tracking_token_invalid';
  end if;

  select * into v_project
  from public.web_atelier_projects p
  where p.id = v_tok.project_id;

  if not found then
    raise exception 'tracking_token_invalid';
  end if;

  update public.web_atelier_project_tracking_tokens t
  set last_used_at = now(),
      use_count = t.use_count + 1
  where t.id = v_tok.id;

  v_copy := public.web_atelier_project_status_public_copy(v_project.status);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'label', s.label,
      'status', case
        when s.receipt_confirmed_at is not null then 'confirmed'
        else 'awaiting'
      end,
      'confirmed_on', case
        when s.receipt_confirmed_at is not null then (s.receipt_confirmed_at at time zone 'UTC')::date::text
        else null
      end
    )
    order by s.position, s.due_date nulls last, s.created_at
  ), '[]'::jsonb)
  into v_receipts
  from public.web_atelier_payment_schedules s
  where s.project_id = v_project.id
    and s.status is distinct from 'cancelled'
    and s.status is distinct from 'waived';

  -- Least-privilege public payload. No PII, notes, money, Parra refs, or admin ids.
  return jsonb_build_object(
    'project_number', v_project.project_number,
    'title', v_project.title,
    'status', v_project.status,
    'status_label_hr', v_copy ->> 'label',
    'status_description_hr', v_copy ->> 'description',
    'checked_at', now(),
    'receipts', v_receipts
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants (admin RPCs authenticated-only; public tracking unchanged: anon+auth)
-- ---------------------------------------------------------------------------

revoke all on function public.admin_confirm_web_atelier_payment_receipt(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_correct_web_atelier_payment_receipt(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_save_web_atelier_payment_plan(uuid, text, jsonb)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_confirm_web_atelier_payment_receipt(uuid)
  to authenticated;
grant execute on function public.admin_correct_web_atelier_payment_receipt(uuid, text)
  to authenticated;
grant execute on function public.admin_save_web_atelier_payment_plan(uuid, text, jsonb)
  to authenticated;

-- Public status remains callable by anon (token is the secret).
revoke all on function public.get_web_atelier_project_public_status(text)
  from public;
grant execute on function public.get_web_atelier_project_public_status(text)
  to anon, authenticated;
