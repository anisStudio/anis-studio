-- LOCAL TEST SCENARIOS for F2.6 Smart Booking (throwaway Docker postgres only).

\set ON_ERROR_STOP on
select t.as_postgres();

select t.as_admin();

-- Shared settings default
select t.ok(
  (select shared_consultation_capacity = 1 from public.booking_shared_settings where id = 1),
  'default shared consultation capacity is 1'
);

-- Cross-department shared capacity
do $shared$
declare
  v_wa uuid;
  v_int uuid;
  r1 uuid;
  r2 uuid;
begin
  v_wa := public.admin_create_department_availability_window(
    'web_atelier', 'WA slot',
    timestamptz '2026-12-01 09:00:00+01',
    timestamptz '2026-12-01 11:00:00+01',
    1, null
  );
  v_int := public.admin_create_department_availability_window(
    'interiors', 'INT slot',
    timestamptz '2026-12-01 09:30:00+01',
    timestamptz '2026-12-01 11:30:00+01',
    1, null
  );

  r1 := public.admin_create_manual_booking(
    v_wa,
    timestamptz '2026-12-01 09:00:00+01',
    timestamptz '2026-12-01 11:00:00+01',
    'Ana WA', null, 'ana@example.com', '0911111111',
    'Opis WA', 'phone', 'consultation', 'confirmed', null, 'booking_lead', null
  );
  perform t.ok(r1 is not null, 'first dept consultation booked');

  begin
    r2 := public.admin_create_manual_booking(
      v_int,
      timestamptz '2026-12-01 09:30:00+01',
      timestamptz '2026-12-01 11:30:00+01',
      'Iva INT', null, 'iva@example.com', '0922222222',
      'Opis INT', 'facebook', 'consultation', 'confirmed', null, 'booking_lead', null
    );
    raise exception 'FAIL: cross-department shared capacity should block';
  exception when others then
    if sqlerrm ~ 'shared_consultation_capacity_exceeded' then
      raise notice 'PASS: cross-department shared capacity refused';
    else
      raise;
    end if;
  end;

  -- Production kind does not consume shared consultation capacity.
  r2 := public.admin_create_manual_booking(
    v_int,
    timestamptz '2026-12-01 09:30:00+01',
    timestamptz '2026-12-01 11:30:00+01',
    'Prod INT', null, null, null,
    'Produkcija', 'admin', 'production', 'confirmed', null, 'booking_lead', null
  );
  perform t.ok(r2 is not null, 'production booking allowed beside consultation');
end
$shared$;

-- Closures warn and do not cancel
do $close$
declare
  v_win uuid;
  v_res uuid;
  v_out jsonb;
begin
  v_win := public.admin_create_department_availability_window(
    'lrc', 'LRC week',
    timestamptz '2026-12-07 08:00:00+01',
    timestamptz '2026-12-11 18:00:00+01',
    2, null
  );
  v_res := public.admin_create_manual_booking(
    v_win,
    timestamptz '2026-12-08 10:00:00+01',
    timestamptz '2026-12-08 11:00:00+01',
    'LRC Guest', null, 'lrc@example.com', '0933333333',
    'Naručeni proizvod', 'instagram', 'consultation', 'confirmed', null,
    'booking_lead', null
  );

  v_out := public.admin_create_availability_closure(
    timestamptz '2026-12-08 00:00:00+01',
    timestamptz '2026-12-09 00:00:00+01',
    'lrc',
    'Admin vacation reason'
  );
  perform t.ok((v_out->>'has_conflicts')::boolean = true, 'closure reports conflicts');
  perform t.ok(
    (select status = 'confirmed' from public.department_reservations where id = v_res),
    'closure did not cancel existing booking'
  );

  -- Public list must not expose closure reason
  perform t.as_anon();
  perform t.ok(
    (select public.public_list_consultation_availability(
      'lrc',
      timestamptz '2026-12-01 00:00:00+01',
      timestamptz '2026-12-20 00:00:00+01'
    )::text) !~* 'Admin vacation reason',
    'public availability omits closure reason'
  );
  perform t.as_admin();
end
$close$;

-- Public atomic book + idempotency + stale refusal
do $public$
declare
  v_win uuid;
  v_a jsonb;
  v_b jsonb;
  v_key uuid := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
