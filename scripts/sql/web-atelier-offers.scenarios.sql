-- LOCAL TEST SCENARIOS ONLY (throwaway Docker postgres). Every check prints
-- NOTICE 'PASS: ...' or raises 'FAIL: ...' (psql runs with ON_ERROR_STOP).

\set ON_ERROR_STOP on

select t.as_postgres();

-- Test fixture: the same call the B2 gateway makes after CAPTCHA. Runs as owner.
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
    'deliverables', jsonb_build_array('Dizajn', 'Izrada', ' '),
    'exclusions', jsonb_build_array('Copywriting'),
    'assumptions', jsonb_build_array('Klijent isporučuje sadržaj'),
    'revision_rounds', 2
  )
$$;

create function t.items_json() returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('item_type','service','description','Web stranica PRO','quantity',1,'unit_price_cents',50000),
    jsonb_build_object('item_type','addon','description','Dodatne podstranice','details','Po komadu','quantity',2.5,'unit_price_cents',12345),
    jsonb_build_object('item_type','discount','description','Popust','quantity',1,'unit_price_cents',5000)
  )
$$;

-- Evidence must cite exact offer_number + #vN (admin-recorded acceptance).
create function t.ev(p_offer_id uuid, p_version integer, p_narrative text)
returns text
language sql
stable
as $$
  select coalesce(
    (select offer_number from public.web_atelier_offers where id = p_offer_id),
    'WO-0000-000000'
  ) || ' #v' || p_version::text || ' — ' || p_narrative
$$;

create function t.retention() returns text language sql immutable as $$
  select 'Mailbox arhiva Inbox/WebAtelier/2026'
$$;

-- ===========================================================================
-- 0. Privileges and RLS: nobody but an administrator can read or write
-- ===========================================================================
select t.as_postgres();
select t.mk_inquiry('Ana Test') as inq1 \gset
select t.mk_inquiry('Ivo Test') as inq2 \gset
select t.mk_inquiry('Eva Test') as inq3 \gset
select t.mk_inquiry('Marko Test') as inq4 \gset
select t.mk_inquiry('Spam Test') as inq5 \gset

-- A fresh inquiry never produces an offer or a project.
select t.ok((select count(*) from public.web_atelier_offers) = 0, 'inquiry creates no offer');
select t.ok((select count(*) from public.web_atelier_projects) = 0, 'inquiry creates no project');
select t.ok((select count(*) from public.web_atelier_approvals) = 0, 'inquiry creates no approval');

-- Add a non-admin authenticated user (after the single-user foundation bootstrap).
insert into auth.users (id) values ('22222222-2222-4222-8222-222222222222');

select t.as_anon();
select t.fails($q$ select * from public.web_atelier_offers $q$, 'permission denied', 'anon cannot read offers');
select t.fails($q$ select * from public.web_atelier_projects $q$, 'permission denied', 'anon cannot read projects');
select t.fails($q$ select * from public.web_atelier_approvals $q$, 'permission denied', 'anon cannot read approvals');
select t.fails($q$ insert into public.web_atelier_projects (project_number) values ('WP-2026-000001') $q$, 'permission denied', 'anon cannot insert projects');
select t.fails(format($q$ select public.admin_create_web_atelier_offer_draft(%L) $q$, :'inq1'), 'permission denied', 'anon cannot call draft RPC');
select t.fails($q$ select public.admin_expire_web_atelier_offers() $q$, 'permission denied', 'anon cannot call expire RPC');

select t.as_service();
select t.fails($q$ select * from public.web_atelier_offers $q$, 'permission denied', 'service_role cannot read offers');
select t.fails(format($q$ select public.admin_create_web_atelier_offer_draft(%L) $q$, :'inq1'), 'permission denied', 'service_role cannot call draft RPC');

select t.as_user();
select t.ok((select count(*) from public.web_atelier_offers) = 0, 'non-admin sees no offers (RLS)');
select t.fails(format($q$ select public.admin_create_web_atelier_offer_draft(%L) $q$, :'inq1'), 'forbidden', 'non-admin forbidden: create draft');
select t.fails(format($q$ select public.admin_create_web_atelier_scope_version(%L, %L::jsonb) $q$, :'inq1', t.scope_json()), 'forbidden', 'non-admin forbidden: scope version');
select t.fails($q$ select public.admin_expire_web_atelier_offers() $q$, 'forbidden', 'non-admin forbidden: expire');
select t.fails($q$ insert into public.web_atelier_offers (offer_number, title, client_name, client_email) values ('WO-2026-000001','x','x','x@x.hr') $q$, 'permission denied', 'non-admin cannot insert offers directly');

-- Admin: SELECT yes, direct DML no, on every new table.
select t.as_admin();
select t.ok((select count(*) from public.web_atelier_offers) = 0, 'admin can select offers');
select t.fails($q$ insert into public.web_atelier_offers (offer_number, title, client_name, client_email) values ('WO-2026-000001','x','x','x@x.hr') $q$, 'permission denied', 'admin cannot insert offers directly');
select t.fails($q$ update public.web_atelier_offers set title = 'x' $q$, 'permission denied', 'admin cannot update offers directly');
select t.fails($q$ delete from public.web_atelier_offers $q$, 'permission denied', 'admin cannot delete offers directly');
select t.fails($q$ insert into public.web_atelier_offer_items (offer_id, position, item_type, description, quantity, unit_price_cents) values (gen_random_uuid(),1,'service','x',1,1) $q$, 'permission denied', 'admin cannot insert items directly');
select t.fails($q$ insert into public.web_atelier_approvals (offer_id) values (gen_random_uuid()) $q$, 'permission denied', 'admin cannot insert approvals directly');
select t.fails($q$ insert into public.web_atelier_projects (project_number) values ('WP-2026-000001') $q$, 'permission denied', 'admin cannot insert projects directly');
select t.fails($q$ insert into public.web_atelier_project_events (project_id, event_type) values (gen_random_uuid(),'project_created') $q$, 'permission denied', 'admin cannot insert events directly');
select t.fails($q$ insert into public.web_atelier_scope_versions (inquiry_id, version_number, scope, scope_sha256) values (gen_random_uuid(),1,'{}',repeat('0',64)) $q$, 'permission denied', 'admin cannot insert scope versions directly');

-- ===========================================================================
-- 1. Eligibility: an offer needs a reviewed, clean, non-archived inquiry
-- ===========================================================================
select t.as_admin();
select t.fails(format($q$ select public.admin_create_web_atelier_offer_draft(%L) $q$, :'inq1'), 'inquiry_not_reviewed', 'draft refused for unreviewed (submitted) inquiry');
update public.web_atelier_inquiries set status = 'under_review' where id = :'inq1';
update public.web_atelier_inquiries set status = 'under_review' where id = :'inq2';
update public.web_atelier_inquiries set status = 'under_review' where id = :'inq3';
update public.web_atelier_inquiries set status = 'under_review' where id = :'inq4';
update public.web_atelier_inquiries set status = 'spam' where id = :'inq5';

