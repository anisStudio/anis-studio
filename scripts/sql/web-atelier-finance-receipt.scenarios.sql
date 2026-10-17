-- LOCAL TEST SCENARIOS for F2.4 payment receipt confirmation (Docker only).

\set ON_ERROR_STOP on
select t.as_postgres();

do $helpers$
begin
  if to_regprocedure('t.mk_accepted_project(text)') is null then
    raise exception 't.mk_accepted_project missing';
  end if;
end
$helpers$;

-- Existing installment preserved + no auto confirmation
select t.as_admin();
do $preserve$
declare
  v_project uuid;
  v_schedule uuid;
  v_count int;
begin
  v_project := t.mk_accepted_project('Receipt Preserve');
  v_schedule := public.admin_create_web_atelier_payment_schedule(
    v_project, 'Avans', current_date + 3, 10000, 'F2.4 test advance', 0
  );
  perform t.ok(v_schedule is not null, 'legacy advance schedule kept creatable');
  perform t.ok(
    (select receipt_confirmed_at is null from public.web_atelier_payment_schedules where id = v_schedule),
    'new schedule not auto-confirmed'
  );

  begin
    perform public.admin_save_web_atelier_payment_plan(
      v_project, 'full',
      jsonb_build_array(jsonb_build_object(
        'label', 'Cjelokupna uplata',
        'amount_cents', (select agreed_total_cents from public.web_atelier_projects where id = v_project)
      ))
    );
    raise exception 'FAIL: plan should refuse when schedule exists';
  exception when others then
    if sqlerrm ~ 'payment_plan_already_exists' then
      raise notice 'PASS: duplicate plan refused when schedules exist';
    else
      raise;
    end if;
  end;

  select count(*) into v_count from public.web_atelier_payment_schedules where project_id = v_project;
  perform t.ok(v_count = 1, 'existing installment count unchanged after refused plan');
end
$preserve$;

-- Full payment plan default path
select t.as_admin();
do $full$
declare
  v_project uuid;
  v_total bigint;
  v_result jsonb;
  v_sid uuid;
  v_pay_before int;
  v_pay_after int;
  v_conf jsonb;
  v_token jsonb;
  v_public jsonb;
begin
  v_project := t.mk_accepted_project('Receipt Full');
  select agreed_total_cents into v_total from public.web_atelier_projects where id = v_project;

  v_result := public.admin_save_web_atelier_payment_plan(
    v_project, 'full',
    jsonb_build_array(jsonb_build_object(
      'label', 'Cjelokupna uplata',
      'amount_cents', v_total
    ))
  );
  perform t.ok(v_result->>'plan_kind' = 'full', 'full plan saved');
  perform t.ok(jsonb_array_length(v_result->'schedule_ids') = 1, 'full plan one schedule');

  select id into v_sid
  from public.web_atelier_payment_schedules
  where project_id = v_project;

  select count(*) into v_pay_before from public.web_atelier_payment_records where project_id = v_project;

  v_conf := public.admin_confirm_web_atelier_payment_receipt(v_sid);
  perform t.ok((v_conf->>'already_confirmed')::boolean = false, 'first confirm');
  perform t.ok(v_conf->>'receipt_confirmed_at' is not null, 'confirm timestamp set');

  select count(*) into v_pay_after from public.web_atelier_payment_records where project_id = v_project;
  perform t.ok(v_pay_before = v_pay_after, 'confirm does not create payment_records');

  v_conf := public.admin_confirm_web_atelier_payment_receipt(v_sid);
  perform t.ok((v_conf->>'already_confirmed')::boolean = true, 'idempotent confirm');

  v_token := public.admin_create_web_atelier_project_tracking_token(
    v_project, now() + interval '7 days', 'receipt'
  );
  v_public := public.get_web_atelier_project_public_status(v_token->>'token');
  perform t.ok(jsonb_array_length(v_public->'receipts') = 1, 'public receipts one item');
  perform t.ok(v_public->'receipts'->0->>'label' = 'Cjelokupna uplata', 'public label full payment');
  perform t.ok(v_public->'receipts'->0->>'status' = 'confirmed', 'public status confirmed');
  perform t.ok(not (v_public->'receipts'->0 ? 'amount_cents'), 'public no amount_cents');
  perform t.ok(not (v_public ? 'agreed_total_cents'), 'public no agreed total');
  perform t.ok(not (v_public->'receipts'->0 ? 'receipt_confirmed_by'), 'public no admin id');

  perform public.admin_correct_web_atelier_payment_receipt(v_sid, 'Pogrešna uplata u Parri');
  perform t.ok(
    (select receipt_confirmed_at is null from public.web_atelier_payment_schedules where id = v_sid),
    'correction clears confirmation'
  );
  perform t.ok(
    (select count(*) = 2 from public.web_atelier_payment_receipt_events where schedule_id = v_sid),
    'audit has confirm + correct'
  );

  v_public := public.get_web_atelier_project_public_status(v_token->>'token');
  perform t.ok(v_public->'receipts'->0->>'status' = 'awaiting', 'public awaiting after correction');
end
$full$;

