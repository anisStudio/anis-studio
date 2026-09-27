export const INTERIORS_WEB_PRICING_TIME_ZONE = 'Europe/Zagreb'

/** Calendar date YYYY-MM-DD in Europe/Zagreb for the given instant (default: now). */
export function getZagrebCalendarDate(referenceDate: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: INTERIORS_WEB_PRICING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(referenceDate)
}

/** Lexicographic compare for ISO calendar dates (YYYY-MM-DD). */
export function compareCalendarDates(left: string, right: string): number {
  if (left === right) return 0
  return left < right ? -1 : 1
}
