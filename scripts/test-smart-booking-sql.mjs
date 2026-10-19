// Throwaway Docker postgres:17 regression for F2.6 smart booking.
// Never connects to Supabase. Usage:
//   node scripts/test-smart-booking-sql.mjs [--require-docker]

import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const requireDocker = process.argv.includes('--require-docker')
const IMAGE = 'postgres:17'
const NAME = `f26-booking-sql-test-${process.pid}`

function docker(args, options = {}) {
  return spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options })
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

function psqlExec(sql) {
  const result = docker([
    'exec',
    NAME,
    'bash',
    '-lc',
    `psql -U postgres -v ON_ERROR_STOP=1 -tAc ${JSON.stringify(sql)}`,
  ])
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `psqlExec failed: ${sql}`)
  }
  return result.stdout.trim()
}

function psqlAsync(sql) {
  return new Promise((resolve) => {
    const child = spawn(
      'docker',
      ['exec', '-i', NAME, 'bash', '-lc', 'psql -U postgres -v ON_ERROR_STOP=1 -q -X -f -'],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    )
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('close', (code) => {
      resolve({ status: code ?? 1, stdout, stderr })
    })
    child.stdin.write(sql)
    child.stdin.end()
  })
}

function raceOutcomeFrom(result, tag) {
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const match = text.match(new RegExp(`RACE_OUTcome ${tag}=([^\\n\\r]+)`))
  return match?.[1]?.trim() ?? ''
}

const info = docker(['info', '--format', '{{.ServerVersion}}'])
if (info.error || info.status !== 0) {
  console.log('F2.6 smart-booking SQL tests SKIPPED: Docker daemon not available')
  process.exit(requireDocker ? 2 : 0)
}

const hasImage = docker(['image', 'inspect', IMAGE])
if (hasImage.status !== 0) {
  console.log(
    `F2.6 smart-booking SQL tests SKIPPED: local image ${IMAGE} not present (no pull is attempted)`,
  )
  process.exit(requireDocker ? 2 : 0)
}

function cleanup() {
  docker(['rm', '-f', NAME])
}

async function runConcurrency() {
  psqlExec('select t.as_postgres()')
  psqlExec('select t.as_admin(); select public.admin_update_booking_shared_settings(1, null, null)')
  const windowId = psqlExec(
    "select t.as_admin(); select public.admin_create_department_availability_window('lrc','Race F26',timestamptz '2027-03-01 08:00:00+01',timestamptz '2027-03-01 18:00:00+01',1,null)",
  )

  // Concurrent bookers simulate Edge (service_role), not anon browser RPC.
  const bookSql = (label, key) => `
\\set ON_ERROR_STOP on
select t.as_service();
do $body$
declare
  v_ok boolean := false;
  v_err text;
  v_out jsonb;
begin
  begin
    v_out := public.public_book_consultation_slot(
      'lrc',
      '${windowId}'::uuid,
      'Race ${label}',
      'race_${label}@example.com',
      '09100000${label === 'a' ? '1' : '2'}',
      'Konkurentni opis rezervacije ${label}.',
      '${key}'::uuid,
      null,
      'booking_lead',
      null
    );
    v_ok := true;
  exception when others then
    v_err := sqlerrm;
  end;
  raise notice 'RACE_OUTcome conf_${label}=%',
    case when v_ok then 'ok' else coalesce(v_err, 'err') end;
end
$body$;
COMMIT;
`

  const [a, b] = await Promise.all([
    psqlAsync(bookSql('a', '11111111-1111-4111-8111-111111111111')),
    psqlAsync(bookSql('b', '22222222-2222-4222-8222-222222222222')),
  ])
  const outcomes = [raceOutcomeFrom(a, 'conf_a'), raceOutcomeFrom(b, 'conf_b')]
  const oks = outcomes.filter((value) => value === 'ok').length
  const denied = outcomes.filter((value) =>
    /booking_slot_unavailable|capacity_exceeded|shared_consultation/.test(value),
  ).length
  if (oks !== 1 || denied !== 1) {
    throw new Error(
      `expected one public booking winner and one refusal, got: ${outcomes.join(', ') || '(empty)'}`,
    )
  }
  console.log('  ok  concurrent public bookings: exactly one winner (shared/window capacity)')
}

