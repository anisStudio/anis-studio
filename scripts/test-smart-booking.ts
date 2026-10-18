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
import {
  croatianPublicHolidays,
  easterSundayUtc,
  isCroatianPublicHoliday,
} from '../src/lib/croatianHolidays.ts'
import { studioAnniversaryForYear } from '../src/lib/studioAnniversary.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migration = readFileSync(
  join(root, 'supabase/migrations/20261017130000_f26_smart_booking_shared_availability.sql'),
  'utf8',
)
const hardening = readFileSync(
  join(root, 'supabase/migrations/20261017140000_f26_booking_turnstile_edge_hardening.sql'),
  'utf8',
)
const calendar2 = readFileSync(
  join(root, 'supabase/migrations/20261018100000_f26_smart_calendar_2.sql'),
  'utf8',
)
const clientLib = readFileSync(join(root, 'src/lib/smartBooking.ts'), 'utf8')
const settingsHook = readFileSync(join(root, 'src/hooks/useSettings.ts'), 'utf8')

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

assert.match(hardening, /revoke all on function public\.public_book_consultation_slot/)
assert.match(hardening, /to service_role/)
assert.match(hardening, /book-consultation-slot/)
assert.match(clientLib, /functions\/v1\/book-consultation-slot/)
assert.doesNotMatch(
  clientLib,
  /\.rpc\(\s*['"]public_book_consultation_slot['"]/,
)

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

assert.match(calendar2, /booking_horizon_days/)
assert.match(calendar2, /auto_weekly_enabled/)
assert.match(calendar2, /department_capacity_allocations/)
assert.match(calendar2, /booking_is_croatian_holiday/)
assert.match(calendar2, /booking_month_capacity_full/)
assert.match(calendar2, /recurrence/)
assert.match(calendar2, /f26_auto_slot/)
assert.match(calendar2, /admin_allocate_department_capacity/)
assert.doesNotMatch(calendar2, /web_atelier_public_visible\s*=\s*true/)
assert.match(clientLib, /functions\/v1\/book-consultation-slot/)
assert.match(settingsHook, /web_atelier_public_visible:\s*false/)

const easter2026 = easterSundayUtc(2026)
assert.equal(
  `${easter2026.getUTCFullYear()}-${String(easter2026.getUTCMonth() + 1).padStart(2, '0')}-${String(easter2026.getUTCDate()).padStart(2, '0')}`,
  '2026-04-05',
)
const holidays2026 = croatianPublicHolidays(2026)
assert.ok(holidays2026.includes('2026-04-05'))
assert.ok(holidays2026.includes('2026-04-06'))
assert.ok(holidays2026.includes('2026-06-04'))
assert.ok(holidays2026.includes('2026-11-18'))
assert.equal(isCroatianPublicHoliday('2026-10-02'), false)

const ann2026 = studioAnniversaryForYear(2026)
assert.ok(ann2026)
assert.equal(ann2026.ordinal, 2)
assert.equal(ann2026.isoDate, '2026-10-01')
assert.equal(studioAnniversaryForYear(2024), null)

console.log('smart-booking F2.6 unit tests passed')
