// Throwaway Docker postgres:17 regression for F2.4 G–I.
// Never connects to Supabase. Usage:
//   node scripts/test-web-atelier-ghi-sql.mjs [--require-docker]

import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const requireDocker = process.argv.includes('--require-docker')
const IMAGE = 'postgres:17'
const NAME = `wa-ghi-sql-test-${process.pid}`

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
  console.log('web-atelier G–I SQL tests SKIPPED: Docker daemon not available')
  process.exit(requireDocker ? 2 : 0)
}

const hasImage = docker(['image', 'inspect', IMAGE])
if (hasImage.status !== 0) {
  console.log(
    `web-atelier G–I SQL tests SKIPPED: local image ${IMAGE} not present (no pull is attempted)`,
  )
  process.exit(requireDocker ? 2 : 0)
}

function cleanup() {
  docker(['rm', '-f', NAME])
}

async function runConcurrency() {
  psqlExec('select t.as_postgres()')
  const windowId = psqlExec(
    "select t.as_admin(); select public.admin_create_department_availability_window('lrc','Race Window',timestamptz '2026-11-01 08:00:00+01',timestamptz '2026-11-07 18:00:00+01',1,null)",
  )

  const confirmSql = (label) => `
\\set ON_ERROR_STOP on
select t.as_admin();
do $body$
declare
  v_ok boolean := false;
  v_err text;
  v_id uuid;
begin
  begin
    v_id := public.admin_create_department_reservation(
      '${windowId}'::uuid,
      timestamptz '2026-11-02 09:00:00+01',
      timestamptz '2026-11-03 17:00:00+01',
      'Race ${label}',
      'confirmed',
      'unlinked',
      null,
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

  const [a, b] = await Promise.all([psqlAsync(confirmSql('a')), psqlAsync(confirmSql('b'))])
  const outcomes = [raceOutcomeFrom(a, 'conf_a'), raceOutcomeFrom(b, 'conf_b')]
  const oks = outcomes.filter((value) => value === 'ok').length
  const denied = outcomes.filter((value) => /reservation_capacity_exceeded/.test(value)).length
  if (oks !== 1 || denied !== 1) {
    throw new Error(
      `expected one capacity winner and one refusal, got: ${outcomes.join(', ') || '(empty)'}`,
    )
  }
  console.log('  ok  concurrent confirmed reservations: exactly one winner (capacity)')
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
    'supabase/migrations/20261014010000_web_atelier_offers_projects.sql',
    'supabase/migrations/20261016020000_web_atelier_tracking_materials.sql',
    'supabase/migrations/20261017010000_f24_comms_finance_availability.sql',
  ]

  const script = [
    '\\set ON_ERROR_STOP on',
    read('scripts/sql/web-atelier-offers.bootstrap.sql'),
    ...migrations.map((file) => `\\echo APPLY ${file}\n${read(file)}`),
    // Helpers for mk_accepted_project
    read('scripts/sql/web-atelier-tracking-materials.scenarios.sql')
      .split('ALL_TRACKING_MATERIALS_SCENARIOS_DONE')[0],
    read('scripts/sql/web-atelier-ghi.scenarios.sql'),
  ].join('\n')

  const result = docker(
    ['exec', '-i', NAME, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-X', '-f', '-'],
    { input: script },
  )

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const passes = [...output.matchAll(/PASS: (.+)/g)].map((match) => match[1].trim())
  const failures = output.split('\n').filter((line) => /FAIL:|ERROR:/.test(line))

  for (const name of passes) console.log(`  ok  ${name}`)

  if (result.status !== 0 || failures.length > 0 || !output.includes('ALL_GHI_SCENARIOS_DONE')) {
    console.log('\n--- failures ---')
    for (const line of failures) console.log(line)
    if (failures.length === 0) console.log(output.split('\n').slice(-50).join('\n'))
    console.log(`\nweb-atelier G–I SQL tests FAILED (${passes.length} passed before failure)`)
  } else {
    console.log(`\nweb-atelier G–I SQL scenarios passed (${passes.length} checks)`)
    await runConcurrency()
    console.log(`\nweb-atelier G–I SQL tests passed (${passes.length} checks + concurrency)`)
    exitCode = 0
  }
} catch (error) {
  console.log(`web-atelier G–I SQL tests ERROR: ${error instanceof Error ? error.message : error}`)
} finally {
  cleanup()
}
process.exit(exitCode)
