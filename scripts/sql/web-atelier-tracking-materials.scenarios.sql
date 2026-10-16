-- LOCAL TEST SCENARIOS for F2.4.16E–F (throwaway Docker postgres only).

\set ON_ERROR_STOP on
select t.as_postgres();

create function t.mk_inquiry(p_name text) returns uuid language sql as $$
  select (public.create_public_web_atelier_inquiry(
    gen_random_uuid(), 'hr', 'pro', p_name, 'ana@example.com', null, null, null,
    array['Web shop'], null, array['Dobiti upite (leadove)'], null, null, null, null,
    array['Minimalistički'], null, null, array['Blog / novosti'], null, null,
    '1000-3000', null::date, null, 'email', null, 'Opis projekta za test sustava.'
  ) ->> 'inquiry_id')::uuid
$$;

create function t.scope_json() returns jsonb language sql as $$
  select jsonb_build_object(
    'summary', 'Web stranica s 5 podstranica',
    'deliverables', jsonb_build_array('Dizajn', 'Izrada'),
    'exclusions', jsonb_build_array('Copywriting'),
    'assumptions', jsonb_build_array('Klijent isporučuje sadržaj'),
    'revision_rounds', 2
  )
$$;

create function t.items_json() returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('item_type','service','description','Web stranica PRO','quantity',1,'unit_price_cents',50000)
  )
$$;

create function t.ev(p_offer_id uuid, p_version integer, p_narrative text)
returns text language sql stable as $$
  select coalesce(
    (select offer_number from public.web_atelier_offers where id = p_offer_id),
    'WO-0000-000000'
  ) || ' #v' || p_version::text || ' — ' || p_narrative
$$;

create function t.retention() returns text language sql immutable as $$
  select 'Mailbox arhiva Inbox/WebAtelier/2026'
$$;

-- Build accepted project: inquiry → draft → items → scope → send → deliver → accept → project.
create function t.mk_accepted_project(p_name text)
returns uuid
language plpgsql
as $$
declare
  v_inq uuid;
  v_offer uuid;
  v_scope uuid;
  v_hash text;
  v_proj jsonb;
begin
  perform t.as_postgres();
  v_inq := t.mk_inquiry(p_name);
  update public.web_atelier_inquiries set status = 'under_review' where id = v_inq;

  perform t.as_admin();
  v_offer := public.admin_create_web_atelier_offer_draft(v_inq);
  perform public.admin_set_web_atelier_offer_items(v_offer, t.items_json());
  v_scope := public.admin_create_web_atelier_scope_version(v_inq, t.scope_json());
  perform public.admin_update_web_atelier_offer_draft(
    v_offer,
    jsonb_build_object(
      'scope_version_id', v_scope,
      'valid_until', (public.web_atelier_business_date() + 14)::text
    )
  );
  perform public.admin_mark_web_atelier_offer_sent(v_offer);
  select snapshot_sha256 into v_hash from public.web_atelier_offers where id = v_offer;
  perform public.admin_record_web_atelier_offer_delivery(
    v_offer, now(), 'email_manual', 'Ručno poslano e-mailom klijentu za E-F test'
  );
  perform public.admin_record_web_atelier_offer_decision(
    v_offer, 'accepted', 1, v_hash, p_name, now(), 'email',
    t.ev(v_offer, 1, 'E-mail potvrda prihvacanja za E-F test'),
    t.retention(), null, true
  );
  v_proj := public.admin_create_web_atelier_project_from_offer(v_offer);
  return (v_proj ->> 'project_id')::uuid;
end;
$$;

grant execute on all functions in schema t to public;

-- ===========================================================================
-- Authz baselines
-- ===========================================================================
select t.as_admin();
select t.mk_accepted_project('Track Client A') as project_a \gset
select t.mk_accepted_project('Track Client B') as project_b \gset