begin
  perform t.as_admin();
  perform public.admin_update_booking_shared_settings(2, null, null);

  v_win := public.admin_create_department_availability_window(
    'interiors', 'Public slot',
    timestamptz '2027-01-15 10:00:00+01',
    timestamptz '2027-01-15 12:00:00+01',
    1, null
  );

  perform t.as_anon();
  v_a := public.public_book_consultation_slot(
    'interiors', v_win, 'Maja Test', 'maja@example.com', '0955555555',
    'Detaljan opis projekta kuhinje.', v_key, 'fp1', 'booking_lead', null
  );
  perform t.ok((v_a->>'replay')::boolean = false, 'public book creates reservation');

  v_b := public.public_book_consultation_slot(
    'interiors', v_win, 'Maja Test', 'maja@example.com', '0955555555',
    'Detaljan opis projekta kuhinje.', v_key, 'fp1', 'booking_lead', null
  );
  perform t.ok((v_b->>'replay')::boolean = true, 'idempotent replay returns same booking');
  perform t.ok(v_a->>'reservation_id' = v_b->>'reservation_id', 'idempotent same id');

  begin
    perform public.public_book_consultation_slot(
      'interiors', v_win, 'Other', 'other@example.com', '0966666666',
      'Drugi pokušaj istog slota.', 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee',
      'fp2', 'booking_lead', null
    );
    raise exception 'FAIL: second public book should fail on full slot';
  exception when others then
    if sqlerrm ~ 'booking_slot_unavailable|capacity_exceeded|shared_consultation' then
      raise notice 'PASS: second public book refused when full';
    else
      raise;
    end if;
  end;

  -- No PII leak via list
  perform t.ok(
    (select public.public_list_consultation_availability(
      'interiors',
      timestamptz '2027-01-01 00:00:00+01',
      timestamptz '2027-02-01 00:00:00+01'
    )::text) !~* 'maja@example.com',
    'public list has no customer email'
  );
end
$public$;

-- Reschedule history + cancel reason + outcome release
do $adminflow$
declare
  v_win1 uuid;
  v_win2 uuid;
  v_res uuid;
  v_hist jsonb;
begin
  perform t.as_admin();
  perform public.admin_update_booking_shared_settings(3, null, null);

  v_win1 := public.admin_create_department_availability_window(
    'web_atelier', 'A',
    timestamptz '2027-02-01 09:00:00+01',
    timestamptz '2027-02-01 11:00:00+01',
    1, null
  );
  v_win2 := public.admin_create_department_availability_window(
    'web_atelier', 'B',
    timestamptz '2027-02-02 09:00:00+01',
    timestamptz '2027-02-02 11:00:00+01',
    1, null
  );
  v_res := public.admin_create_manual_booking(
    v_win1,
    timestamptz '2027-02-01 09:00:00+01',
    timestamptz '2027-02-01 11:00:00+01',
    'Reschedule Me', null, 're@example.com', '0977777777',
    'Opis', 'whatsapp', 'consultation', 'confirmed', null, 'booking_lead', null
  );

  perform public.admin_reschedule_reservation(
    v_res, v_win2,
    timestamptz '2027-02-02 09:00:00+01',
    timestamptz '2027-02-02 11:00:00+01',
    'Dogovoreno telefonom'
  );
  v_hist := public.admin_list_reservation_reschedule_history(v_res);
  perform t.ok(jsonb_array_length(v_hist) = 1, 'reschedule history recorded');

  perform public.admin_set_consultation_outcome(v_res, 'info_sufficient', true);
  perform t.ok(
    (select slot_released_at is not null from public.department_reservations where id = v_res),
    'info sufficient can release slot'
  );
  perform t.ok(
    (select status = 'confirmed' from public.department_reservations where id = v_res),
    'releasing slot does not delete reservation'
  );

  perform public.admin_cancel_reservation_with_reason(v_res, 'Klijent odustao');
  perform t.ok(
    (select status = 'cancelled' and cancel_reason = 'Klijent odustao'
     from public.department_reservations where id = v_res),
    'cancel stores reason'
  );

  perform t.as_postgres();
  begin
    delete from public.department_reservations where id = v_res;
    raise exception 'FAIL: hard delete should be forbidden';
  exception when others then
    if sqlerrm ~ 'reservation_delete_forbidden' then
      raise notice 'PASS: hard delete forbidden';
    else
      raise;
    end if;
  end;
end
$adminflow$;

-- Anon cannot read closures / settings tables
select t.as_anon();
select t.fails(
  $q$ select * from public.availability_closures $q$,
  'permission denied|42501',
  'anon cannot select closures'
);
select t.fails(
  $q$ select * from public.booking_shared_settings $q$,
  'permission denied|42501',
  'anon cannot select shared settings'
);
select t.fails(
  $q$ select public.admin_list_booking_calendar(null, null, null) $q$,
  'forbidden|not_admin|permission denied|42501',
  'anon cannot list admin calendar'
);

select t.as_postgres();
\echo ALL_F26_SCENARIOS_DONE
