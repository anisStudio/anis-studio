/**
 * Copy Edge-shared TypeScript modules into supabase/functions/_shared
 * so `supabase functions serve` (Docker) can resolve imports without
 * mounting the repo root. Source of truth remains src/lib/*.
 *
 * Usage: node scripts/sync-edge-shared.mjs [--check]
 */
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')

const FILES = [
  'webAtelierOptions.ts',
  'webAtelierGatewayPolicy.ts',
  'webAtelierEdgeHandler.ts',
  'smartBookingGatewayPolicy.ts',
  'smartBookingEdgeHandler.ts',
]

const srcDir = join(root, 'src', 'lib')
const destDir = join(root, 'supabase', 'functions', '_shared')

function sha(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

mkdirSync(destDir, { recursive: true })

let mismatched = 0
for (const name of FILES) {
  const from = join(srcDir, name)
  const to = join(destDir, name)
  if (!existsSync(from)) {
    console.error(`missing source: src/lib/${name}`)
    process.exit(1)
  }
  if (checkOnly) {
    if (!existsSync(to) || sha(from) !== sha(to)) {
      console.error(`out of sync: ${name}`)
      mismatched += 1
    }
    continue
  }
  copyFileSync(from, to)
  console.log(`synced ${name}`)
}

if (checkOnly) {
  if (mismatched > 0) {
    console.error(`edge shared sync check failed (${mismatched} file(s)). Run: npm run edge:sync-shared`)
    process.exit(1)
  }
  console.log('edge shared sync check: OK')
  process.exit(0)
}

console.log('edge shared sync complete')
