import { compareCalendarDates, getZagrebCalendarDate } from './zagrebCalendarDate.ts'

export type WebSchedulablePricingItem = {
  id: string
  public: boolean
  validFrom?: string | null
  displayOrder: number
}

export function isInteriorsItemWebVisible(
  item: WebSchedulablePricingItem,
  zagrebCalendarDate: string,
): boolean {
  if (!item.public) return false
  if (item.validFrom == null || item.validFrom === '') return true
  return compareCalendarDates(item.validFrom, zagrebCalendarDate) <= 0
}

export function filterWebVisiblePricingItems<T extends WebSchedulablePricingItem>(
  items: T[],
  zagrebCalendarDate: string,
): T[] {
  return items
    .filter((item) => isInteriorsItemWebVisible(item, zagrebCalendarDate))
    .sort((a, b) => a.displayOrder - b.displayOrder)
}

export function getWebVisiblePricingItemsForDate<T extends WebSchedulablePricingItem>(
  items: T[],
  referenceDate: Date = new Date(),
): T[] {
  return filterWebVisiblePricingItems(items, getZagrebCalendarDate(referenceDate))
}

export { getZagrebCalendarDate } from './zagrebCalendarDate.ts'