select t.fails(format($q$ select public.admin_create_web_atelier_offer_draft(%L) $q$, :'inq5'), 'inquiry_not_reviewed', 'draft refused for spam inquiry');
update public.web_atelier_inquiries set risk_state = 'blocked' where id = :'inq4';
select t.fails(format($q$ select public.admin_create_web_atelier_offer_draft(%L) $q$, :'inq4'), 'inquiry_risk_blocked', 'draft refused for blocked inquiry');
update public.web_atelier_inquiries set risk_state = 'clear', archived_at = now() where id = :'inq4';
select t.fails(format($q$ select public.admin_create_web_atelier_offer_draft(%L) $q$, :'inq4'), 'inquiry_archived', 'draft refused for archived inquiry');
update public.web_atelier_inquiries set archived_at = null where id = :'inq4';
select t.fails($q$ select public.admin_create_web_atelier_offer_draft(gen_random_uuid()) $q$, 'inquiry_not_found', 'draft refused for unknown inquiry');
select t.ok((select count(*) from public.web_atelier_projects) = 0, 'still no project after eligibility checks');

-- ===========================================================================
-- 2. Draft, scope, line items, server-calculated totals
-- ===========================================================================
select public.admin_create_web_atelier_offer_draft(:'inq1') as offer1 \gset
select t.ok((select status from public.web_atelier_offers where id = :'offer1') = 'draft', 'draft created in DRAFT state');
select t.ok((select version from public.web_atelier_offers where id = :'offer1') = 1, 'first offer is version 1');
select t.ok((select offer_number from public.web_atelier_offers where id = :'offer1') ~ '^WO-[0-9]{4}-[0-9]{6}$', 'offer number format');
select t.ok((select client_email from public.web_atelier_offers where id = :'offer1') = 'ana@example.com', 'client copied from inquiry');
select t.ok((select package_tier from public.web_atelier_offers where id = :'offer1') = 'pro', 'package tier copied as informative label');
select t.ok((select department from public.web_atelier_offers where id = :'offer1') = 'web_atelier', 'department defaults to web_atelier');
select t.ok((select count(*) from public.web_atelier_projects) = 0, 'draft creates no project');
select t.fails(format($q$ select public.admin_create_web_atelier_offer_draft(%L) $q$, :'inq1'), 'draft_already_exists', 'only one draft per inquiry');

-- Items: line totals and totals are computed by the server.
select public.admin_set_web_atelier_offer_items(:'offer1', t.items_json()) as totals \gset
select t.ok((select line_total_cents from public.web_atelier_offer_items where offer_id = :'offer1' and position = 1) = 50000, 'line total 1x500.00');
select t.ok((select line_total_cents from public.web_atelier_offer_items where offer_id = :'offer1' and position = 2) = 30863, 'line total 2.5 x 123.45 rounds half up to 308.63');
select t.ok((select subtotal_cents from public.web_atelier_offers where id = :'offer1') = 80863, 'subtotal 808.63');
select t.ok((select discount_cents from public.web_atelier_offers where id = :'offer1') = 5000, 'discount 50.00');
select t.ok((select total_cents from public.web_atelier_offers where id = :'offer1') = 75863, 'total 758.63');
select t.ok(:'totals'::jsonb ->> 'total_cents' = '75863', 'RPC returns server totals');

select t.fails(format($q$ select public.admin_set_web_atelier_offer_items(%L, %L::jsonb) $q$, :'offer1',
  '[{"item_type":"service","description":"x","quantity":1,"unit_price_cents":100,"line_total_cents":1}]'),
  'items_unknown_key', 'client cannot supply line_total_cents');
select t.fails(format($q$ select public.admin_set_web_atelier_offer_items(%L, %L::jsonb) $q$, :'offer1',
  '[{"item_type":"service","description":"x","quantity":1,"unit_price_cents":-5}]'),
  'items_price_invalid', 'negative price refused');
select t.fails(format($q$ select public.admin_set_web_atelier_offer_items(%L, %L::jsonb) $q$, :'offer1',
  '[{"item_type":"service","description":"x","quantity":0,"unit_price_cents":5}]'),
  'items_quantity_invalid', 'zero quantity refused');
select t.fails(format($q$ select public.admin_set_web_atelier_offer_items(%L, %L::jsonb) $q$, :'offer1',
  '[{"item_type":"service","description":"x","quantity":1.234,"unit_price_cents":5}]'),
  'items_quantity_invalid', 'quantity with 3 decimals refused');
select t.fails(format($q$ select public.admin_set_web_atelier_offer_items(%L, %L::jsonb) $q$, :'offer1',
  '[{"item_type":"service","description":"x","quantity":1,"unit_price_cents":10.5}]'),
  'items_price_invalid', 'fractional cents refused');
select t.fails(format($q$ select public.admin_set_web_atelier_offer_items(%L, %L::jsonb) $q$, :'offer1',
  '[{"item_type":"gift","description":"x","quantity":1,"unit_price_cents":5}]'),
  'items_type_invalid', 'unknown item type refused');
select t.fails(format($q$ select public.admin_set_web_atelier_offer_items(%L, %L::jsonb) $q$, :'offer1',
  '[{"item_type":"service","description":"x","quantity":1,"unit_price_cents":100},{"item_type":"discount","description":"d","quantity":1,"unit_price_cents":500}]'),
  'web_atelier_offers_amounts_check', 'discount larger than subtotal refused');
select t.ok((select total_cents from public.web_atelier_offers where id = :'offer1') = 75863, 'failed item replacement rolled back, totals intact');

-- Totals cannot be forged even by a privileged writer.
select t.as_postgres();
select t.fails(format($q$ update public.web_atelier_offers set subtotal_cents = 1, total_cents = 1 where id = %L $q$, :'offer1'), 'offer_totals_must_match_items', 'totals cannot diverge from items');
select t.as_admin();

-- Patch: whitelist only.
select t.fails(format($q$ select public.admin_update_web_atelier_offer_draft(%L, '{"status":"accepted"}'::jsonb) $q$, :'offer1'), 'patch_unknown_key', 'patch cannot set status');
select t.fails(format($q$ select public.admin_update_web_atelier_offer_draft(%L, '{"total_cents":1}'::jsonb) $q$, :'offer1'), 'patch_unknown_key', 'patch cannot set total');
select t.fails(format($q$ select public.admin_update_web_atelier_offer_draft(%L, '{"snapshot":{}}'::jsonb) $q$, :'offer1'), 'patch_unknown_key', 'patch cannot set snapshot');
select public.admin_update_web_atelier_offer_draft(:'offer1',
  jsonb_build_object('title','Ponuda: web stranica','terms_note','Rok isporuke 6 tjedana.','valid_until', (public.web_atelier_business_date() + 14)::text));
