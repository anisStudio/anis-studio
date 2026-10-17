// Throwaway Docker postgres:17 regression for F2.4 receipt confirmation.
// Never connects to Supabase. Usage:
//   node scripts/test-web-atelier-finance-receipt-sql.mjs [--require-docker]

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const requireDocker = process.argv.includes('--require-docker')
const IMAGE = 'postgres:17'
const NAME = `wa-receipt-sql-test-${process.pid}`

function docker(args, options = {}) {
  return spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options })
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

const info = docker(['info', '--format', '{{.ServerVersion}}'])
if (info.error || info.status !== 0) {
  console.log('web-atelier finance-receipt SQL tests SKIPPED: Docker daemon not available')
  process.exit(requireDocker ? 2 : 0)
}

const hasImage = docker(['image', 'inspect', IMAGE])
if (hasImage.status !== 0) {
  console.log(
    `web-atelier finance-receipt SQL tests SKIPPED: local image ${IMAGE} not present (no pull is attempted)`,
  )
  process.exit(requireDocker ? 2 : 0)
}

function cleanup() {
  docker(['rm', '-f', NAME])
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
  ]

  const script = [
    '\\set ON_ERROR_STOP on',
    read('scripts/sql/web-atelier-offers.bootstrap.sql'),
    ...migrations.map((file) => `\\echo APPLY ${file}\n${read(file)}`),
    read('scripts/sql/web-atelier-tracking-materials.scenarios.sql')
      .split('ALL_TRACKING_MATERIALS_SCENARIOS_DONE')[0],
    read('scripts/sql/web-atelier-finance-receipt.scenarios.sql'),
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
    !output.includes('ALL_FINANCE_RECEIPT_SCENARIOS_DONE')
  ) {
    console.log('\n--- failures ---')
    for (const line of failures) console.log(line)
    if (failures.length === 0) console.log(output.split('\n').slice(-80).join('\n'))
    console.log(
      `\nweb-atelier finance-receipt SQL tests FAILED (${passes.length} passed before failure)`,
    )
  } else {
    console.log(`\nweb-atelier finance-receipt SQL tests passed (${passes.length} checks)`)
    exitCode = 0
  }
} catch (error) {
  console.log(
    `web-atelier finance-receipt SQL tests ERROR: ${error instanceof Error ? error.message : error}`,
  )
} finally {
  cleanup()
}
process.exit(exitCode)