select t.as_anon();
select t.fails($q$ select * from public.web_atelier_project_tracking_tokens $q$, 'permission denied', 'anon cannot select tracking tokens');
select t.fails($q$ select * from public.web_atelier_material_requirements $q$, 'permission denied', 'anon cannot select materials');
select t.fails($q$ select * from public.web_atelier_material_file_meta $q$, 'permission denied', 'anon cannot select file meta');
select t.fails(format($q$ select public.admin_create_web_atelier_project_tracking_token(%L, now() + interval '7 days', 'x') $q$, :'project_a'), 'permission denied', 'anon cannot create tracking token');
select t.fails(format($q$ select public.admin_create_web_atelier_material_requirement(%L,'logo','Logo') $q$, :'project_a'), 'permission denied', 'anon cannot create material');

select t.as_user();
select t.fails(format($q$ select public.admin_create_web_atelier_project_tracking_token(%L, now() + interval '7 days', 'x') $q$, :'project_a'), 'forbidden', 'non-admin cannot create tracking token');
select t.fails(format($q$ select public.admin_list_web_atelier_project_tracking_tokens(%L) $q$, :'project_a'), 'forbidden', 'non-admin cannot list tracking tokens');
select t.fails(format($q$ select public.admin_create_web_atelier_material_requirement(%L,'logo','Logo') $q$, :'project_a'), 'forbidden', 'non-admin cannot create material');
select t.fails(format($q$ select public.admin_list_web_atelier_material_requirements(%L) $q$, :'project_a'), 'forbidden', 'non-admin cannot list materials');

select t.as_service();
select t.fails(format($q$ select public.admin_create_web_atelier_project_tracking_token(%L, now() + interval '7 days', 'x') $q$, :'project_a'), 'forbidden|permission denied', 'service_role cannot create tracking token');

select t.as_admin();
select t.fails($q$ select * from public.web_atelier_project_tracking_tokens $q$, 'permission denied', 'admin has no direct select on token hashes');

-- ===========================================================================
-- Tracking tokens: create, hash-only, public status, negative cases
-- ===========================================================================
select public.admin_create_web_atelier_project_tracking_token(
  :'project_a', now() + interval '30 days', 'klijent v1'
) as tok_a \gset
select :'tok_a'::jsonb ->> 'token' as token_a \gset
select :'tok_a'::jsonb ->> 'token_id' as token_a_id \gset

select t.ok((:'tok_a'::jsonb ->> 'token') ~ '^wat_[0-9a-f]{64}$', 'plaintext token format wat_+64hex');

select t.as_postgres();
select t.ok((select count(*) = 1 from public.web_atelier_project_tracking_tokens where id = :'token_a_id'::uuid), 'token row stored');
select t.ok((select token_hash ~ '^[0-9a-f]{64}$' from public.web_atelier_project_tracking_tokens where id = :'token_a_id'::uuid), 'stored value is hash');
select t.ok((select token_hash <> :'token_a' from public.web_atelier_project_tracking_tokens where id = :'token_a_id'::uuid), 'plaintext token is not stored');
select t.ok((
  select token_hash = encode(extensions.digest(:'token_a', 'sha256'), 'hex')
  from public.web_atelier_project_tracking_tokens where id = :'token_a_id'::uuid
), 'stored hash matches digest of plaintext');
select t.as_admin();

select t.fails(format($q$ select public.admin_create_web_atelier_project_tracking_token(%L, now() - interval '1 hour', 'x') $q$, :'project_a'), 'tracking_expires_invalid', 'past expiry refused');
select t.fails(format($q$ select public.admin_create_web_atelier_project_tracking_token(%L, now() + interval '120 days', 'x') $q$, :'project_a'), 'tracking_expires_too_far', 'expiry beyond 90 days refused');

select t.as_postgres();
select project_number as project_a_number from public.web_atelier_projects where id = :'project_a'::uuid \gset
select project_number as project_b_number from public.web_atelier_projects where id = :'project_b'::uuid \gset

select t.as_anon();
select public.get_web_atelier_project_public_status(:'token_a') as pub_a \gset
select t.ok((:'pub_a'::jsonb ->> 'project_number') = :'project_a_number', 'public status returns bound project_number');
select t.ok((:'pub_a'::jsonb ->> 'status') = 'preparing', 'public status status code');
select t.ok((:'pub_a'::jsonb ->> 'status_label_hr') = 'Priprema', 'Croatian status label');
select t.ok((:'pub_a'::jsonb ? 'client_email') = false, 'public status omits client_email');
select t.ok((:'pub_a'::jsonb ? 'client_name') = false, 'public status omits client_name');
select t.ok((:'pub_a'::jsonb ? 'agreed_total_cents') = false, 'public status omits financials');
select t.ok((:'pub_a'::jsonb ? 'notes') = false, 'public status omits admin notes');
select t.ok((:'pub_a'::jsonb ? 'approval_id') = false, 'public status omits acceptance evidence ids');

