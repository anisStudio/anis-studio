/** Ani's Studio opening date (Europe/Zagreb civil calendar). */
export const STUDIO_OPENING_DATE = '2024-10-01'

export interface StudioAnniversaryInfo {
  isoDate: string
  /** 1-based ordinal: 2025-10-01 => 1, 2026-10-01 => 2 */
  ordinal: number
  labelHr: string
  labelEn: string
}

/**
 * Anniversary falls on October 1 each year from 2025 onward.
 * 2024-10-01 is the opening day (ordinal 0 / not an anniversary celebration year).
 */
export function studioAnniversaryForYear(year: number): StudioAnniversaryInfo | null {
  if (!Number.isInteger(year) || year < 2025) return null
  const ordinal = year - 2024
  if (ordinal < 1) return null
  const isoDate = `${year}-10-01`
  return {
    isoDate,
    ordinal,
    labelHr: `${ordinal}. obljetnica Ani's Studija`,
    labelEn: `${ordinal}${ordinal === 1 ? 'st' : ordinal === 2 ? 'nd' : ordinal === 3 ? 'rd' : 'th'} Ani's Studio anniversary`,
  }
}

export function isStudioAnniversaryDate(isoDate: string): boolean {
  return /^\d{4}-10-01$/.test(isoDate) && Number(isoDate.slice(0, 4)) >= 2025
}
