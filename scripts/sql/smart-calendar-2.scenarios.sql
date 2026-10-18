-- LOCAL TEST SCENARIOS for F2.6 Smart Calendar 2.0 (throwaway Docker only).

\set ON_ERROR_STOP on
select t.as_postgres();
select t.as_admin();

-- Easter 2026 + fixed holidays (public helper; Easter Sunday via is_holiday)
select t.ok(
  public.booking_is_croatian_holiday(date '2026-04-05'),
  'Easter Sunday 2026 is holiday'
);
select t.ok(
  public.booking_is_croatian_holiday(date '2026-04-06'),
  'Easter Monday 2026 is holiday'
);
select t.ok(
  public.booking_is_croatian_holiday(date '2026-06-04'),
  'Corpus Christi 2026 is holiday'
);
select t.ok(
  public.booking_is_croatian_holiday(date '2026-01-01'),
  'New Year 2026 is holiday'
);
select t.ok(
  not public.booking_is_croatian_holiday(date '2026-10-02'),
  'ordinary weekday is not holiday'
);

-- Existing one-time closures stay recurrence=none (seeded if present)
do $closures$
declare
  v_oct uuid;
  v_nov uuid;
  v_out jsonb;
begin
  -- Simulate preserved Oct 2026 global + Nov 14–18 2026 via admin RPC (default recurrence=none)
  v_out := public.admin_create_availability_closure(
    timestamptz '2026-10-01 00:00:00+02',
    timestamptz '2026-11-01 00:00:00+01',
    null,
    'October 2026 global closure (test seed)',
    'none',
    null
  );
  v_oct := (v_out->>'closure_id')::uuid;

  v_out := public.admin_create_availability_closure(
    timestamptz '2026-11-14 00:00:00+01',
    timestamptz '2026-11-19 00:00:00+01',
    null,
    'Nov 14-18 2026 global closure (test seed)',
    'none',
    null
  );
  v_nov := (v_out->>'closure_id')::uuid;

  perform t.ok(
    exists (
      select 1 from public.availability_closures c
      where c.id = v_oct and c.recurrence = 'none'
    ),
    'October 2026 closure remains one-time'
  );
  perform t.ok(
    exists (
      select 1 from public.availability_closures c
      where c.id = v_nov and c.recurrence = 'none'
    ),
    'November 14–18 2026 closure remains one-time'
  );

  -- Annual recurrence does not auto-apply until enabled
  perform t.ok(
    not public.booking_interval_is_closed(
      'lrc',
      timestamptz '2027-11-14 10:00:00+01',
      timestamptz '2027-11-14 11:00:00+01'
    ),
    'Nov 14–18 does not repeat in 2027 while recurrence=none'
  );

  perform public.admin_set_closure_recurrence(v_nov, 'annual', null);

  perform t.ok(
    public.booking_interval_is_closed(
      'lrc',
      timestamptz '2027-11-15 10:00:00+01',
      timestamptz '2027-11-15 11:00:00+01'
    ),
    'Nov span repeats in 2027 only after annual enabled'
  );

  perform public.admin_set_closure_recurrence(v_nov, 'none', null);
end
$closures$;

-- Auto list produces Mon–Fri 16–19 slots without manual windows
do $auto$
declare
  v_out jsonb;
  v_slots jsonb;
  v_bad integer;
begin
  -- Widen horizon so December (after seeded Oct/Nov closures) is listable from “now”.
  perform public.admin_update_booking_shared_settings(
    1, 30, null, 120, true, time '16:00', time '19:00'
  );

  -- 2026-12-01 is Tuesday; after Nov 14–18 closure; not a Croatian holiday.
  v_out := public.public_list_consultation_availability(
    'interiors',
    timestamptz '2026-12-01 00:00:00+01',
    timestamptz '2026-12-12 00:00:00+01'
  );
  v_slots := v_out->'slots';
  perform t.ok(jsonb_array_length(v_slots) > 0, 'auto weekly slots without manual windows');

  select count(*)::integer into v_bad
  from jsonb_array_elements(v_slots) s
  where (s->>'source') = 'auto_weekly'
    and (
      extract(isodow from ((s->>'starts_at')::timestamptz at time zone 'Europe/Zagreb')) > 5
      or to_char((s->>'starts_at')::timestamptz at time zone 'Europe/Zagreb', 'HH24:MI') < '16:00'
      or to_char((s->>'ends_at')::timestamptz at time zone 'Europe/Zagreb', 'HH24:MI') > '19:00'
    );
  perform t.ok(v_bad = 0, 'no auto slots outside Mon–Fri 16:00–19:00 Zagreb');
