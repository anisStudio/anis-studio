/**
 * Deterministic Croatian public / statutory non-working holidays.
 * Used by admin/public calendars; SQL migration mirrors the same rules.
 *
 * Includes movable Easter Sunday + Easter Monday + Corpus Christi.
 * Does not invent substitute weekdays beyond statutory holiday dates.
 */

export function easterSundayUtc(year: number): Date {
  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher)
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

function isoDateUtc(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addUtcDays(d: Date, days: number): Date {
  const next = new Date(d.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

/** Fixed-date Croatian holidays (month/day), excluding movable. */
const FIXED: ReadonlyArray<readonly [number, number]> = [
  [1, 1], // Nova godina
  [1, 6], // Sveta tri kralja
  [5, 1], // Praznik rada
  [5, 30], // Dan državnosti
  [6, 22], // Dan antifašističke borbe
  [8, 5], // Dan pobjede i domovinske zahvalnosti
  [8, 15], // Velika Gospa
  [11, 1], // Svi sveti
  [11, 18], // Dan sjećanja na žrtve Domovinskog rata
  [12, 25], // Božić
  [12, 26], // Sveti Stjepan
]

/**
 * All Croatian non-working public holiday dates for a civil year (YYYY-MM-DD).
 * Sorted ascending, unique.
 */
export function croatianPublicHolidays(year: number): string[] {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw new RangeError('year out of range')
  }
  const set = new Set<string>()
  for (const [month, day] of FIXED) {
    set.add(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  const easter = easterSundayUtc(year)
  set.add(isoDateUtc(easter))
  set.add(isoDateUtc(addUtcDays(easter, 1))) // Easter Monday
  set.add(isoDateUtc(addUtcDays(easter, 60))) // Corpus Christi
  return [...set].sort()
}

export function isCroatianPublicHoliday(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false
  const year = Number(isoDate.slice(0, 4))
  return croatianPublicHolidays(year).includes(isoDate)
}
