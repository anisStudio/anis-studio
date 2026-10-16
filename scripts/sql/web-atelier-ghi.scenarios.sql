-- LOCAL TEST SCENARIOS for F2.4 G–I (throwaway Docker postgres only).

\set ON_ERROR_STOP on
select t.as_postgres();

-- Reuse E–F helpers if present; otherwise define minimal project builder.
do $helpers$
begin
  if to_regprocedure('t.mk_accepted_project(text)') is null then
    raise exception 't.mk_accepted_project missing — apply tracking scenarios helpers first or bootstrap';
  end if;
end
$helpers$;

-- ---------------------------------------------------------------------------
-- G: communications + templates
-- ---------------------------------------------------------------------------

select t.as_admin();
select t.ok(
  (select count(*) = 0 from public.web_atelier_communications),
  'comms start empty'
);

select public.admin_upsert_communication_template(
  null, 'web_atelier', 'email', 'Pozdrav klijentu', 'Web Atelier',
  'Poštovani, javljamo se u vezi upita.', true
);

select t.ok(
  (select count(*) = 1 from public.admin_communication_templates where name = 'Pozdrav klijentu'),
  'template created'
);

select t.as_anon();
select t.fails(
  $q$ select public.admin_list_communication_templates(null) $q$,
  'forbidden|not_admin|permission denied|42501',
  'anon cannot list templates'
);

select t.as_user();
select t.fails(
  $q$ select public.admin_create_web_atelier_communication(
    'email','outbound','Hi','Body', now(), null, null, null, null
  ) $q$,
  'forbidden|not_admin|permission denied|42501|communication_filter|entity',
  'non-admin cannot create communication'
);

select t.as_admin();
do $g$
declare
  v_project uuid;
  v_inquiry uuid;
  v_offer uuid;
  v_comm uuid;
  v_list jsonb;
begin
  v_project := t.mk_accepted_project('G Comm Client');
  select inquiry_id, offer_id into v_inquiry, v_offer
  from public.web_atelier_projects where id = v_project;

  v_comm := public.admin_create_web_atelier_communication(
    'telephone', 'inbound', null, 'Klijent potvrdio rok',
    now(), v_inquiry, v_offer, v_project, null
  );
  perform t.ok(v_comm is not null, 'communication created');

  v_list := public.admin_list_web_atelier_communications(v_inquiry, null, null);
  perform t.ok(jsonb_array_length(v_list) = 1, 'list by inquiry returns 1');

  -- Public tracking must still omit financial/comms fields (payload shape).
  -- (token path covered in E–F; here ensure tables are not granted to anon)
end
$g$;

select t.as_anon();
select t.fails(
  $q$ select * from public.web_atelier_communications $q$,
  'permission denied|42501',
  'anon cannot select communications'
);
select t.fails(
  $q$ select * from public.web_atelier_payment_schedules $q$,
  'permission denied|42501',
  'anon cannot select payment schedules'
);

-- ---------------------------------------------------------------------------
-- H: finance — Parra refs, schedules, payments; no auto-paid
-- ---------------------------------------------------------------------------

select t.as_admin();
do $h$
declare
  v_project uuid;
  v_schedule uuid;
  v_doc uuid;
  v_pay uuid;
  v_bundle jsonb;
begin
  v_project := t.mk_accepted_project('H Finance Client');

  v_schedule := public.admin_create_web_atelier_payment_schedule(
    v_project, 'Avans 50%', current_date + 7, 25000, 'Ručno', 0
  );
  perform t.ok(v_schedule is not null, 'schedule created');

  begin
    perform public.admin_update_web_atelier_payment_schedule(
      v_schedule, jsonb_build_object('status', 'paid')
    );
    raise exception 'FAIL: direct paid status should be refused';
  exception when others then
    if sqlerrm ~ 'payment_status_paid_requires_payment_record' then
      raise notice 'PASS: cannot mark schedule paid without payment record';
    else
      raise;
    end if;
  end;

  v_doc := public.admin_create_web_atelier_financial_document(
    v_project, 'parra_invoice', 'PARRA-TEST-001', current_date, 50000, null
  );
  perform t.ok(v_doc is not null, 'parra document reference stored');

  v_pay := public.admin_record_web_atelier_payment(
    v_project, 25000, current_date, 'bank_transfer',
    v_schedule, v_doc, 'UPL-1', null, true
  );
  perform t.ok(v_pay is not null, 'payment recorded');
  perform t.ok(
    (select status from public.web_atelier_payment_schedules where id = v_schedule) = 'paid',
    'schedule marked paid only via payment RPC'
  );

  v_bundle := public.admin_list_web_atelier_finance(v_project);
  perform t.ok(jsonb_array_length(v_bundle->'schedules') = 1, 'finance list schedules');
  perform t.ok(jsonb_array_length(v_bundle->'documents') = 1, 'finance list documents');
  perform t.ok(jsonb_array_length(v_bundle->'payments') = 1, 'finance list payments');
end
$h$;

-- ---------------------------------------------------------------------------
-- I: availability capacity + no auto-reserve on accept
-- ---------------------------------------------------------------------------

select t.as_admin();
do $i$
declare
  v_window uuid;
  v_r1 uuid;
  v_r2 uuid;
  v_project uuid;
  v_offer uuid;
  v_before int;
  v_after int;
begin
  v_window := public.admin_create_department_availability_window(
    'web_atelier',
    'Tjedan 42',
    timestamptz '2026-10-19 08:00:00+02',
    timestamptz '2026-10-25 18:00:00+02',
    1,
    null
  );
  perform t.ok(v_window is not null, 'availability window created');

  v_r1 := public.admin_create_department_reservation(
    v_window,
    timestamptz '2026-10-20 09:00:00+02',
    timestamptz '2026-10-22 17:00:00+02',
    'Slot A',
    'confirmed',
    'unlinked',
    null,
    null
  );
  perform t.ok(v_r1 is not null, 'first confirmed reservation ok');

  begin
    v_r2 := public.admin_create_department_reservation(
      v_window,
      timestamptz '2026-10-21 09:00:00+02',
      timestamptz '2026-10-23 17:00:00+02',
      'Slot B overlap',
      'confirmed',
      'unlinked',
      null,
      null
    );
    raise exception 'FAIL: overlapping confirmed reservation should exceed capacity';
  exception when others then
    if sqlerrm ~ 'reservation_capacity_exceeded' then
      raise notice 'PASS: capacity exceeded refused';
    else
      raise;
    end if;
  end;

  -- Draft overlap is allowed.
  v_r2 := public.admin_create_department_reservation(
    v_window,
    timestamptz '2026-10-21 09:00:00+02',
    timestamptz '2026-10-23 17:00:00+02',
    'Slot B draft',
    'draft',
    'unlinked',
    null,
    null
  );
  perform t.ok(v_r2 is not null, 'draft overlap allowed');

  -- Offer acceptance does not create reservations.
  select count(*)::int into v_before from public.department_reservations;
  v_project := t.mk_accepted_project('I No Auto Reserve');
  select offer_id into v_offer from public.web_atelier_projects where id = v_project;
  perform t.ok(v_offer is not null, 'accepted project exists');
  select count(*)::int into v_after from public.department_reservations;
  perform t.ok(v_after = v_before, 'acceptance did not auto-create reservation');
end
$i$;

select t.as_anon();
select t.fails(
  $q$ select public.admin_list_department_availability(null, null, null) $q$,
  'forbidden|not_admin|permission denied|42501',
  'anon cannot list availability'
);

select t.as_postgres();
\echo ALL_GHI_SCENARIOS_DONE
