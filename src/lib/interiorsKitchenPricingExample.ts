import { formatEurFromCents, getInteriorsPricingItem, type PricingLanguage } from './interiorsPricing'

export const KITCHEN_COMPLEX_EXAMPLE_UNITS = 2
export const KITCHEN_ADVANCED_EXAMPLE_UNITS = 4

export type KitchenPricingExampleAmounts = {
  baseCents: number
  unitCents: number
  complexTotalCents: number
  advancedTotalCents: number
}

export function getKitchenPricingExampleAmounts(): KitchenPricingExampleAmounts | null {
  const kitchenPrice = getInteriorsPricingItem('interior-kitchen').price
  const unitPrice = getInteriorsPricingItem('additional-3d-complexity').price
  if (kitchenPrice.type !== 'from' || unitPrice.type !== 'unit') return null
  const baseCents = kitchenPrice.minCents
  const unitCents = unitPrice.amountCents
  return {
    baseCents,
    unitCents,
    complexTotalCents: baseCents + unitCents * KITCHEN_COMPLEX_EXAMPLE_UNITS,
    advancedTotalCents: baseCents + unitCents * KITCHEN_ADVANCED_EXAMPLE_UNITS,
  }
}

export function formatKitchenExampleAmounts(
  language: PricingLanguage,
  amounts: KitchenPricingExampleAmounts,
) {
  const advancedEur = formatEurFromCents(amounts.advancedTotalCents, language)
  return {
    base: formatEurFromCents(amounts.baseCents, language),
    unit: formatEurFromCents(amounts.unitCents, language),
    complexTotal: formatEurFromCents(amounts.complexTotalCents, language),
    advancedFrom:
      language === 'hr' ? `od ${advancedEur}` : `from ${advancedEur}`,
    advancedTotal: advancedEur,
  }
}
