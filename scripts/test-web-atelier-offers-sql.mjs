// Executes the Web Atelier offer/project migration against a THROWAWAY local
// Docker postgres:17 container and runs the scenario script as the real API
// roles. Never connects to Supabase. Nothing here touches a production database.
//
// Usage: node scripts/test-web-atelier-offers-sql.mjs [--require-docker]
// Without Docker the test prints SKIPPED and exits 0 (or 2 with --require-docker).

import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OFFERS_MIGRATION = 'supabase/migrations/20261014010000_web_atelier_offers_projects.sql'
const requireDocker = process.argv.includes('--require-docker')
const IMAGE = 'postgres:17'
const NAME = `wa-offers-sql-test-${process.pid}`

function docker(args, options = {}) {
  return spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options })
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

function psql(sql) {
  return docker(
    ['exec', '-i', NAME, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-X', '-tAc'],
    { input: sql },
  )
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

const info = docker(['info', '--format', '{{.ServerVersion}}'])
if (info.error || info.status !== 0) {
  console.log('web-atelier offers SQL tests SKIPPED: Docker daemon not available')
  process.exit(requireDocker ? 2 : 0)
}

const hasImage = docker(['image', 'inspect', IMAGE])
if (hasImage.status !== 0) {
  console.log(`web-atelier offers SQL tests SKIPPED: local image ${IMAGE} not present (no pull is attempted)`)
  process.exit(requireDocker ? 2 : 0)
}

function cleanup() {
  docker(['rm', '-f', NAME])
}

function raceOutcomeFrom(result, tag) {
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const match = text.match(new RegExp(`RACE_OUTcome ${tag}=([^\\n\\r]+)`))
  return match?.[1]?.trim() ?? ''
}

async function runConcurrency() {
  // Fresh inquiry with one SENT offer + revision draft ready to send, for race tests.
  psqlExec('select t.as_postgres()')
  const raceInq = psqlExec(`select t.mk_inquiry('Race Conc')`)
  psqlExec(`update public.web_atelier_inquiries set status = 'under_review' where id = '${raceInq}'::uuid`)
  const raceV1 = psqlExec(
    `select t.as_admin(); select public.admin_create_web_atelier_offer_draft('${raceInq}'::uuid)`,
  )
  const raceScope = psqlExec(
    `select t.as_admin(); select public.admin_create_web_atelier_scope_version('${raceInq}'::uuid, t.scope_json())`,
  )
  psqlExec(
    `select t.as_admin(); select public.admin_set_web_atelier_offer_items('${raceV1}'::uuid, '[{"item_type":"service","description":"RACE","quantity":1,"unit_price_cents":10000}]'::jsonb)`,
  )
  psqlExec(
    `select t.as_admin(); select public.admin_update_web_atelier_offer_draft('${raceV1}'::uuid, jsonb_build_object('scope_version_id', '${raceScope}'::uuid, 'valid_until', (public.web_atelier_business_date() + 14)::text))`,
  )
  psqlExec(`select t.as_admin(); select public.admin_mark_web_atelier_offer_sent('${raceV1}'::uuid)`)
  const v2 = psqlExec(
    `select t.as_admin(); select public.admin_create_web_atelier_offer_draft('${raceInq}'::uuid, '${raceV1}'::uuid)`,
  )
  psqlExec(
    `select t.as_admin(); select public.admin_set_web_atelier_offer_items('${v2}'::uuid, '[{"item_type":"service","description":"RACE2","quantity":1,"unit_price_cents":11000}]'::jsonb)`,
  )
  psqlExec(
    `select t.as_admin(); select public.admin_update_web_atelier_offer_draft('${v2}'::uuid, jsonb_build_object('valid_until', (public.web_atelier_business_date() + 21)::text))`,
  )
  const prepOffers = psqlExec(`select count(*)::text from public.web_atelier_offers where inquiry_id = '${raceInq}'::uuid`)
  if (prepOffers !== '2') {
    throw new Error(`race prep offers not persisted (count=${prepOffers || '0'} inq=${raceInq})`)
  }

  // Race A: concurrent send of the same revision draft (exactly one succeeds).
  const sendSql = (label) => `
\\set ON_ERROR_STOP on
select t.as_admin();
do $body$
declare
  v_id uuid := '${v2}'::uuid;
  v_ok boolean := false;
  v_err text;
begin
  begin
    perform public.admin_mark_web_atelier_offer_sent(v_id);
    v_ok := true;
  exception when others then
    v_err := sqlerrm;
  end;
  raise notice 'RACE_OUTcome send_${label}=%', case when v_ok then 'ok' else coalesce(v_err, 'err') end;
end
$body$;
COMMIT;
`

  const [a, b] = await Promise.all([psqlAsync(sendSql('a')), psqlAsync(sendSql('b'))])
  if (a.status !== 0 && b.status !== 0) {
    throw new Error(`both concurrent sends failed hard: ${a.stderr} | ${b.stderr}`)
  }

  const sendOutcomes = [raceOutcomeFrom(a, 'send_a'), raceOutcomeFrom(b, 'send_b')]
  const oks = sendOutcomes.filter((value) => value === 'ok').length
  if (oks !== 1) {
    throw new Error(
      `expected exactly one concurrent send success, got: ${sendOutcomes.join(', ') || '(empty)'}; a(status=${a.status})=${a.stderr || a.stdout}; b(status=${b.status})=${b.stderr || b.stdout}`,
    )
  }
  console.log('  ok  concurrent mark_sent: exactly one winner (no deadlock)')

  // Race B: concurrent delivery on the winning SENT offer — exactly one succeeds.
  const sentStatus = psqlExec(
    `select t.as_admin(); select status from public.web_atelier_offers where id = '${v2}'::uuid`,
  )
  if (sentStatus !== 'sent') {
    throw new Error(`no SENT after race for v2=${v2} inq=${raceInq} (status=${sentStatus || 'missing'})`)
  }
  const sentId = v2

  const deliverySql = (label) => `
\\set ON_ERROR_STOP on
select t.as_admin();
do $body$
declare
  v_ok boolean := false;
  v_err text;
begin
  begin
    perform public.admin_record_web_atelier_offer_delivery(
      '${sentId}'::uuid, now(), 'email_manual', 'Concurrent delivery attempt ${label} xx'
    );
    v_ok := true;
  exception when others then
    v_err := sqlerrm;
  end;
  raise notice 'RACE_OUTcome del_${label}=%', case when v_ok then 'ok' else coalesce(v_err, 'err') end;
end
$body$;
COMMIT;
`
  const [d1, d2] = await Promise.all([psqlAsync(deliverySql('a')), psqlAsync(deliverySql('b'))])
  if (d1.status !== 0 && d2.status !== 0) {
    throw new Error(`both concurrent deliveries failed hard: ${d1.stderr} | ${d2.stderr}`)
  }
  const delOutcomes = [raceOutcomeFrom(d1, 'del_a'), raceOutcomeFrom(d2, 'del_b')]
  const delOks = delOutcomes.filter((value) => value === 'ok').length
  if (delOks !== 1) {
    throw new Error(`expected exactly one concurrent delivery success, got: ${delOutcomes.join(', ') || '(empty)'}`)
  }
  console.log('  ok  concurrent delivery: exactly one winner (no deadlock)')

  // Race C: concurrent accept after delivery — exactly one acceptance.
  const hash = psqlExec(
    `select t.as_admin(); select snapshot_sha256 from public.web_atelier_offers where id = '${sentId}'::uuid`,
  )
  const version = psqlExec(
    `select t.as_admin(); select version::text from public.web_atelier_offers where id = '${sentId}'::uuid`,
  )
  const offerNumber = psqlExec(
    `select t.as_admin(); select offer_number from public.web_atelier_offers where id = '${sentId}'::uuid`,
  )

  const decideSql = (label) => `
\\set ON_ERROR_STOP on
select t.as_admin();
do $body$
declare
  v_ok boolean := false;
  v_err text;
begin
  begin
    perform public.admin_record_web_atelier_offer_decision(
      '${sentId}'::uuid, 'accepted', ${version}, '${hash}',
      'Race Client', now(), 'email',
      '${offerNumber} #v${version} — concurrent accept ${label}',
      'Mailbox arhiva Inbox/WebAtelier/2026', null, true
    );
    v_ok := true;
  exception when others then
    v_err := sqlerrm;
  end;
  raise notice 'RACE_OUTcome dec_${label}=%', case when v_ok then 'ok' else coalesce(v_err, 'err') end;
end
$body$;
COMMIT;
`
  const [c1, c2] = await Promise.all([psqlAsync(decideSql('a')), psqlAsync(decideSql('b'))])
  if (c1.status !== 0 && c2.status !== 0) {
    throw new Error(`both concurrent decisions failed hard: ${c1.stderr} | ${c2.stderr}`)
  }
  const decOutcomes = [raceOutcomeFrom(c1, 'dec_a'), raceOutcomeFrom(c2, 'dec_b')]
  const decOks = decOutcomes.filter((value) => value === 'ok').length
  if (decOks !== 1) {
    throw new Error(`expected exactly one concurrent decision success, got: ${decOutcomes.join(', ') || '(empty)'}`)
  }
  const approvalCount = psqlExec(
    `select t.as_admin(); select count(*)::text from public.web_atelier_approvals where offer_id = '${sentId}'::uuid`,
  )
  if (approvalCount !== '1') {
    throw new Error(`expected 1 approval after concurrent decide, got ${approvalCount}`)
  }
  console.log('  ok  concurrent decision: exactly one acceptance (no deadlock)')
}

let exitCode = 1
try {
  const run = docker([
    'run', '-d', '--rm', '--name', NAME,
    '-e', 'POSTGRES_PASSWORD=test',
    '--tmpfs', '/var/lib/postgresql/data',
    IMAGE,
  ])
  if (run.status !== 0) throw new Error(`docker run failed: ${run.stderr}`)

  let ready = false
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const probe = docker(['exec', NAME, 'psql', '-U', 'postgres', '-tAc', 'select 1'])
    if (probe.status === 0 && probe.stdout.trim() === '1') {
      const again = docker(['exec', NAME, 'psql', '-U', 'postgres', '-tAc', 'select 1'])
      if (again.status === 0) {
        ready = true
        break
      }
    }
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{}, 500)'])
  }
  if (!ready) throw new Error('postgres container did not become ready')

  const migrations = [
    'supabase/migrations/20261004083000_admin_authorization_foundation.sql',
    'supabase/migrations/20261013224500_web_atelier_inquiries.sql',
    'supabase/migrations/20261013235000_web_atelier_inquiry_gateway.sql',
    OFFERS_MIGRATION,
  ]

  const script = [
    '\\set ON_ERROR_STOP on',
    read('scripts/sql/web-atelier-offers.bootstrap.sql'),
    ...migrations.map((file) => `\\echo APPLY ${file}\n${read(file)}`),
    read('scripts/sql/web-atelier-offers.scenarios.sql'),
  ].join('\n')

  const result = docker(
    ['exec', '-i', NAME, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-X', '-f', '-'],
    { input: script },
  )

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const passes = [...output.matchAll(/PASS: (.+)/g)].map((match) => match[1].trim())
  const failures = output.split('\n').filter((line) => /FAIL:|ERROR:/.test(line))

  for (const name of passes) console.log(`  ok  ${name}`)

  if (result.status !== 0 || failures.length > 0 || !output.includes('ALL_SCENARIOS_DONE')) {
    console.log('\n--- failures ---')
    for (const line of failures) console.log(line)
    if (failures.length === 0) console.log(output.split('\n').slice(-25).join('\n'))
    console.log(`\nweb-atelier offers SQL tests FAILED (${passes.length} passed before failure)`)
  } else {
    console.log(`\nweb-atelier offers SQL scenarios passed (${passes.length} checks)`)
    await runConcurrency()
    console.log(`\nweb-atelier offers SQL tests passed (${passes.length} checks + concurrency)`)
    exitCode = 0
  }
} catch (error) {
  console.log(`web-atelier offers SQL tests ERROR: ${error instanceof Error ? error.message : error}`)
} finally {
  cleanup()
}
process.exit(exitCode)
