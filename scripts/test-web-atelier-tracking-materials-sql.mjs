// Throwaway Docker postgres:17 regression for F2.4.16E–F.
// Never connects to Supabase. Usage:
//   node scripts/test-web-atelier-tracking-materials-sql.mjs [--require-docker]

import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const requireDocker = process.argv.includes('--require-docker')
const IMAGE = 'postgres:17'
const NAME = `wa-ef-sql-test-${process.pid}`

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
  console.log('web-atelier tracking/materials SQL tests SKIPPED: Docker daemon not available')
  process.exit(requireDocker ? 2 : 0)
}

const hasImage = docker(['image', 'inspect', IMAGE])
if (hasImage.status !== 0) {
  console.log(
    `web-atelier tracking/materials SQL tests SKIPPED: local image ${IMAGE} not present (no pull is attempted)`,
  )
  process.exit(requireDocker ? 2 : 0)
}

function cleanup() {
  docker(['rm', '-f', NAME])
}

async function runConcurrency() {
  psqlExec('select t.as_postgres()')
  const projectId = psqlExec(`select t.as_admin(); select t.mk_accepted_project('Race Revoke')`)
  const created = psqlExec(
    `select t.as_admin(); select public.admin_create_web_atelier_project_tracking_token('${projectId}'::uuid, now() + interval '7 days', 'race')`,
  )
  const tokenId = JSON.parse(created).token_id
  const token = JSON.parse(created).token

  const revokeSql = (label) => `
\\set ON_ERROR_STOP on
select t.as_admin();
do $body$
declare
  v_ok boolean := false;
  v_err text;
  v_already boolean := false;
begin
  begin
    select (public.admin_revoke_web_atelier_project_tracking_token('${tokenId}'::uuid) ->> 'already_revoked')::boolean
      into v_already;
    v_ok := true;
  exception when others then
    v_err := sqlerrm;
  end;
  raise notice 'RACE_OUTcome rev_${label}=%',
    case
      when v_ok and not coalesce(v_already, false) then 'first'
      when v_ok and coalesce(v_already, false) then 'idempotent'
      else coalesce(v_err, 'err')
    end;
end
$body$;
COMMIT;
`

  const useSql = `
\\set ON_ERROR_STOP on
select t.as_anon();
do $body$
declare
  v_ok boolean := false;
  v_err text;
begin
  begin
    perform public.get_web_atelier_project_public_status('${token}');
    v_ok := true;
  exception when others then
    v_err := sqlerrm;
  end;
  raise notice 'RACE_OUTcome use=%', case when v_ok then 'ok' else coalesce(v_err, 'err') end;
end
$body$;
COMMIT;
`

  const [r1, r2, use] = await Promise.all([
    psqlAsync(revokeSql('a')),
    psqlAsync(revokeSql('b')),
    psqlAsync(useSql),
  ])

  const revOutcomes = [raceOutcomeFrom(r1, 'rev_a'), raceOutcomeFrom(r2, 'rev_b')]
  const firsts = revOutcomes.filter((value) => value === 'first').length
  const idempotents = revOutcomes.filter((value) => value === 'idempotent').length
  if (firsts !== 1 || firsts + idempotents !== 2) {
    throw new Error(
      `expected one first revoke + one idempotent, got: ${revOutcomes.join(', ') || '(empty)'}`,
    )
  }

  const useOutcome = raceOutcomeFrom(use, 'use')
  // Concurrent use may win before revoke or see revoked/invalid — never a hard crash.
  if (!useOutcome || useOutcome === 'err') {
    throw new Error(`concurrent use produced no outcome: ${use.stderr}`)
  }
  const revokedAt = psqlExec(
    `select t.as_postgres(); select (revoked_at is not null)::text from public.web_atelier_project_tracking_tokens where id = '${tokenId}'::uuid`,
  )
  if (revokedAt !== 'true') {
    throw new Error('token not revoked after concurrent revoke race')
  }
  console.log('  ok  concurrent revocation: one first revoke, token ends revoked')
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
  ]

  const script = [
    '\\set ON_ERROR_STOP on',
    read('scripts/sql/web-atelier-offers.bootstrap.sql'),
    ...migrations.map((file) => `\\echo APPLY ${file}\n${read(file)}`),
    read('scripts/sql/web-atelier-tracking-materials.scenarios.sql'),
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
    !output.includes('ALL_TRACKING_MATERIALS_SCENARIOS_DONE')
  ) {
    console.log('\n--- failures ---')
    for (const line of failures) console.log(line)
    if (failures.length === 0) console.log(output.split('\n').slice(-40).join('\n'))
    console.log(
      `\nweb-atelier tracking/materials SQL tests FAILED (${passes.length} passed before failure)`,
    )
  } else {
    console.log(`\nweb-atelier tracking/materials SQL scenarios passed (${passes.length} checks)`)
    await runConcurrency()
    console.log(
      `\nweb-atelier tracking/materials SQL tests passed (${passes.length} checks + concurrency)`,
    )
    exitCode = 0
  }
} catch (error) {
  console.log(
    `web-atelier tracking/materials SQL tests ERROR: ${error instanceof Error ? error.message : error}`,
  )
} finally {
  cleanup()
}
process.exit(exitCode)