select t.ok((select title from public.web_atelier_offers where id = :'offer1') = 'Ponuda: web stranica', 'draft header editable');

-- Send preconditions
select t.fails(format($q$ select public.admin_mark_web_atelier_offer_sent(%L) $q$, :'offer1'), 'offer_scope_required', 'cannot send without scope');
select public.admin_create_web_atelier_scope_version(:'inq1', t.scope_json()) as scope1 \gset
select t.ok((select version_number from public.web_atelier_scope_versions where id = :'scope1') = 1, 'scope version 1');
select t.ok((select jsonb_array_length(scope -> 'deliverables') from public.web_atelier_scope_versions where id = :'scope1') = 2, 'blank deliverable dropped, scope normalized');
select t.ok((select scope_sha256 = encode(extensions.digest(scope::text, 'sha256'), 'hex') from public.web_atelier_scope_versions where id = :'scope1'), 'scope hash matches content');
select t.fails(format($q$ select public.admin_create_web_atelier_scope_version(%L, '{"summary":"x","deliverables":[]}'::jsonb) $q$, :'inq1'), 'scope_deliverables_required', 'scope needs a deliverable');
select t.fails(format($q$ select public.admin_create_web_atelier_scope_version(%L, '{"summary":"x","deliverables":["a"],"price":1}'::jsonb) $q$, :'inq1'), 'scope_unknown_key', 'scope rejects unknown keys');
select t.fails(format($q$ select public.admin_update_web_atelier_offer_draft(%L, jsonb_build_object('scope_version_id', %L)) $q$, :'offer1', gen_random_uuid()), 'scope_version_mismatch', 'scope of another inquiry refused');
select public.admin_update_web_atelier_offer_draft(:'offer1', jsonb_build_object('scope_version_id', :'scope1'));

select public.admin_update_web_atelier_offer_draft(:'offer1', jsonb_build_object('valid_until', (public.web_atelier_business_date() - 1)::text));
select t.fails(format($q$ select public.admin_mark_web_atelier_offer_sent(%L) $q$, :'offer1'), 'offer_valid_until_invalid', 'cannot send with past valid_until');
select public.admin_update_web_atelier_offer_draft(:'offer1', jsonb_build_object('valid_until', (public.web_atelier_business_date() + 14)::text));

-- Empty offer cannot be sent (separate draft on inquiry 3).
select public.admin_create_web_atelier_offer_draft(:'inq3') as offer3 \gset
select public.admin_create_web_atelier_scope_version(:'inq3', t.scope_json()) as scope3 \gset
select public.admin_update_web_atelier_offer_draft(:'offer3', jsonb_build_object('scope_version_id', :'scope3', 'valid_until', (public.web_atelier_business_date() + 14)::text));
select t.fails(format($q$ select public.admin_mark_web_atelier_offer_sent(%L) $q$, :'offer3'), 'offer_items_required', 'cannot send without items');
select public.admin_discard_web_atelier_offer_draft(:'offer3');
select t.ok((select count(*) from public.web_atelier_offers where id = :'offer3') = 0, 'draft can be discarded');
select t.ok((select count(*) from public.web_atelier_offer_items where offer_id = :'offer3') = 0, 'discarded draft leaves no items');

