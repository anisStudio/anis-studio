/**
 * Admin calendar day classification for Smart Calendar 2.0.
 * Aligns admin "available" tone with public auto-weekly + legacy-window semantics
 * without inventing DB availability rows.
 */

import { isCroatianPublicHoliday } from './croatianHolidays.ts'

export type AdminCalendarDayTone =
  | 'closed'
  | 'month_full'
  | 'booked'
  | 'available'
  | 'neutral'

const ZAGREB_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Zagreb',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const ZAGREB_WEEKDAY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Zagreb',
  weekday: 'short',
})

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
}

export function zagrebIsoDate(reference: Date = new Date()): string {
  return ZAGREB_DATE.format(reference)
}

/** ISO weekday 1=Mon … 7=Sun in Europe/Zagreb for a YYYY-MM-DD civil date. */
export function zagrebIsoWeekday(isoDate: string): number {
  // Noon UTC keeps the civil date stable for Croatia (CET/CEST).
  const label = ZAGREB_WEEKDAY.format(new Date(`${isoDate}T12:00:00.000Z`))
  const n = WEEKDAY_TO_ISO[label]
  if (!n) throw new Error(`weekday_unresolved:${isoDate}:${label}`)
  return n
}

export function isZagrebWeekday(isoDate: string): boolean {
  const dow = zagrebIsoWeekday(isoDate)
  return dow >= 1 && dow <= 5
}

/** Inclusive day distance from fromIso to toIso (civil YYYY-MM-DD). */
export function civilDayDistance(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00.000Z`)
  const b = Date.parse(`${toIso}T00:00:00.000Z`)
  return Math.round((b - a) / 86_400_000)
}

export function isWithinBookingHorizon(
  isoDate: string,
  horizonDays: number,
  todayIso: string = zagrebIsoDate(),
): boolean {
  if (!Number.isFinite(horizonDays) || horizonDays < 0) return false
  const delta = civilDayDistance(todayIso, isoDate)
  return delta >= 0 && delta <= horizonDays
}

export interface ClassifyAdminCalendarDayInput {
  isoDate: string
  /** Legacy manual window touches this Zagreb day. */
  hasLegacyWindow: boolean
  hasReservation: boolean
  hasClosure: boolean
  monthCapacityFull: boolean
  autoWeeklyEnabled: boolean
  bookingHorizonDays: number
  /** Override "today" for deterministic tests (YYYY-MM-DD Zagreb). */
  todayIso?: string
}

/**
 * Precedence matches existing admin cell styling:
 * closed > month_full > booked > available > neutral
 *
 * "available" = bookable consultation day under SC2 rules:
 * Mon–Fri, not holiday, not closed, within horizon, and
 * (auto weekly enabled OR legacy window present).
 */
export function classifyAdminCalendarDay(input: ClassifyAdminCalendarDayInput): AdminCalendarDayTone {
  const {
    isoDate,
    hasLegacyWindow,
    hasReservation,
    hasClosure,
    monthCapacityFull,
    autoWeeklyEnabled,
    bookingHorizonDays,
    todayIso = zagrebIsoDate(),
  } = input

  const holiday = isCroatianPublicHoliday(isoDate)
  if (hasClosure || holiday) return 'closed'
  if (monthCapacityFull) return 'month_full'
  if (hasReservation) return 'booked'

  const inHorizon = isWithinBookingHorizon(isoDate, bookingHorizonDays, todayIso)
  if (!inHorizon) return 'neutral'

  const weekday = isZagrebWeekday(isoDate)
  if (autoWeeklyEnabled && weekday) return 'available'
  if (hasLegacyWindow) return 'available'
  return 'neutral'
}

export function adminCalendarToneClass(tone: AdminCalendarDayTone): string {
  switch (tone) {
    case 'closed':
      return 'bg-rose-50'
    case 'month_full':
      return 'bg-amber-50'
    case 'booked':
      return 'bg-violet-50'
    case 'available':
      return 'bg-emerald-50'
    default:
      return 'bg-slate-50'
  }
}
