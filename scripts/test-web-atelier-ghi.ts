// Unit tests for F2.4 G–I pure helpers + migration contract (no network).

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEPARTMENTS,
  RESERVATION_STATUSES,
  intervalsOverlap,
} from '../src/lib/departmentAvailability.ts'
import {
  COMMUNICATION_CHANNELS,
  COMMUNICATION_DIRECTIONS,
} from '../src/lib/webAtelierCommunications.ts'
import {
  FINANCIAL_DOC_KINDS,
  PAYMENT_SCHEDULE_STATUSES,
  eurosToCents,
} from '../src/lib/webAtelierFinance.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migration = readFileSync(
  join(root, 'supabase/migrations/20261017010000_f24_comms_finance_availability.sql'),
  'utf8',
)

assert.match(migration, /create table public\.web_atelier_communications/)
assert.match(migration, /create table public\.admin_communication_templates/)
assert.match(migration, /create table public\.web_atelier_payment_schedules/)
assert.match(migration, /create table public\.web_atelier_financial_documents/)
assert.match(migration, /create table public\.web_atelier_payment_records/)
assert.match(migration, /create table public\.department_availability_windows/)
assert.match(migration, /create table public\.department_reservations/)
assert.match(migration, /payment_status_paid_requires_payment_record/)
assert.match(migration, /reservation_capacity_exceeded/)
assert.match(migration, /Parra remains authoritative/)
assert.doesNotMatch(migration, /stripe/i)
assert.match(migration, /Offer acceptance does NOT create reservations/i)

assert.equal(
  intervalsOverlap(
    '2026-10-20T09:00:00Z',
    '2026-10-22T17:00:00Z',
    '2026-10-21T09:00:00Z',
    '2026-10-23T17:00:00Z',
  ),
  true,
)
assert.equal(
  intervalsOverlap(
    '2026-10-20T09:00:00Z',
    '2026-10-21T09:00:00Z',
    '2026-10-21T09:00:00Z',
    '2026-10-22T09:00:00Z',
  ),
  false,
)

assert.equal(eurosToCents('250'), 25000)
assert.equal(eurosToCents('250,50'), 25050)
assert.throws(() => eurosToCents('-1'), /Neispravan iznos/)

assert.ok(COMMUNICATION_CHANNELS.includes('email'))
assert.ok(COMMUNICATION_DIRECTIONS.includes('inbound'))
assert.ok(FINANCIAL_DOC_KINDS.includes('parra_invoice'))
assert.ok(PAYMENT_SCHEDULE_STATUSES.includes('planned'))
assert.ok(DEPARTMENTS.includes('web_atelier'))
assert.ok(DEPARTMENTS.includes('interiors'))
assert.ok(DEPARTMENTS.includes('lrc'))
assert.ok(RESERVATION_STATUSES.includes('confirmed'))

console.log('web-atelier G–I unit tests passed')