-- ===========================================================================
-- 3. SENT: immutable snapshot, no project yet (issuance ≠ delivery)
-- ===========================================================================
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',1,%L,'Ana',now(),'email',t.ev(%L::uuid,1,'email 2026-10-14 odobrenje'),t.retention(),null,true) $q$, :'offer1', repeat('a',64), :'offer1'), 'offer_not_open_for_decision', 'draft cannot be accepted');
select public.admin_mark_web_atelier_offer_sent(:'offer1') as sent1 \gset
select :'sent1'::jsonb ->> 'snapshot_sha256' as hash1 \gset
select t.ok((select status from public.web_atelier_offers where id = :'offer1') = 'sent', 'offer is SENT');
select t.ok((select delivered_at is null from public.web_atelier_offers where id = :'offer1'), 'issued snapshot has no delivery yet');
select t.ok((select snapshot_sha256 = encode(extensions.digest(snapshot::text, 'sha256'), 'hex') from public.web_atelier_offers where id = :'offer1'), 'snapshot hash matches stored snapshot');
select t.ok((select snapshot #>> '{totals,total_cents}' from public.web_atelier_offers where id = :'offer1') = '75863', 'snapshot carries server totals');
select t.ok((select (snapshot #>> '{notices,not_an_invoice}')::boolean from public.web_atelier_offers where id = :'offer1'), 'snapshot states: not an invoice');
select t.ok((select snapshot #>> '{inquiry,reference_code}' from public.web_atelier_offers where id = :'offer1') ~ '^WA-', 'snapshot references the inquiry');
select t.ok((select snapshot #>> '{scope,sha256}' from public.web_atelier_offers where id = :'offer1') = (select scope_sha256 from public.web_atelier_scope_versions where id = :'scope1'), 'snapshot embeds scope hash');
select t.ok((select count(*) from public.web_atelier_projects) = 0, 'SENT offer creates no project');

select t.fails(format($q$ select public.admin_set_web_atelier_offer_items(%L, '[]'::jsonb) $q$, :'offer1'), 'offer_not_draft', 'items RPC refused for SENT offer');
select t.fails(format($q$ select public.admin_update_web_atelier_offer_draft(%L, '{"title":"x"}'::jsonb) $q$, :'offer1'), 'offer_not_draft', 'patch RPC refused for SENT offer');
select t.fails(format($q$ select public.admin_discard_web_atelier_offer_draft(%L) $q$, :'offer1'), 'offer_not_draft', 'SENT offer cannot be discarded');
select t.fails(format($q$ select public.admin_mark_web_atelier_offer_sent(%L) $q$, :'offer1'), 'offer_not_draft', 'SENT offer cannot be sent twice');

select t.as_postgres();
select t.fails(format($q$ update public.web_atelier_offers set title = 'Izmijenjeno' where id = %L $q$, :'offer1'), 'offer_immutable_after_sent', 'owner cannot edit SENT title');
select t.fails(format($q$ update public.web_atelier_offers set total_cents = 1, subtotal_cents = 1, discount_cents = 0 where id = %L $q$, :'offer1'), 'offer_immutable_after_sent', 'owner cannot edit SENT totals');
select t.fails(format($q$ update public.web_atelier_offers set snapshot = '{}'::jsonb where id = %L $q$, :'offer1'), 'offer_immutable_after_sent', 'owner cannot edit SENT snapshot');
select t.fails(format($q$ update public.web_atelier_offers set valid_until = public.web_atelier_business_date() + 90 where id = %L $q$, :'offer1'), 'offer_immutable_after_sent', 'owner cannot extend SENT validity');
select t.fails(format($q$ delete from public.web_atelier_offers where id = %L $q$, :'offer1'), 'offer_immutable_after_sent', 'SENT offer cannot be deleted');
select t.fails(format($q$ update public.web_atelier_offer_items set quantity = 9 where offer_id = %L $q$, :'offer1'), 'offer_items_locked', 'SENT items cannot be updated');
select t.fails(format($q$ delete from public.web_atelier_offer_items where offer_id = %L $q$, :'offer1'), 'offer_items_locked', 'SENT items cannot be deleted');
select t.fails(format($q$ insert into public.web_atelier_offer_items (offer_id, position, item_type, description, quantity, unit_price_cents) values (%L, 9, 'service', 'x', 1, 1) $q$, :'offer1'), 'offer_items_locked', 'SENT offer cannot gain items');
select t.fails(format($q$ update public.web_atelier_scope_versions set scope = '{}'::jsonb where id = %L $q$, :'scope1'), 'scope_versions_append_only', 'scope versions are append-only (update)');
select t.fails(format($q$ delete from public.web_atelier_scope_versions where id = %L $q$, :'scope1'), 'scope_versions_append_only', 'scope versions are append-only (delete)');

-- Invalid status transitions (privileged writer, trigger-enforced)
select t.fails(format($q$ update public.web_atelier_offers set status = 'accepted', accepted_at = now() where id = %L $q$, :'offer1'), 'offer_delivery_required_before_decision', 'SENT -> ACCEPTED blocked until delivery (no approval row)');
select t.fails(format($q$ update public.web_atelier_offers set status = 'rejected', rejected_at = now() where id = %L $q$, :'offer1'), 'offer_delivery_required_before_decision', 'SENT -> REJECTED blocked until delivery (no decision row)');
select t.fails(format($q$ update public.web_atelier_offers set status = 'draft' where id = %L $q$, :'offer1'), 'web_atelier_offers_draft_shape_check|offer_invalid_transition', 'SENT -> DRAFT refused');
select t.fails(format($q$ update public.web_atelier_offers set status = 'expired', expired_at = now() where id = %L $q$, :'offer1'), 'offer_not_yet_expired', 'SENT -> EXPIRED only after valid_until');
select t.fails(format($q$ update public.web_atelier_offers set status = 'superseded', superseded_at = now() where id = %L $q$, :'offer1'), 'terminal_timestamps_check|offer_successor_required', 'SENT -> SUPERSEDED requires a successor');
select t.fails($q$ insert into public.web_atelier_offers (offer_number, status, title, client_name, client_email, inquiry_id) select 'WO-2026-999999', 'sent', 'x', 'x', 'x@x.hr', id from public.web_atelier_inquiries limit 1 $q$, 'offer_must_start_as_draft', 'offers cannot be inserted as SENT');
select t.ok((select count(*) from public.web_atelier_projects) = 0, 'failed transitions created no project');

-- Department / inquiry reference constraints
select t.fails($q$ insert into public.web_atelier_offers (offer_number, title, client_name, client_email, department) values ('WO-2026-999998','x','x','x@x.hr','web_atelier') $q$, 'web_atelier_offers_inquiry_check', 'web_atelier offer requires an inquiry');
select t.fails($q$ insert into public.web_atelier_offers (offer_number, title, client_name, client_email, department) values ('WO-2026-999997','x','x','x@x.hr','bogus') $q$, 'web_atelier_offers_department_check', 'unknown department refused');

select t.as_admin();

-- ===========================================================================
-- 4. Project cannot exist before a valid acceptance
-- ===========================================================================
select t.fails(format($q$ select public.admin_create_web_atelier_project_from_offer(%L) $q$, :'offer1'), 'offer_not_accepted', 'no project for a SENT offer (RPC)');
select t.as_postgres();
select t.fails(format($q$ insert into public.web_atelier_projects (project_number, department, inquiry_id, offer_id, approval_id, scope_version_id, title, client_name, client_email, agreed_total_cents)
  select 'WP-2026-999999', 'web_atelier', %L, %L, gen_random_uuid(), %L, 't', 'c', 'c@c.hr', 75863 $q$, :'inq1', :'offer1', :'scope1'),
  'project_requires_accepted_offer|violates foreign key', 'no project for a SENT offer (direct insert)');
select t.as_admin();

-- ===========================================================================
-- 5. Delivery then explicit acceptance evidence
-- ===========================================================================
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',1,%L,'Ana Test',now(),'email',t.ev(%L::uuid,1,'email 2026-10-14 odobrenje'),t.retention(),null,true) $q$, :'offer1', :'hash1', :'offer1'), 'offer_delivery_required_before_decision', 'acceptance before delivery refused');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_delivery(%L, now(), 'email_manual', 'kratko') $q$, :'offer1'), 'delivery_reference_required', 'delivery reference must be substantive');
select public.admin_record_web_atelier_offer_delivery(:'offer1', now(), 'email_manual', 'Ručno poslano e-mailom klijentu 2026-10-14');
select t.ok((select delivered_at is not null from public.web_atelier_offers where id = :'offer1'), 'delivery recorded after issuance');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_delivery(%L, now(), 'email_manual', 'druga dostava pokusaj') $q$, :'offer1'), 'offer_already_delivered', 'delivery cannot be rewritten');

select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',1,%L,'Ana Test',now(),'email',t.ev(%L::uuid,1,'email 2026-10-14 odobrenje'),t.retention(),null,false) $q$, :'offer1', :'hash1', :'offer1'), 'admin_confirmation_required', 'acceptance needs admin confirmation');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',1,%L,'Ana Test',now(),'email',t.ev(%L::uuid,1,'email 2026-10-14 odobrenje'),t.retention(),null,null) $q$, :'offer1', :'hash1', :'offer1'), 'admin_confirmation_required', 'NULL confirmation is not confirmation');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',1,%L,'Ana Test',now(),'email',t.ev(%L::uuid,1,'email 2026-10-14 odobrenje'),t.retention(),null,true) $q$, :'offer1', repeat('b',64), :'offer1'), 'snapshot_mismatch', 'acceptance bound to exact snapshot hash');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'maybe',1,%L,'Ana Test',now(),'email',t.ev(%L::uuid,1,'email 2026-10-14 odobrenje'),t.retention(),null,true) $q$, :'offer1', :'hash1', :'offer1'), 'decision_invalid', 'unknown decision refused');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',1,%L,'Ana Test',now(),'carrier_pigeon',t.ev(%L::uuid,1,'email 2026-10-14 odobrenje'),t.retention(),null,true) $q$, :'offer1', :'hash1', :'offer1'), 'web_atelier_approvals_channel_check', 'unknown evidence channel refused');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',1,%L,'Ana Test',now(),'email', t.ev(%L::uuid,1, %L), t.retention(),null,true) $q$, :'offer1', :'hash1', :'offer1', repeat('n', 1995)), 'web_atelier_approvals_reference_check', 'evidence reference length bounds enforced');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',1,%L,'Ana Test',now(),'email','samo narrative bez broja #v1',t.retention(),null,true) $q$, :'offer1', :'hash1'), 'evidence_must_cite_offer_number', 'evidence without offer number refused');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',1,%L,'Ana Test',now(),'email',(select offer_number from public.web_atelier_offers where id = %L) || ' bez verzije tokena',t.retention(),null,true) $q$, :'offer1', :'hash1', :'offer1'), 'evidence_must_cite_offer_version', 'evidence without #vN refused');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',1,%L,'   ',now(),'email',t.ev(%L::uuid,1,'email 2026-10-14 odobrenje'),t.retention(),null,true) $q$, :'offer1', :'hash1', :'offer1'), 'web_atelier_approvals_name_check', 'accepting person name required');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',1,%L,'Ana Test',now() - interval '2 days','email',t.ev(%L::uuid,1,'email 2026-10-14 odobrenje'),t.retention(),null,true) $q$, :'offer1', :'hash1', :'offer1'), 'decision_before_offer_issued|decision_before_offer_delivered', 'acceptance cannot predate the offer');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',1,%L,'Ana Test',now() + interval '1 day','email',t.ev(%L::uuid,1,'email 2026-10-14 odobrenje'),t.retention(),null,true) $q$, :'offer1', :'hash1', :'offer1'), 'decision_in_future', 'acceptance cannot be dated in the future');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',1,%L,'Ana Test',now(),'email',t.ev(%L::uuid,1,'ok'),'kratko',null,true) $q$, :'offer1', :'hash1', :'offer1'), 'evidence_retention_note_required', 'short retention note refused');
select t.ok((select count(*) from public.web_atelier_approvals) = 0, 'refused decisions left no approval row');
select t.ok((select status from public.web_atelier_offers where id = :'offer1') = 'sent', 'offer still SENT after refused decisions');

