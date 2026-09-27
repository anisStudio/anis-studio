import pricingSource from '../data/interiorsPricing.json'
import { getWebVisiblePricingItemsForDate } from './interiorsPricingWeb'

export type PricingLanguage = 'hr' | 'en'
export type PricingCategory = 'base' | 'additional' | 'included' | 'discount'

export type InteriorsPrice =
  | { type: 'from'; minCents: number }
  | { type: 'fixed'; amountCents: number }
  | { type: 'unit'; amountCents: number; appliesTo: string[] }
  | { type: 'range'; minCents: number; maxCents: number }
  | { type: 'quote' }
  | {
      type: 'discount'
      percent: number
      minimumRooms: number
      appliesTo: string[]
      excludes: string[]
    }
  | { type: 'included'; quantity: number; appliesTo: string[] }

type LocalizedText = {
  hr: string
  en: string
}

export interface InteriorsPricingItem {
  id: string
  name: LocalizedText
  description?: LocalizedText
  price: InteriorsPrice
  basis: LocalizedText & { code: string }
  calculationNotes?: LocalizedText
  introducedAt: string | null
  /** First calendar day (Europe/Zagreb) the item may appear on the web price list. */
  validFrom?: string | null
  displayOrder: number
  public: boolean
  category: PricingCategory
  specialSale?: {
    applicable: boolean
    label: LocalizedText
  }
  reference?: {
    amountCents: number
    date: string
    label?: LocalizedText
  }
}

export interface InteriorsPricingDocument {
  schemaVersion: number
  publicationStatus: 'draft' | 'public-ready'
  version: string | null
  validFrom: string | null
  publishedAt: string | null
  publication: {
    sequence: number | null
    filename: {
      serviceObjectTypeToken: string | null
    }
  }
  regulatoryMappings: {
    kitchenReferencePriceTreatment: {
      status: 'unresolved' | 'resolved'
      resolutionCode: string | null
    }
  }
  issuer: {
    name: string
    department: string
    addressLine: string
    postalCode: string
    city: string
    country: string
    domain: string
    businessPremisesCode: string
  }
  currency: 'EUR'
  items: InteriorsPricingItem[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsePricingDocument(value: unknown): InteriorsPricingDocument {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.items)) {
    throw new Error('[Interiors pricing] Nevaljan centralni izvor cjenika.')
  }
  if (value.currency !== 'EUR') {
    throw new Error('[Interiors pricing] Trenutno je podržana samo valuta EUR.')
  }
  if (value.publicationStatus !== 'draft' && value.publicationStatus !== 'public-ready') {
    throw new Error('[Interiors pricing] Nevaljan publicationStatus.')
  }

  return value as unknown as InteriorsPricingDocument
}

export const interiorsPricing = parsePricingDocument(pricingSource)

/**
 * Regulatory CSV channel (`publicationStatus` on the document root) is separate from web presentation.
 * Parra Cjenici are the official regulatory channel while this JSON feeds the human-readable `/cjenici/interijeri` page.
 */
export const isOwnRegulatoryCsvPublicationReady =
  interiorsPricing.publicationStatus === 'public-ready'

export { isInteriorsItemWebVisible } from './interiorsPricingWeb'

export function getWebVisibleInteriorsPricingItems(
  referenceDate: Date = new Date(),
): InteriorsPricingItem[] {
  return getWebVisiblePricingItemsForDate(interiorsPricing.items, referenceDate)
}

/** All items marked `public` in source data (ignores web `validFrom` scheduling). */
export const publicInteriorsPricingItems = interiorsPricing.items
  .filter((item) => item.public)
  .sort((a, b) => a.displayOrder - b.displayOrder)

export function getInteriorsPricingItem(id: string): InteriorsPricingItem {
  const item = interiorsPricing.items.find((candidate) => candidate.id === id)
  if (!item) {
    throw new Error(`[Interiors pricing] Nepoznata stavka: ${id}`)
  }
  return item
}

function formatDecimalFromCents(cents: number, language: PricingLanguage): string {
  const hasDecimals = cents % 100 !== 0
  return new Intl.NumberFormat(language === 'hr' ? 'hr-HR' : 'en-IE', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function formatEurFromCents(cents: number, language: PricingLanguage): string {
  const amount = formatDecimalFromCents(cents, language)
  return language === 'hr' ? `${amount} €` : `€${amount}`
}

export function formatInteriorsPrice(
  price: InteriorsPrice,
  language: PricingLanguage,
): string {
  switch (price.type) {
    case 'from':
      return language === 'hr'
        ? `od ${formatEurFromCents(price.minCents, language)}`
        : `from ${formatEurFromCents(price.minCents, language)}`
    case 'fixed':
      return formatEurFromCents(price.amountCents, language)
    case 'unit':
      return language === 'hr'
        ? `${formatEurFromCents(price.amountCents, language)} / obračunska jedinica`
        : `${formatEurFromCents(price.amountCents, language)} / billing unit`
    case 'range': {
      const min = formatDecimalFromCents(price.minCents, language)
      const max = formatDecimalFromCents(price.maxCents, language)
      return language === 'hr' ? `${min}–${max} €` : `€${min}–€${max}`
    }
    case 'quote':
      return language === 'hr' ? 'prema opsegu' : 'based on scope'
    case 'discount':
      return language === 'hr'
        ? `${price.percent} % popusta`
        : `${price.percent}% discount`
    case 'included':
      return language === 'hr'
        ? 'Uključeno u osnovnu cijenu'
        : 'Included in the base price'
  }
}

export function formatInteriorsPriceById(
  id: string,
  language: PricingLanguage,
): string {
  return formatInteriorsPrice(getInteriorsPricingItem(id).price, language)
}

export { getZagrebCalendarDate } from './interiorsPricingWeb'
