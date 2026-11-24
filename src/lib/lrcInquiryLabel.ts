import { lrcInquiryCustomIdeaOption, sampleProducts } from '../data/products'
import { lrcStoredProductLabel, type LrcLocalizedText } from './lrcCatalog'

function legacyNames(): Record<string, LrcLocalizedText> {
  const names: Record<string, LrcLocalizedText> = {
    [lrcInquiryCustomIdeaOption.id]: {
      hr: lrcInquiryCustomIdeaOption.nameHr,
      en: lrcInquiryCustomIdeaOption.name,
    },
  }
  for (const product of sampleProducts) {
    names[product.id] = { hr: product.nameHr, en: product.name }
  }
  return names
}

/** Prikaz spremljenog upita. Ne traži trenutni katalog, pa skriveni proizvod ostaje zapisan. */
export function lrcInquiryProductLabel(stored: string, language: string): string {
  return lrcStoredProductLabel(stored, language, legacyNames())
}