select t.as_user();
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',1,%L,'Ana Test',now(),'email',t.ev(%L::uuid,1,'email 2026-10-14 odobrenje'),t.retention(),null,true) $q$, :'offer1', :'hash1', :'offer1'), 'forbidden', 'non-admin cannot record acceptance');
select t.as_admin();

select public.admin_record_web_atelier_offer_decision(
  :'offer1','accepted',1,:'hash1','Ana Test',now(),'email',
  t.ev(:'offer1'::uuid,1,'E-mail Ane Test od 2026-10-14, predmet: Prihvacanje'),
  t.retention(), null, true
) as approval1 \gset
select t.ok((select status from public.web_atelier_offers where id = :'offer1') = 'accepted', 'offer ACCEPTED after explicit approval');
select t.ok((select accepted_at is not null from public.web_atelier_offers where id = :'offer1'), 'accepted_at recorded');
select t.ok((select offer_snapshot_sha256 from public.web_atelier_approvals where id = :'approval1') = :'hash1', 'approval stores the snapshot hash');
select t.ok((select offer_number from public.web_atelier_approvals where id = :'approval1') = (select offer_number from public.web_atelier_offers where id = :'offer1'), 'approval stores exact offer_number');
select t.ok((select offer_version from public.web_atelier_approvals where id = :'approval1') = 1, 'approval stores exact offer version');
select t.ok((select char_length(evidence_retention_note) >= 10 from public.web_atelier_approvals where id = :'approval1'), 'approval stores retention note');
select t.ok((select recorded_by from public.web_atelier_approvals where id = :'approval1') = 'eece9210-2fc5-42d5-aa02-e47a7cfaf160'::uuid, 'approval records the acting admin');
select t.ok((select method from public.web_atelier_approvals where id = :'approval1') = 'admin_recorded', 'approval method is admin_recorded (no client self-service in V1)');

select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',1,%L,'Ana Test',now(),'email',t.ev(%L::uuid,1,'E-mail Ane Test od 2026-10-14, predmet: Prihvacanje ponude'),t.retention(),null,true) $q$, :'offer1', :'hash1', :'offer1'), 'offer_not_open_for_decision', 'duplicate acceptance refused');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'rejected',1,%L,'Ana Test',now(),'email',t.ev(%L::uuid,1,'E-mail Ane Test od 2026-10-14, predmet: Odbijanje'),t.retention(),null,true) $q$, :'offer1', :'hash1', :'offer1'), 'offer_not_open_for_decision', 'accepted offer cannot be rejected afterwards');
select t.as_postgres();
select t.fails(format($q$ update public.web_atelier_approvals set decided_by_name = 'Netko drugi' where id = %L $q$, :'approval1'), 'approvals_append_only', 'approvals cannot be updated');
select t.fails(format($q$ delete from public.web_atelier_approvals where id = %L $q$, :'approval1'), 'approvals_append_only', 'approvals cannot be deleted');
select t.fails(format($q$ insert into public.web_atelier_approvals (offer_id, decision, offer_number, offer_version, offer_snapshot_sha256, decided_by_name, decided_at, evidence_channel, evidence_reference, evidence_retention_note, admin_confirmed_evidence, recorded_by)
  values (%L, 'accepted', (select offer_number from public.web_atelier_offers where id = %L), 1, %L, 'Ana', now(), 'email', t.ev(%L::uuid,1,'ponovljena potvrda mail'), t.retention(), true, gen_random_uuid()) $q$, :'offer1', :'offer1', :'hash1', :'offer1'), 'offer_not_open_for_decision|web_atelier_approvals_offer_key', 'second approval row for the same offer refused');
select t.fails(format($q$ update public.web_atelier_offers set status = 'sent', accepted_at = null where id = %L $q$, :'offer1'), 'offer_invalid_transition|offer_immutable', 'ACCEPTED offer cannot go back to SENT');
select t.fails(format($q$ update public.web_atelier_offers set title = 'x' where id = %L $q$, :'offer1'), 'offer_immutable_after_sent', 'ACCEPTED offer is still immutable');
select t.as_admin();
select t.fails(format($q$ select public.admin_create_web_atelier_offer_draft(%L, %L) $q$, :'inq1', :'offer1'), 'offer_already_accepted', 'no new offer for an inquiry with an accepted offer');
select t.ok((select count(*) from public.web_atelier_projects) = 0, 'acceptance alone does not create a project');