select t.as_postgres();
select t.ok((select use_count from public.web_atelier_project_tracking_tokens where id = :'token_a_id'::uuid) = 1, 'use_count increments on public read');

-- Invalid / reused wrong token / cross-project
select t.as_anon();
select t.fails($q$ select public.get_web_atelier_project_public_status('wat_' || repeat('0',64)) $q$, 'tracking_token_invalid', 'unknown token refused');
select t.fails($q$ select public.get_web_atelier_project_public_status('not-a-token') $q$, 'tracking_token_invalid', 'malformed token refused');
select t.ok((:'pub_a'::jsonb ->> 'project_number') <> :'project_b_number', 'token A is not project B');

select t.as_admin();
select public.admin_create_web_atelier_project_tracking_token(
  :'project_b', now() + interval '14 days', 'project b'
) as tok_b \gset
select :'tok_b'::jsonb ->> 'token' as token_b \gset

select t.as_anon();
select public.get_web_atelier_project_public_status(:'token_b') as pub_b \gset
select t.ok((:'pub_b'::jsonb ->> 'project_number') = :'project_b_number', 'token B resolves only project B');
select t.ok((:'pub_b'::jsonb ->> 'project_number') is distinct from (:'pub_a'::jsonb ->> 'project_number'), 'cross-project tokens do not alias');

-- Expired
select t.as_postgres();
-- Direct expiry bump is blocked by immutability guard — use a dedicated short-lived token instead.
select t.fails(format($q$ update public.web_atelier_project_tracking_tokens set expires_at = now() - interval '1 minute' where id = %L $q$, :'token_a_id'), 'tracking_token_immutable', 'expires_at immutable after create');

select t.as_admin();
-- Insert expired row via definer path is impossible (expires must be future). Simulate by
-- temporarily disabling trigger as owner for this negative test only.
select t.as_postgres();
alter table public.web_atelier_project_tracking_tokens disable trigger web_atelier_tracking_tokens_guard;
insert into public.web_atelier_project_tracking_tokens (
  project_id, purpose, token_hash, token_prefix, label, expires_at, created_at
) values (
  :'project_a'::uuid,
  'project_status_read',
  encode(extensions.digest('wat_' || repeat('e',64), 'sha256'), 'hex'),
  'wat_eeeeeeee',
  'expired fixture',
  now() - interval '1 minute',
  now() - interval '2 days'
) returning id as token_exp_id \gset
alter table public.web_atelier_project_tracking_tokens enable trigger web_atelier_tracking_tokens_guard;

select t.as_anon();
select t.fails(format($q$ select public.get_web_atelier_project_public_status(%L) $q$, 'wat_' || repeat('e',64)), 'tracking_token_expired', 'expired token refused');

-- Revoked
select t.as_admin();
select public.admin_revoke_web_atelier_project_tracking_token(:'token_a_id'::uuid) as rev1 \gset
select t.ok((:'rev1'::jsonb ->> 'already_revoked')::boolean = false, 'first revoke succeeds');
select public.admin_revoke_web_atelier_project_tracking_token(:'token_a_id'::uuid) as rev2 \gset
select t.ok((:'rev2'::jsonb ->> 'already_revoked')::boolean = true, 'second revoke is idempotent');

select t.as_anon();
select t.fails(format($q$ select public.get_web_atelier_project_public_status(%L) $q$, :'token_a'), 'tracking_token_revoked', 'revoked token refused');

-- Reused after revoke stays revoked
select t.fails(format($q$ select public.get_web_atelier_project_public_status(%L) $q$, :'token_a'), 'tracking_token_revoked', 'reused revoked token still refused');

select t.as_admin();
select public.admin_list_web_atelier_project_tracking_tokens(:'project_a'::uuid) as list_a \gset
select t.ok((:'list_a'::jsonb @> '[]'::jsonb) or jsonb_typeof(:'list_a'::jsonb) = 'array', 'list returns array');
select t.ok((select bool_and(not (elem ? 'token_hash') and not (elem ? 'token')) from jsonb_array_elements(:'list_a'::jsonb) elem), 'list omits secrets');

