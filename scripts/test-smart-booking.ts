// F2.6 unit tests — pure helpers + migration contract (no network).

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { intervalsOverlap } from '../src/lib/departmentAvailability.ts'
import {
  BOOKING_KINDS,
  BOOKING_SOURCES,
  CONSULTATION_OUTCOMES,
  buildMonthCells,
  slotTouchesZagrebDate,
  zagrebYearMonth,
} from '../src/lib/smartBooking.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migration = readFileSync(
  join(root, 'supabase/migrations/20261017130000_f26_smart_booking_shared_availability.sql'),
  'utf8',
)

assert.match(migration, /create table public\.booking_shared_settings/)
assert.match(migration, /create table public\.availability_closures/)
assert.match(migration, /create table public\.reservation_reschedule_events/)
assert.match(migration, /shared_consultation_capacity/)
assert.match(migration, /public_list_consultation_availability/)
assert.match(migration, /public_book_consultation_slot/)
assert.match(migration, /admin_list_booking_calendar/)
assert.match(migration, /admin_create_availability_closure/)
assert.match(migration, /admin_create_manual_booking/)
assert.match(migration, /admin_reschedule_reservation/)
assert.match(migration, /admin_cancel_reservation_with_reason/)
assert.match(migration, /admin_set_consultation_outcome/)
assert.match(migration, /shared_consultation_capacity_exceeded/)
assert.match(migration, /booking_slot_unavailable/)
assert.match(migration, /Europe\/Zagreb/)
assert.match(migration, /info_sufficient/)
assert.doesNotMatch(migration, /stripe/i)
assert.doesNotMatch(migration, /twilio|sendgrid|resend\.com|nodemailer/i)
assert.match(migration, /Existing confirmed bookings were NOT moved/)

assert.ok(BOOKING_KINDS.includes('consultation'))
assert.ok(BOOKING_KINDS.includes('production'))
assert.ok(BOOKING_SOURCES.includes('whatsapp'))
assert.ok(CONSULTATION_OUTCOMES.includes('info_sufficient'))

const cells = buildMonthCells(2026, 3)
assert.ok(cells.length % 7 === 0)
assert.ok(cells.some((c) => c.isoDate === '2026-03-01'))
assert.ok(cells.some((c) => c.isoDate === '2026-03-31'))

// DST spring forward weekend in Europe/Zagreb (2026-03-29).
assert.equal(
  slotTouchesZagrebDate(
    '2026-03-29T08:00:00+02:00',
    '2026-03-29T12:00:00+02:00',
    '2026-03-29',
  ),
  true,
)

assert.equal(
  intervalsOverlap(
    '2026-11-02T09:00:00+01:00',
    '2026-11-02T11:00:00+01:00',
    '2026-11-02T10:00:00+01:00',
    '2026-11-02T12:00:00+01:00',
  ),
  true,
)

const ym = zagrebYearMonth(new Date('2026-10-17T12:00:00Z'))
assert.equal(typeof ym.year, 'number')
assert.equal(typeof ym.month, 'number')

console.log('smart-booking F2.6 unit tests passed')
