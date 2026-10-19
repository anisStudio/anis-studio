/**
 * Admin calendar day classification regression (Smart Calendar 2.0).
 * Uses fixed "today" so horizon math is deterministic.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  adminCalendarToneClass,
  civilDayDistance,
  classifyAdminCalendarDay,
  isWithinBookingHorizon,
  isZagrebWeekday,
  zagrebIsoWeekday,
} from '../src/lib/adminAvailabilityDay.ts'
import { isCroatianPublicHoliday } from '../src/lib/croatianHolidays.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const TODAY = '2026-10-19'
const HORIZON = 90

function tone(
  isoDate: string,
  extras: Partial<Parameters<typeof classifyAdminCalendarDay>[0]> = {},
) {
  return classifyAdminCalendarDay({
    isoDate,
    hasLegacyWindow: false,
    hasReservation: false,
    hasClosure: false,
    monthCapacityFull: false,
    autoWeeklyEnabled: true,
    bookingHorizonDays: HORIZON,
    todayIso: TODAY,
    ...extras,
  })
}

assert.equal(zagrebIsoWeekday('2026-11-02'), 1) // Mon
assert.equal(zagrebIsoWeekday('2026-11-07'), 6) // Sat
assert.equal(isZagrebWeekday('2026-11-02'), true)
assert.equal(isZagrebWeekday('2026-11-07'), false)
assert.equal(isCroatianPublicHoliday('2026-11-01'), true)
assert.equal(isCroatianPublicHoliday('2026-11-18'), true)
assert.equal(isWithinBookingHorizon('2026-11-09', HORIZON, TODAY), true)
assert.equal(civilDayDistance(TODAY, '2026-11-09'), 21)

// Specific November 2026 dates (horizon from 2026-10-19)
assert.equal(tone('2026-11-02'), 'available') // Mon auto
assert.equal(tone('2026-11-09'), 'available') // Mon auto — was grey when only legacy windows painted green
assert.equal(tone('2026-11-13'), 'available') // Fri auto
assert.equal(tone('2026-11-14', { hasClosure: true }), 'closed') // closure span
assert.equal(tone('2026-11-16', { hasClosure: true }), 'closed')
assert.equal(tone('2026-11-18', { hasClosure: true }), 'closed') // holiday + closure
assert.equal(tone('2026-11-18'), 'closed') // holiday alone
assert.equal(tone('2026-11-19'), 'available') // Thu after closure
assert.equal(tone('2026-11-20'), 'available') // Fri
assert.equal(tone('2026-11-30'), 'available') // Mon within 90d

// Weekends remain neutral (not bookable under auto weekly)
assert.equal(tone('2026-11-07'), 'neutral')
assert.equal(tone('2026-11-08'), 'neutral')

// Holiday without closure
assert.equal(tone('2026-11-01'), 'closed')

// Legacy window still marks available even if auto weekly off (weekend edge via window)
assert.equal(
  tone('2026-11-07', { autoWeeklyEnabled: false, hasLegacyWindow: true }),
  'available',
)

// Outside horizon → neutral even on weekday
assert.equal(tone('2026-11-09', { todayIso: '2026-01-01', bookingHorizonDays: 30 }), 'neutral')

// Precedence: closed beats available
assert.equal(tone('2026-11-09', { hasClosure: true }), 'closed')
assert.equal(tone('2026-11-09', { monthCapacityFull: true }), 'month_full')
assert.equal(tone('2026-11-09', { hasReservation: true }), 'booked')

// Auto weekly off + no window → neutral weekday
assert.equal(tone('2026-11-09', { autoWeeklyEnabled: false }), 'neutral')

// Nov 2–6 legacy window scenario: still available with auto off when window present
for (const d of ['02', '03', '04', '05', '06']) {
  assert.equal(
    tone(`2026-11-${d}`, { autoWeeklyEnabled: false, hasLegacyWindow: true }),
    'available',
  )
}

assert.ok(adminCalendarToneClass('available').includes('emerald'))
assert.ok(adminCalendarToneClass('closed').includes('rose'))
assert.ok(adminCalendarToneClass('neutral').includes('slate'))

// Wiring: admin page uses classifier + scoped heading sizes
{
  const page = readFileSync(join(root, 'src/pages/AdminAvailabilityPage.tsx'), 'utf8')
  assert.ok(page.includes('classifyAdminCalendarDay'))
  assert.ok(page.includes('adminCalendarToneClass'))
  assert.ok(page.includes('text-sm font-semibold text-slate-900">Novi prozor dostupnosti'))
  assert.ok(page.includes('text-sm font-semibold text-slate-900">Zatvaranje'))
  assert.ok(page.includes('text-sm font-semibold text-slate-900">Prozori dostupnosti'))
  assert.ok(page.includes('Ručna rezervacija'))
  assert.ok(page.includes('auto / prozor'))
  assert.ok(page.includes('text-sm font-semibold text-slate-900'))
  assert.ok(page.includes('Predlošci komunikacije (Web Atelier)'))
  assert.ok(page.includes('selectedDate.startsWith(`${monthPrefix}-`)'))
}

console.log('admin availability day tests: OK')