-- ===========================================================================
-- 6. Project creation from the accepted offer: exactly once
-- ===========================================================================
select public.admin_create_web_atelier_project_from_offer(:'offer1') as proj1 \gset
select :'proj1'::jsonb ->> 'project_id' as project1 \gset
select t.ok((:'proj1'::jsonb ->> 'created')::boolean, 'project created from accepted offer');
select t.ok((select count(*) from public.web_atelier_projects) = 1, 'exactly one project');
select t.ok((select agreed_total_cents from public.web_atelier_projects where id = :'project1') = 75863, 'project carries the agreed total from the offer');
select t.ok((select status from public.web_atelier_projects where id = :'project1') = 'preparing', 'project starts preparing');
select t.ok((select approval_id from public.web_atelier_projects where id = :'project1') = :'approval1'::uuid, 'project references the approval');
select t.ok((select inquiry_id from public.web_atelier_projects where id = :'project1') = :'inq1'::uuid, 'project references the inquiry');
select t.ok((select project_number from public.web_atelier_projects where id = :'project1') ~ '^WP-[0-9]{4}-[0-9]{6}$', 'project number format');
select t.ok((select count(*) from public.web_atelier_project_events where project_id = :'project1' and event_type = 'project_created') = 1, 'project_created event written');

select public.admin_create_web_atelier_project_from_offer(:'offer1') as proj1b \gset
select t.ok(not (:'proj1b'::jsonb ->> 'created')::boolean, 'second call reports created = false');
select t.ok(:'proj1b'::jsonb ->> 'project_id' = :'project1', 'second call returns the same project');
select t.ok((select count(*) from public.web_atelier_projects) = 1, 'still exactly one project (idempotent)');

select t.as_postgres();
select t.fails(format($q$ insert into public.web_atelier_projects (project_number, department, inquiry_id, offer_id, approval_id, scope_version_id, title, client_name, client_email, agreed_total_cents)
  select 'WP-2026-999998', department, inquiry_id, offer_id, approval_id, scope_version_id, title, client_name, client_email, agreed_total_cents from public.web_atelier_projects where id = %L $q$, :'project1'),
  'web_atelier_projects_one_per_offer_key', 'direct duplicate project for the same offer refused');
select t.fails(format($q$ update public.web_atelier_projects set agreed_total_cents = 1 where id = %L $q$, :'project1'), 'project_identity_immutable', 'agreed total is immutable');
select t.fails(format($q$ update public.web_atelier_projects set offer_id = gen_random_uuid() where id = %L $q$, :'project1'), 'project_identity_immutable', 'project cannot be re-pointed to another offer');
select t.fails(format($q$ delete from public.web_atelier_projects where id = %L $q$, :'project1'), 'projects_cannot_be_deleted', 'projects cannot be deleted');
select t.fails(format($q$ update public.web_atelier_project_events set note = 'x' where project_id = %L $q$, :'project1'), 'project_events_append_only', 'project events cannot be updated');
select t.fails(format($q$ delete from public.web_atelier_project_events where project_id = %L $q$, :'project1'), 'project_events_append_only', 'project events cannot be deleted');
select t.as_user();
select t.fails(format($q$ select public.admin_create_web_atelier_project_from_offer(%L) $q$, :'offer1'), 'forbidden', 'non-admin cannot create projects');
select t.fails(format($q$ select public.admin_update_web_atelier_project(%L, '{"status":"in_progress"}'::jsonb) $q$, :'project1'), 'forbidden', 'non-admin cannot update projects');
select t.as_admin();

-- Project status machine (locked lifecycle; no auto payment/scheduling)
select t.fails(format($q$ select public.admin_update_web_atelier_project(%L, '{"status":"completed"}'::jsonb) $q$, :'project1'), 'project_invalid_transition', 'preparing -> completed refused');
select t.fails(format($q$ select public.admin_update_web_atelier_project(%L, '{"status":"bogus"}'::jsonb) $q$, :'project1'), 'project_status_invalid|web_atelier_projects_status_check', 'unknown project status refused');
select t.fails(format($q$ select public.admin_update_web_atelier_project(%L, '{"agreed_total_cents":1}'::jsonb) $q$, :'project1'), 'patch_unknown_key', 'project patch cannot set money');
select public.admin_update_web_atelier_project(:'project1', '{"status":"ready_to_start","notes":"Kickoff dogovoren"}'::jsonb);
select t.ok((select status from public.web_atelier_projects where id = :'project1') = 'ready_to_start', 'preparing -> ready_to_start');
select public.admin_update_web_atelier_project(:'project1', '{"status":"in_progress"}'::jsonb);
select t.ok((select started_at is not null from public.web_atelier_projects where id = :'project1'), 'started_at derived');
select public.admin_update_web_atelier_project(:'project1', '{"status":"client_review"}'::jsonb);
select public.admin_update_web_atelier_project(:'project1', '{"status":"final_approval"}'::jsonb);
select public.admin_update_web_atelier_project(:'project1', '{"status":"completed"}'::jsonb);
select t.ok((select completed_at is not null from public.web_atelier_projects where id = :'project1'), 'completed_at derived');
select t.fails(format($q$ select public.admin_update_web_atelier_project(%L, '{"status":"in_progress"}'::jsonb) $q$, :'project1'), 'project_invalid_transition', 'completed project is terminal');
select t.ok((select count(*) from public.web_atelier_project_events where project_id = :'project1' and event_type = 'status_changed') = 5, 'status changes logged as events');
select t.ok((select count(*) from public.web_atelier_project_events where project_id = :'project1' and event_type = 'details_updated') = 1, 'details change logged');

-- ===========================================================================
-- 7. Versioning / supersede, rejection, expiry
-- ===========================================================================
select public.admin_create_web_atelier_offer_draft(:'inq2') as o2v1 \gset
select public.admin_create_web_atelier_scope_version(:'inq2', t.scope_json()) as scope2 \gset
select public.admin_set_web_atelier_offer_items(:'o2v1', '[{"item_type":"service","description":"START","quantity":1,"unit_price_cents":30000}]'::jsonb);
select public.admin_update_web_atelier_offer_draft(:'o2v1', jsonb_build_object('scope_version_id', :'scope2', 'valid_until', (public.web_atelier_business_date() + 10)::text));
select public.admin_mark_web_atelier_offer_sent(:'o2v1') ->> 'snapshot_sha256' as o2v1hash \gset