async function runCapacityConcurrency() {
  psqlExec('select t.as_postgres()')
  // Use a fresh month never touched by scenarios; pre-fill 2 of 3.
  // psqlExec uses -tAc + JSON.stringify — keep SQL single-line (no raw newlines).
  psqlExec(
    "select t.as_admin(); select public.admin_allocate_department_capacity('web_atelier', date '2028-02-01', 'WA pre1', 'manual', null, null, false, null); select public.admin_allocate_department_capacity('web_atelier', date '2028-02-01', 'WA pre2', 'manual', null, null, false, null)",
  )

  const allocSql = (label) => `
\\set ON_ERROR_STOP on
select t.as_admin();
do $body$
declare
  v_ok boolean := false;
  v_err text;
begin
  begin
    perform public.admin_allocate_department_capacity(
      'web_atelier', date '2028-02-01', 'WA race ${label}', 'manual', null, null, false, null
    );
    v_ok := true;
  exception when others then
    v_err := sqlerrm;
  end;
  raise notice 'RACE_OUTcome cap_${label}=%',
    case when v_ok then 'ok' else coalesce(v_err, 'err') end;
end
$body$;
COMMIT;
`

  const [a, b] = await Promise.all([psqlAsync(allocSql('a')), psqlAsync(allocSql('b'))])
  const outcomes = [raceOutcomeFrom(a, 'cap_a'), raceOutcomeFrom(b, 'cap_b')]
  const oks = outcomes.filter((value) => value === 'ok').length
  const denied = outcomes.filter((value) => /booking_month_capacity_full/.test(value)).length
  if (oks !== 1 || denied !== 1) {
    throw new Error(
      `expected one capacity winner and one refusal, got: ${outcomes.join(', ') || '(empty)'}`,
    )
  }
  const used = psqlExec(
    "select t.as_admin(); select (public.admin_list_department_month_capacity('web_atelier', date '2028-02-01')->>'used')",
  )
  if (used !== '3') {
    throw new Error(`expected used=3 after race, got ${used}`)
  }
  console.log('  ok  concurrent capacity allocations: exactly one winner (month limit)')
}

let exitCode = 1
try {
  const run = docker([
    'run',
    '-d',
    '--rm',
    '--name',
    NAME,
    '-e',
    'POSTGRES_PASSWORD=test',
    '--tmpfs',
    '/var/lib/postgresql/data',
    IMAGE,
  ])
  if (run.status !== 0) throw new Error(`docker run failed: ${run.stderr}`)

  let ready = false
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const probe = docker(['exec', NAME, 'psql', '-U', 'postgres', '-tAc', 'select 1'])
    if (probe.status === 0 && probe.stdout.trim() === '1') {
      ready = true
      break
    }
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{}, 500)'])
  }
  if (!ready) throw new Error('postgres container did not become ready')

  const migrations = [
    'supabase/migrations/20261004083000_admin_authorization_foundation.sql',
    'supabase/migrations/20261013224500_web_atelier_inquiries.sql',
    'supabase/migrations/20261013235000_web_atelier_inquiry_gateway.sql',
    'supabase/migrations/20261014010000_web_atelier_offers_projects.sql',
    'supabase/migrations/20261016020000_web_atelier_tracking_materials.sql',
    'supabase/migrations/20261017010000_f24_comms_finance_availability.sql',
    'supabase/migrations/20261017120000_f24_payment_receipt_confirmation.sql',
    'supabase/migrations/20261017130000_f26_smart_booking_shared_availability.sql',
    'supabase/migrations/20261017140000_f26_booking_turnstile_edge_hardening.sql',
    'supabase/migrations/20261018100000_f26_smart_calendar_2.sql',
    'supabase/migrations/20261018101000_f26_wa_capacity_sync.sql',
  ]

  const script = [
    '\\set ON_ERROR_STOP on',
    read('scripts/sql/web-atelier-offers.bootstrap.sql'),
    ...migrations.map((file) => `\\echo APPLY ${file}\n${read(file)}`),
    read('scripts/sql/smart-booking.scenarios.sql'),
    read('scripts/sql/smart-calendar-2.scenarios.sql'),
  ].join('\n')

  const result = docker(
    ['exec', '-i', NAME, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-X', '-f', '-'],
    { input: script },
  )

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const passes = [...output.matchAll(/PASS: (.+)/g)].map((match) => match[1].trim())
  const failures = output.split('\n').filter((line) => /FAIL:|ERROR:/.test(line))

  for (const name of passes) console.log(`  ok  ${name}`)

  if (
    result.status !== 0 ||
    failures.length > 0 ||
    !output.includes('ALL_F26_SCENARIOS_DONE') ||
    !output.includes('ALL_F26_SC2_SCENARIOS_DONE')
  ) {
    console.log('\n--- failures ---')
    for (const line of failures) console.log(line)
    if (failures.length === 0) console.log(output.split('\n').slice(-80).join('\n'))
    console.log(`\nF2.6 smart-booking SQL tests FAILED (${passes.length} passed before failure)`)
  } else {
    console.log(`\nF2.6 smart-booking SQL scenarios passed (${passes.length} checks)`)
    await runConcurrency()
    await runCapacityConcurrency()
    console.log(
      `\nF2.6 smart-booking SQL tests passed (${passes.length} checks + concurrency + capacity race)`,
    )
    exitCode = 0
  }
} catch (error) {
  console.log(`F2.6 smart-booking SQL tests ERROR: ${error instanceof Error ? error.message : error}`)
} finally {
  cleanup()
}
process.exit(exitCode)