-- Advance + balance optional
select t.as_admin();
do $adv$
declare
  v_project uuid;
  v_total bigint;
  v_result jsonb;
begin
  v_project := t.mk_accepted_project('Receipt Advance');
  select agreed_total_cents into v_total from public.web_atelier_projects where id = v_project;

  begin
    perform public.admin_save_web_atelier_payment_plan(
      v_project, 'advance_balance',
      jsonb_build_array(
        jsonb_build_object('label', 'Avans', 'amount_cents', 1000),
        jsonb_build_object('label', 'Završna uplata', 'amount_cents', 1000)
      )
    );
    raise exception 'FAIL: mismatched advance totals should fail';
  exception when others then
    if sqlerrm ~ 'payment_plan_total_mismatch' then
      raise notice 'PASS: advance+balance totals validated';
    else
      raise;
    end if;
  end;

  v_result := public.admin_save_web_atelier_payment_plan(
    v_project, 'advance_balance',
    jsonb_build_array(
      jsonb_build_object('label', 'Avans', 'amount_cents', (v_total / 2)),
      jsonb_build_object('label', 'Završna uplata', 'amount_cents', v_total - (v_total / 2))
    )
  );
  perform t.ok(jsonb_array_length(v_result->'schedule_ids') = 2, 'advance+balance two schedules');
end
$adv$;

-- Custom installments + rounding-safe total
select t.as_admin();
do $custom$
declare
  v_project uuid;
  v_total bigint;
  v_a bigint;
  v_b bigint;
  v_c bigint;
begin
  v_project := t.mk_accepted_project('Receipt Custom');
  select agreed_total_cents into v_total from public.web_atelier_projects where id = v_project;
  v_a := v_total / 3;
  v_b := v_total / 3;
  v_c := v_total - v_a - v_b;

  perform public.admin_save_web_atelier_payment_plan(
    v_project, 'custom',
    jsonb_build_array(
      jsonb_build_object('label', 'Rata 1', 'amount_cents', v_a),
      jsonb_build_object('label', 'Rata 2', 'amount_cents', v_b),
      jsonb_build_object('label', 'Rata 3', 'amount_cents', v_c)
    )
  );
  perform t.ok(
    (select count(*) = 3 from public.web_atelier_payment_schedules where project_id = v_project),
    'custom three installments'
  );
end
$custom$;

-- Anon / non-admin cannot confirm; revoked/expired token hide receipts via error
select t.as_anon();
select t.fails(
  $q$ select public.admin_confirm_web_atelier_payment_receipt('00000000-0000-4000-8000-000000000001') $q$,
  'forbidden|not_admin|permission denied|42501',
  'anon cannot confirm receipt'
);

select t.as_user();
select t.fails(
  $q$ select public.admin_correct_web_atelier_payment_receipt('00000000-0000-4000-8000-000000000001', 'x') $q$,
  'forbidden|not_admin|permission denied|42501|payment_schedule',
  'non-admin cannot correct receipt'
);

select t.as_admin();
do $token$
declare
  v_project uuid;
  v_total bigint;
  v_sid uuid;
  v_token jsonb;
  v_revoked jsonb;
begin
  v_project := t.mk_accepted_project('Receipt Token');
  select agreed_total_cents into v_total from public.web_atelier_projects where id = v_project;
  perform public.admin_save_web_atelier_payment_plan(
    v_project, 'full',
    jsonb_build_array(jsonb_build_object('label', 'Cjelokupna uplata', 'amount_cents', v_total))
  );
  select id into v_sid from public.web_atelier_payment_schedules where project_id = v_project;
  perform public.admin_confirm_web_atelier_payment_receipt(v_sid);

  v_token := public.admin_create_web_atelier_project_tracking_token(
    v_project, now() + interval '1 day', 'tok'
  );
  v_revoked := public.admin_revoke_web_atelier_project_tracking_token((v_token->>'token_id')::uuid);

  begin
    perform public.get_web_atelier_project_public_status(v_token->>'token');
    raise exception 'FAIL: revoked token should not return status';
  exception when others then
    if sqlerrm ~ 'tracking_token_revoked' then
      raise notice 'PASS: revoked token returns no confirmation data';
    else
      raise;
    end if;
  end;

  -- Cross-project: confirm schedule from project A cannot be listed under project B public token
  declare
    v_other uuid;
    v_other_token jsonb;
    v_public jsonb;
  begin
    v_other := t.mk_accepted_project('Receipt Other');
    v_other_token := public.admin_create_web_atelier_project_tracking_token(
      v_other, now() + interval '1 day', 'other'
    );
    v_public := public.get_web_atelier_project_public_status(v_other_token->>'token');
    perform t.ok(
      coalesce(jsonb_array_length(v_public->'receipts'), 0) = 0,
      'other project public receipts empty (no cross leak)'
    );
  end;
end
$token$;

select t.as_anon();
select t.fails(
  $q$ select * from public.web_atelier_payment_receipt_events $q$,
  'permission denied|42501',
  'anon cannot select receipt events'
);

\echo ALL_FINANCE_RECEIPT_SCENARIOS_DONE