select t.fails(format($q$ select public.admin_create_web_atelier_offer_draft(%L) $q$, :'inq2'), 'open_offer_exists', 'new offer without revising the open SENT one refused');
select public.admin_create_web_atelier_offer_draft(:'inq2', :'o2v1') as o2v2 \gset
select t.ok((select version from public.web_atelier_offers where id = :'o2v2') = 2, 'revision is version 2');
select t.ok((select supersedes_offer_id from public.web_atelier_offers where id = :'o2v2') = :'o2v1'::uuid, 'revision points at the offer it supersedes');
select t.ok((select count(*) from public.web_atelier_offer_items where offer_id = :'o2v2') = 1, 'revision copies line items');
select t.ok((select status from public.web_atelier_offers where id = :'o2v1') = 'sent', 'v1 stays SENT until v2 is sent');
select public.admin_set_web_atelier_offer_items(:'o2v2', '[{"item_type":"service","description":"START","quantity":1,"unit_price_cents":35000}]'::jsonb);
select public.admin_update_web_atelier_offer_draft(:'o2v2', jsonb_build_object('valid_until', (public.web_atelier_business_date() + 20)::text));
select t.ok((select snapshot #>> '{totals,total_cents}' from public.web_atelier_offers where id = :'o2v1') = '30000', 'editing the revision leaves v1 snapshot untouched');
select public.admin_mark_web_atelier_offer_sent(:'o2v2') ->> 'snapshot_sha256' as o2v2hash \gset
select t.ok((select status from public.web_atelier_offers where id = :'o2v1') = 'superseded', 'v1 SUPERSEDED when v2 sent');
select t.ok((select superseded_by_offer_id from public.web_atelier_offers where id = :'o2v1') = :'o2v2'::uuid, 'v1 points at its successor');
select t.ok((select count(*) from public.web_atelier_offers where inquiry_id = :'inq2' and status in ('sent','accepted')) = 1, 'exactly one open offer per inquiry');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',1,%L,'Ivo',now(),'email',t.ev(%L::uuid,1,'email potvrda ponude v1 stara'),t.retention(),null,true) $q$, :'o2v1', :'o2v1hash', :'o2v1'), 'offer_not_open_for_decision', 'superseded v1 cannot be accepted');
select public.admin_record_web_atelier_offer_delivery(:'o2v2', now(), 'email_manual', 'Ponuda v2 poslana Ivi e-mailom');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',2,%L,'Ivo',now(),'email',t.ev(%L::uuid,2,'email potvrda ponude v2 hash v1'),t.retention(),null,true) $q$, :'o2v2', :'o2v1hash', :'o2v2'), 'snapshot_mismatch', 'v2 cannot be accepted with the v1 hash');

-- Rejection is recorded, creates no project, and allows a new version.
select public.admin_record_web_atelier_offer_decision(
  :'o2v2','rejected',2,:'o2v2hash','Ivo Test',now(),'email',
  t.ev(:'o2v2'::uuid,2,'E-mail Ive Test 2026-10-14: odbijanje'),
  t.retention(), null, true
) as rej \gset
select t.ok((select status from public.web_atelier_offers where id = :'o2v2') = 'rejected', 'offer REJECTED with record');
select t.ok((select rejected_at is not null from public.web_atelier_offers where id = :'o2v2'), 'rejected_at recorded');
select t.fails(format($q$ select public.admin_create_web_atelier_project_from_offer(%L) $q$, :'o2v2'), 'offer_not_accepted', 'rejected offer yields no project');
select public.admin_create_web_atelier_offer_draft(:'inq2', :'o2v2') as o2v3 \gset
select t.ok((select version from public.web_atelier_offers where id = :'o2v3') = 3, 'new version after rejection is v3');
select t.ok((select supersedes_offer_id is null from public.web_atelier_offers where id = :'o2v3'), 'v3 after a rejected offer supersedes nothing');
select t.ok((select count(*) from public.web_atelier_projects) = 1, 'rejection and revisions created no extra project');

-- Eligibility is re-checked at send time.
select public.admin_set_web_atelier_offer_items(:'o2v3', '[{"item_type":"service","description":"START","quantity":1,"unit_price_cents":30000}]'::jsonb);
select public.admin_update_web_atelier_offer_draft(:'o2v3', jsonb_build_object('scope_version_id', :'scope2', 'valid_until', (public.web_atelier_business_date() + 10)::text));
update public.web_atelier_inquiries set risk_state = 'suspected' where id = :'inq2';
select t.fails(format($q$ select public.admin_mark_web_atelier_offer_sent(%L) $q$, :'o2v3'), 'inquiry_not_eligible', 'send refused when the inquiry became risky');
update public.web_atelier_inquiries set risk_state = 'clear' where id = :'inq2';

-- Expiry: backdate valid_until as the owner with the guard temporarily off (test only).
select public.admin_mark_web_atelier_offer_sent(:'o2v3') ->> 'snapshot_sha256' as o2v3hash \gset
select t.as_postgres();
alter table public.web_atelier_offers disable trigger web_atelier_offers_guard_update;
update public.web_atelier_offers set valid_until = public.web_atelier_business_date() - 1 where id = :'o2v3';
alter table public.web_atelier_offers enable trigger web_atelier_offers_guard_update;
select t.as_admin();
select public.admin_record_web_atelier_offer_delivery(:'o2v3', now(), 'email_manual', 'Ponuda v3 poslana Ivi e-mailom');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',3,%L,'Ivo Test',now(),'email',t.ev(%L::uuid,3,'E-mail Ive Test kasna potvrda ponude'),t.retention(),null,true) $q$, :'o2v3', :'o2v3hash', :'o2v3'), 'offer_expired_at_decision', 'acceptance dated after valid_until refused');
select t.ok(public.admin_expire_web_atelier_offers() = 1, 'expire RPC expires exactly the overdue SENT offer');
select t.ok((select status from public.web_atelier_offers where id = :'o2v3') = 'expired', 'offer EXPIRED');
select t.ok(public.admin_expire_web_atelier_offers() = 0, 'expire RPC is idempotent');
select t.fails(format($q$ select public.admin_record_web_atelier_offer_decision(%L,'accepted',3,%L,'Ivo Test',now(),'email',t.ev(%L::uuid,3,'E-mail Ive Test nakon isteka ponude'),t.retention(),null,true) $q$, :'o2v3', :'o2v3hash', :'o2v3'), 'offer_not_open_for_decision', 'expired offer cannot be accepted');
select t.fails(format($q$ select public.admin_create_web_atelier_project_from_offer(%L) $q$, :'o2v3'), 'offer_not_accepted', 'expired offer yields no project');
select t.ok((select count(*) from public.web_atelier_projects) = 1, 'still exactly one project in the whole database');

-- ===========================================================================
-- 8. Existing B1/B2 behaviour is untouched
-- ===========================================================================
select t.as_admin();
select t.fails(format($q$ update public.web_atelier_inquiries set contact_name = 'Hakirano ime' where id = %L $q$, :'inq1'), 'permission denied', 'admin still cannot update submitted inquiry fields');
select t.as_postgres();
update public.web_atelier_inquiries set contact_name = 'Hakirano ime' where id = :'inq1';
select t.ok((select contact_name from public.web_atelier_inquiries where id = :'inq1') = 'Ana Test', 'B1 guard still freezes submitted fields');
select t.ok((select count(*) from public.web_atelier_inquiries) = 5, 'inquiries unchanged by offer workflow');
select t.ok(not exists (select 1 from pg_trigger where tgrelid = 'public.web_atelier_inquiries'::regclass and tgname not like 'RI_ConstraintTrigger%' and tgname <> 'web_atelier_inquiries_guard_update'), 'no new trigger on web_atelier_inquiries');

-- Grants audit
select t.ok(not exists (
  select 1 from information_schema.role_table_grants
  where table_schema = 'public' and table_name in ('web_atelier_scope_versions','web_atelier_offers','web_atelier_offer_items','web_atelier_approvals','web_atelier_projects','web_atelier_project_events')
    and (grantee in ('anon','service_role','PUBLIC') or (grantee = 'authenticated' and privilege_type <> 'SELECT'))
), 'new tables: authenticated SELECT only, no anon/service_role/PUBLIC grants');
select t.ok(not exists (
  select 1 from information_schema.routine_privileges
  where specific_schema = 'public' and routine_name like 'admin\_%web\_atelier%'
    and grantee in ('anon','service_role','PUBLIC')
), 'admin RPCs not executable by anon/service_role/PUBLIC');
select t.ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('web_atelier_scope_versions','web_atelier_offers','web_atelier_offer_items','web_atelier_approvals','web_atelier_projects','web_atelier_project_events')
    and not c.relrowsecurity
), 'RLS enabled on every new table');
select t.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and (p.proname like 'admin\_%web\_atelier%')
    and (not p.prosecdef or p.proconfig is null or not ('search_path=""' = any (p.proconfig)))
), 'admin RPCs are SECURITY DEFINER with empty search_path');