-- ===========================================================================
-- Materials admin checklist
-- ===========================================================================
select public.admin_create_web_atelier_material_requirement(
  :'project_a'::uuid, 'logo', 'Logo u SVG/PNG', 'Vektor preferiran', true,
  public.web_atelier_business_date() + 7, 'interno: podsjetiti mailom'
) as mat1 \gset
select public.admin_create_web_atelier_material_requirement(
  :'project_a'::uuid, 'brand_colors', 'Boje brenda', null, false, null, null
) as mat2 \gset

select t.ok((select planned_storage_path from public.web_atelier_material_requirements where id = :'mat1'::uuid)
  = 'web-atelier-materials/' || :'project_a' || '/' || :'mat1' || '/',
  'planned private storage path shape');
select t.ok((select kind from public.web_atelier_material_requirements where id = :'mat1'::uuid) = 'logo', 'material kind logo');
select t.ok((select is_required from public.web_atelier_material_requirements where id = :'mat2'::uuid) = false, 'optional material');

select t.fails(format($q$ select public.admin_create_web_atelier_material_requirement(%L,'gift','x') $q$, :'project_a'), 'material_kind_invalid', 'unknown material kind refused');
select t.fails(format($q$ select public.admin_create_web_atelier_material_requirement(%L,'logo','') $q$, :'project_a'), 'material_title_invalid', 'empty title refused');
select t.fails(format($q$ select public.admin_create_web_atelier_material_requirement(%L,'logo','Logo',null,true, public.web_atelier_business_date() - 1) $q$, :'project_a'), 'material_deadline_past', 'past deadline refused');

select public.admin_update_web_atelier_material_requirement(:'mat1'::uuid, '{"status":"received"}'::jsonb);
select t.ok((select status from public.web_atelier_material_requirements where id = :'mat1'::uuid) = 'received', 'material marked received');
select t.fails(format($q$ select public.admin_update_web_atelier_material_requirement(%L, '{"status":"shipped"}'::jsonb) $q$, :'mat1'), 'material_status_invalid', 'unknown material status refused');
select t.fails(format($q$ select public.admin_update_web_atelier_material_requirement(%L, '{"agreed_total_cents":1}'::jsonb) $q$, :'mat1'), 'material_patch_unknown_key', 'material patch whitelist');

select public.admin_list_web_atelier_material_requirements(:'project_a'::uuid) as mats \gset
select t.ok(jsonb_array_length(:'mats'::jsonb) = 2, 'list materials for project');
select t.ok((select bool_or(elem ? 'admin_notes') from jsonb_array_elements(:'mats'::jsonb) elem), 'admin list may include admin_notes');

-- File meta writes disabled (no fabricated customer files)
select t.as_postgres();
select t.fails(format($q$
  insert into public.web_atelier_material_file_meta (
    requirement_id, storage_object_path, original_filename, content_type, byte_size, uploaded_by_role
  ) values (%L, 'web-atelier-materials/x/y/z.png', 'logo.png', 'image/png', 12, 'admin')
$q$, :'mat1'), 'material_file_meta_writes_disabled', 'file meta inserts disabled in V1');

select t.as_anon();
select t.fails(format($q$ select public.admin_list_web_atelier_material_requirements(%L) $q$, :'project_a'), 'permission denied', 'anon cannot list materials via admin RPC');

-- Public tracking still omits materials / notes
select t.as_admin();
select public.admin_create_web_atelier_project_tracking_token(
  :'project_a', now() + interval '7 days', 'after materials'
) as tok_c \gset
select :'tok_c'::jsonb ->> 'token' as token_c \gset
select t.as_anon();
select public.get_web_atelier_project_public_status(:'token_c') as pub_c \gset
select t.ok((:'pub_c'::jsonb ? 'materials') = false, 'public status omits materials checklist');
select t.ok((:'pub_c'::jsonb ? 'admin_notes') = false, 'public status omits material admin notes');

\echo ALL_TRACKING_MATERIALS_SCENARIOS_DONE