end
$auto$;

-- Month capacity: 3 accepted projects block new consultations for that dept/month
do $cap$
declare
  v_month date := date '2026-12-01';
  v_out jsonb;
  v_slots jsonb;
begin
  perform public.admin_update_booking_shared_settings(
    1, 30, null, 120, true, time '16:00', time '19:00'
  );

  perform public.admin_allocate_department_capacity(
    'lrc', v_month, 'LRC A', 'manual', null, null, false, null
  );
  perform public.admin_allocate_department_capacity(
    'lrc', v_month, 'LRC B', 'manual', null, null, false, null
  );
  perform public.admin_allocate_department_capacity(
    'lrc', v_month, 'LRC C', 'manual', null, null, false, null
  );

  begin
    perform public.admin_allocate_department_capacity(
      'lrc', v_month, 'LRC D', 'manual', null, null, false, null
    );
    raise exception 'FAIL: 4th allocation should be refused';
  exception when others then
    if sqlerrm ~ 'booking_month_capacity_full' then
      raise notice 'PASS: 4th accepted project refused';
    else
      raise;
    end if;
  end;

  -- Other department still has capacity
  perform public.admin_allocate_department_capacity(
    'interiors', v_month, 'INT A', 'manual', null, null, false, null
  );
  perform t.ok(
    public.booking_department_month_has_capacity('interiors', v_month),
    'interiors unaffected when lrc is full'
  );
  perform t.ok(
    not public.booking_department_month_has_capacity('lrc', v_month),
    'lrc month is full'
  );

  v_out := public.public_list_consultation_availability(
    'lrc',
    timestamptz '2026-12-01 00:00:00+01',
    timestamptz '2026-12-12 00:00:00+01'
  );
  v_slots := v_out->'slots';
  perform t.ok(
    jsonb_array_length(v_slots) = 0,
    'no public consultation slots for full lrc month'
  );

  v_out := public.public_list_consultation_availability(
    'interiors',
    timestamptz '2026-12-01 00:00:00+01',
    timestamptz '2026-12-12 00:00:00+01'
  );
  perform t.ok(
    jsonb_array_length(v_out->'slots') > 0,
    'interiors still lists slots in same month'
  );

  -- Audited override allocates #4
  perform public.admin_allocate_department_capacity(
    'lrc', v_month, 'LRC override', 'manual', null, 'vip', true, 'documented override'
  );
  perform t.ok(true, 'override allocation with reason allowed');
end
$cap$;

select t.ok(
  (select default_slot_minutes from public.booking_shared_settings where id = 1) = 30,
  'default slot minutes is 30 after Smart Calendar 2.0'
);

select t.ok(
  not has_function_privilege('anon', 'public.public_book_consultation_slot(text,uuid,text,text,text,text,uuid,text,text,uuid)', 'execute'),
  'anon cannot execute public_book_consultation_slot'
);

-- WA capacity sync helpers present (full offer→project E2E covered by WA suites)
select t.ok(
  to_regprocedure(
    'public.booking_sync_web_atelier_capacity_allocate(uuid,text,date,boolean,text)'
  ) is not null,
  'WA capacity allocate helper exists'
);
select t.ok(
  to_regprocedure(
    'public.admin_create_web_atelier_project_from_offer(uuid,date,boolean,text)'
  ) is not null,
  'WA create-from-offer includes capacity args'
);
select t.ok(
  not has_function_privilege(
    'anon',
    'public.admin_create_web_atelier_project_from_offer(uuid,date,boolean,text)',
    'execute'
  ),
  'anon cannot create WA projects / allocate capacity'
);

do $done$
begin
  raise notice 'PASS: Smart Calendar 2.0 scenario block complete';
  raise notice 'ALL_F26_SC2_SCENARIOS_DONE';
end
$done$;