-- ===========================================================================
-- 9. HARDENING: Zagreb midnight/DST, supersede recovery, delivery grants
-- ===========================================================================
select t.as_admin();
select t.ok(public.web_atelier_business_date(timestamptz '2026-03-29 00:30:00+00') = date '2026-03-29', 'Zagreb date after CET->CEST spring forward midnight UTC');
select t.ok(public.web_atelier_business_date(timestamptz '2026-10-25 00:30:00+00') = date '2026-10-25', 'Zagreb date after CEST->CET fall back');
select t.ok(public.web_atelier_business_date(timestamptz '2026-07-01 21:30:00+00') = date '2026-07-01', 'Zagreb evening still same civil date');
select t.ok(public.web_atelier_business_date(timestamptz '2026-07-01 22:30:00+00') = date '2026-07-02', 'UTC late evening rolls Zagreb date');

-- Supersede recovery: discard revision draft leaves v1 SENT open.
select public.admin_create_web_atelier_offer_draft(:'inq4') as o4 \gset
select public.admin_create_web_atelier_scope_version(:'inq4', t.scope_json()) as scope4 \gset
select public.admin_set_web_atelier_offer_items(:'o4', '[{"item_type":"service","description":"START","quantity":1,"unit_price_cents":30000}]'::jsonb);
select public.admin_update_web_atelier_offer_draft(:'o4', jsonb_build_object('scope_version_id', :'scope4', 'valid_until', (public.web_atelier_business_date() + 14)::text));
select public.admin_mark_web_atelier_offer_sent(:'o4') ->> 'snapshot_sha256' as o4hash \gset
select t.ok((select delivered_at is null from public.web_atelier_offers where id = :'o4'), 'o4 issued without delivery');
select public.admin_create_web_atelier_offer_draft(:'inq4', :'o4') as o4v2 \gset
select t.ok((select status from public.web_atelier_offers where id = :'o4') = 'sent', 'v1 still SENT while revision draft exists');
select public.admin_discard_web_atelier_offer_draft(:'o4v2');
select t.ok((select status from public.web_atelier_offers where id = :'o4') = 'sent', 'discarding revision restores no damage to v1');
select t.ok((select count(*) from public.web_atelier_offers where inquiry_id = :'inq4' and status = 'draft') = 0, 'no leftover draft after discard');

-- Successful supersede replacement
select public.admin_create_web_atelier_offer_draft(:'inq4', :'o4') as o4v2b \gset
select public.admin_set_web_atelier_offer_items(:'o4v2b', '[{"item_type":"service","description":"START+","quantity":1,"unit_price_cents":32000}]'::jsonb);
select public.admin_update_web_atelier_offer_draft(:'o4v2b', jsonb_build_object('valid_until', (public.web_atelier_business_date() + 21)::text));
select public.admin_mark_web_atelier_offer_sent(:'o4v2b') ->> 'snapshot_sha256' as o4v2hash \gset
select t.ok((select status from public.web_atelier_offers where id = :'o4') = 'superseded', 'v1 superseded on successful v2 send');
select t.ok((select superseded_by_offer_id from public.web_atelier_offers where id = :'o4') = :'o4v2b'::uuid, 'v1 points at successor after send');
select t.ok((select count(*) from public.web_atelier_offers where inquiry_id = :'inq4' and status = 'sent') = 1, 'exactly one open SENT after supersede');

select t.ok(not exists (select 1 from public.web_atelier_projects where status = 'planned'), 'legacy planned status unused');
select t.fails(format($q$ select public.admin_update_web_atelier_project(%L, '{"status":"scheduled"}'::jsonb) $q$, :'project1'), 'project_invalid_transition', 'completed -> scheduled refused');

select t.ok(has_function_privilege('authenticated', 'public.admin_record_web_atelier_offer_delivery(uuid,timestamptz,text,text)', 'execute'), 'authenticated can execute delivery RPC');
select t.ok(not has_function_privilege('anon', 'public.admin_record_web_atelier_offer_delivery(uuid,timestamptz,text,text)', 'execute'), 'anon cannot execute delivery RPC');
select t.ok((select 'search_path=""' = any (p.proconfig) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_record_web_atelier_offer_delivery'), 'delivery RPC empty search_path');
select t.ok((select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_record_web_atelier_offer_delivery'), 'delivery RPC SECURITY DEFINER');

\echo ALL_SCENARIOS_DONE
