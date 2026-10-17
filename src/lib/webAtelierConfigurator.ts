/**
 * F2.5 Web Atelier public service configurator — indicative pricing only.
 * Reuses package floors from webAtelierOffers. Never a binding quote or payment.
 */

import {
  WEB_ATELIER_INFORMATIVE_PRICES_EUR,
  type WebAtelierPackageTier,
} from './webAtelierOffers.ts'

export const WEB_ATELIER_CONFIGURATOR_STORAGE_KEY = 'web-atelier-configurator-v1'
export const WEB_ATELIER_CONFIG_MARKER_START = '--- F2.5 CONFIGURATOR (INDICATIVE, NONBINDING) ---'
export const WEB_ATELIER_CONFIG_MARKER_END = '--- END F2.5 CONFIGURATOR ---'

export type ConfiguratorPackageId = WebAtelierPackageTier

export type FixedAddonId =
  | 'extra_page'
  | 'minor_revision'
  | 'ai_localization'
  | 'external_booking'
  | 'own_booking'
  | 'newsletter'
  | 'simple_functionality'
  | 'dark_light_mode'

export type EstimateAddonId = 'ai_content' | 'shop_integration' | 'new_web_shop'

export type CustomQuoteId = 'advanced_copywriting' | 'advanced_ecommerce'

export type ConfiguratorAddonId = FixedAddonId | EstimateAddonId | CustomQuoteId

export type AddonPricingKind = 'fixed' | 'estimate_from' | 'custom_quote'

export interface PackageDefinition {
  id: ConfiguratorPackageId
  fromEur: number
  pages: number
  revisions: number
  includes: readonly string[]
}

export interface AddonDefinition {
  id: ConfiguratorAddonId
  kind: AddonPricingKind
  /** Fixed unit price, or estimate floor when kind is estimate_from. Null for custom_quote. */
  unitEur: number | null
  quantityAllowed: boolean
  maxQuantity: number
  exclusiveGroup?: 'booking' | 'ecommerce_core'
}

export interface ConfiguratorSelection {
  packageId: ConfiguratorPackageId | null
  /** Quantities for quantity-capable add-ons; 0 = off. Booleans encoded as 0/1 for non-qty. */
  addons: Partial<Record<ConfiguratorAddonId, number>>
}

export interface ConfiguratorLine {
  id: string
  kind: 'package' | AddonPricingKind
  quantity: number
  unitEur: number | null
  lineEur: number | null
  customQuote: boolean
}

export interface ConfiguratorEstimate {
  selection: ConfiguratorSelection
  lines: ConfiguratorLine[]
  /** Sum of fixed package + fixed add-ons only (EUR). */
  fixedTotalEur: number
  /** fixedTotal + estimate floors (EUR). Null when nothing priced. */
  estimateFloorEur: number | null
  hasCustomQuote: boolean
  hasEstimateOnly: boolean
  /** Soft exclusions applied while computing (ids dropped or zeroed). */
  exclusionsApplied: string[]
  /** True when new_web_shop replaces base package price. */
  packageSupersededByEcommerce: boolean
}

export const WEB_ATELIER_PACKAGE_DEFINITIONS: readonly PackageDefinition[] = [
  {
    id: 'start',
    fromEur: WEB_ATELIER_INFORMATIVE_PRICES_EUR.start,
    pages: 1,
    revisions: 1,
    includes: ['one_page', 'one_revision'],
  },
  {
    id: 'pro',
    fromEur: WEB_ATELIER_INFORMATIVE_PRICES_EUR.pro,
    pages: 5,
    revisions: 2,
    includes: ['up_to_5_pages', 'two_revisions'],
  },
  {
    id: 'premium',
    fromEur: WEB_ATELIER_INFORMATIVE_PRICES_EUR.premium,
    pages: 7,
    revisions: 3,
    includes: ['up_to_7_pages', 'mini_branding', 'priority_support_30d', 'three_revisions'],
  },
] as const

export const WEB_ATELIER_ADDON_DEFINITIONS: readonly AddonDefinition[] = [
  { id: 'extra_page', kind: 'fixed', unitEur: 60, quantityAllowed: true, maxQuantity: 20 },
  { id: 'minor_revision', kind: 'fixed', unitEur: 40, quantityAllowed: true, maxQuantity: 10 },
  { id: 'ai_localization', kind: 'fixed', unitEur: 100, quantityAllowed: false, maxQuantity: 1 },
  {
    id: 'external_booking',
    kind: 'fixed',
    unitEur: 100,
    quantityAllowed: false,
    maxQuantity: 1,
    exclusiveGroup: 'booking',
  },
  {
    id: 'own_booking',
    kind: 'fixed',
    unitEur: 300,
    quantityAllowed: false,
    maxQuantity: 1,
    exclusiveGroup: 'booking',
  },
  { id: 'newsletter', kind: 'fixed', unitEur: 80, quantityAllowed: false, maxQuantity: 1 },
  { id: 'simple_functionality', kind: 'fixed', unitEur: 50, quantityAllowed: false, maxQuantity: 1 },
  { id: 'dark_light_mode', kind: 'fixed', unitEur: 100, quantityAllowed: false, maxQuantity: 1 },
  { id: 'ai_content', kind: 'estimate_from', unitEur: 80, quantityAllowed: false, maxQuantity: 1 },
  {
    id: 'shop_integration',
    kind: 'estimate_from',
    unitEur: 1000,
    quantityAllowed: false,
    maxQuantity: 1,
    exclusiveGroup: 'ecommerce_core',
  },
  {
    id: 'new_web_shop',
    kind: 'estimate_from',
    unitEur: 1500,
    quantityAllowed: false,
    maxQuantity: 1,
    exclusiveGroup: 'ecommerce_core',
  },
  { id: 'advanced_copywriting', kind: 'custom_quote', unitEur: null, quantityAllowed: false, maxQuantity: 1 },
  {
    id: 'advanced_ecommerce',
    kind: 'custom_quote',
    unitEur: null,
    quantityAllowed: false,
    maxQuantity: 1,
  },
] as const

const PACKAGE_BY_ID = Object.fromEntries(
  WEB_ATELIER_PACKAGE_DEFINITIONS.map((item) => [item.id, item]),
) as Record<ConfiguratorPackageId, PackageDefinition>

const ADDON_BY_ID = Object.fromEntries(
  WEB_ATELIER_ADDON_DEFINITIONS.map((item) => [item.id, item]),
) as Record<ConfiguratorAddonId, AddonDefinition>

export function emptyConfiguratorSelection(): ConfiguratorSelection {
  return { packageId: null, addons: {} }
}

export function clampAddonQuantity(id: ConfiguratorAddonId, raw: number): number {
  const def = ADDON_BY_ID[id]
  if (!def) return 0
  if (!Number.isFinite(raw)) return 0
  const n = Math.floor(raw)
  if (n <= 0) return 0
  return Math.min(n, def.maxQuantity)
}

/**
 * Normalize selection: clamp quantities, enforce exclusive groups
 * (last-enabled wins within a group when both present).
 */
export function normalizeConfiguratorSelection(input: ConfiguratorSelection): ConfiguratorSelection {
  const packageId =
    input.packageId === 'start' || input.packageId === 'pro' || input.packageId === 'premium'
      ? input.packageId
      : null

  const addons: Partial<Record<ConfiguratorAddonId, number>> = {}
  for (const def of WEB_ATELIER_ADDON_DEFINITIONS) {
    const qty = clampAddonQuantity(def.id, Number(input.addons[def.id] ?? 0))
    if (qty > 0) addons[def.id] = qty
  }

  const exclusions: string[] = []
  applyExclusiveGroup(addons, 'booking', ['external_booking', 'own_booking'], exclusions)
  applyExclusiveGroup(
    addons,
    'ecommerce_core',
    ['shop_integration', 'new_web_shop'],
    exclusions,
  )

  // Advanced ecommerce quote supersedes priced shop lines (no double shop quote).
  if ((addons.advanced_ecommerce ?? 0) > 0) {
    if ((addons.shop_integration ?? 0) > 0) {
      delete addons.shop_integration
      exclusions.push('shop_integration_vs_advanced_ecommerce')
    }
    if ((addons.new_web_shop ?? 0) > 0) {
      delete addons.new_web_shop
      exclusions.push('new_web_shop_vs_advanced_ecommerce')
    }
  }

  return { packageId, addons }
}

function applyExclusiveGroup(
  addons: Partial<Record<ConfiguratorAddonId, number>>,
  _group: string,
  ids: ConfiguratorAddonId[],
  exclusions: string[],
): void {
  const active = ids.filter((id) => (addons[id] ?? 0) > 0)
  if (active.length <= 1) return
  // Keep the last id in the definition order among actives (own_booking / new_web_shop win).
  const keep = active[active.length - 1]
  for (const id of active) {
    if (id !== keep) {
      delete addons[id]
      exclusions.push(`${id}_vs_${keep}`)
    }
  }
}

export function calculateConfiguratorEstimate(raw: ConfiguratorSelection): ConfiguratorEstimate {
  const selection = normalizeConfiguratorSelection(raw)
  const exclusionsApplied: string[] = []
  // Re-run exclusive detection for reporting (normalize already dropped conflicts).
  const probe = { ...raw.addons }
  if ((Number(probe.external_booking) || 0) > 0 && (Number(probe.own_booking) || 0) > 0) {
    exclusionsApplied.push('external_booking_vs_own_booking')
  }
  if ((Number(probe.shop_integration) || 0) > 0 && (Number(probe.new_web_shop) || 0) > 0) {
    exclusionsApplied.push('shop_integration_vs_new_web_shop')
  }
  if ((Number(probe.advanced_ecommerce) || 0) > 0) {
    if ((Number(probe.shop_integration) || 0) > 0) exclusionsApplied.push('shop_integration_vs_advanced_ecommerce')
    if ((Number(probe.new_web_shop) || 0) > 0) exclusionsApplied.push('new_web_shop_vs_advanced_ecommerce')
  }

  const lines: ConfiguratorLine[] = []
  let fixedTotalEur = 0
  let estimateFloorEur = 0
  let hasEstimateOnly = false
  let hasCustomQuote = false

  const packageSupersededByEcommerce = (selection.addons.new_web_shop ?? 0) > 0

  if (selection.packageId && !packageSupersededByEcommerce) {
    const pkg = PACKAGE_BY_ID[selection.packageId]
    lines.push({
      id: `package:${pkg.id}`,
      kind: 'package',
      quantity: 1,
      unitEur: pkg.fromEur,
      lineEur: pkg.fromEur,
      customQuote: false,
    })
    fixedTotalEur += pkg.fromEur
    estimateFloorEur += pkg.fromEur
  } else if (selection.packageId && packageSupersededByEcommerce) {
    exclusionsApplied.push('package_superseded_by_new_web_shop')
  }

  for (const def of WEB_ATELIER_ADDON_DEFINITIONS) {
    const quantity = selection.addons[def.id] ?? 0
    if (quantity <= 0) continue

    if (def.kind === 'fixed' && def.unitEur != null) {
      const lineEur = def.unitEur * quantity
      lines.push({
        id: def.id,
        kind: 'fixed',
        quantity,
        unitEur: def.unitEur,
        lineEur,
        customQuote: false,
      })
      fixedTotalEur += lineEur
      estimateFloorEur += lineEur
      continue
    }

    if (def.kind === 'estimate_from' && def.unitEur != null) {
      lines.push({
        id: def.id,
        kind: 'estimate_from',
        quantity,
        unitEur: def.unitEur,
        lineEur: def.unitEur * quantity,
        customQuote: false,
      })
      estimateFloorEur += def.unitEur * quantity
      hasEstimateOnly = true
      continue
    }

    lines.push({
      id: def.id,
      kind: 'custom_quote',
      quantity,
      unitEur: null,
      lineEur: null,
      customQuote: true,
    })
    hasCustomQuote = true
  }

  const hasAnyPriced = lines.some((line) => line.lineEur != null && line.lineEur > 0)

  return {
    selection,
    lines,
    fixedTotalEur,
    estimateFloorEur: hasAnyPriced ? estimateFloorEur : null,
    hasCustomQuote,
    hasEstimateOnly,
    exclusionsApplied: [...new Set(exclusionsApplied)],
    packageSupersededByEcommerce,
  }
}

export function formatEur(amount: number, language: 'hr' | 'en'): string {
  const rounded = Math.round(amount)
  if (language === 'hr') return `${rounded} EUR`
  return `EUR ${rounded}`
}

export function formatConfiguratorSummary(
  estimate: ConfiguratorEstimate,
  language: 'hr' | 'en',
): string {
  const lines: string[] = [WEB_ATELIER_CONFIG_MARKER_START]
  lines.push(
    language === 'hr'
      ? 'Izračun je informativan, neobvezujući i podložan ručnoj provjeri. Nije ponuda ni narudžba.'
      : 'Estimate is indicative, nonbinding, and subject to manual review. Not an offer or order.',
  )

  const pkg = estimate.selection.packageId
  if (pkg) {
    const def = PACKAGE_BY_ID[pkg]
    const label = pkg.toUpperCase()
    if (estimate.packageSupersededByEcommerce) {
      lines.push(
        language === 'hr'
          ? `Paket (opseg, bez zbrajanja cijene): ${label} — uključeno u procjenu „Nova web + shop”.`
          : `Package (scope only, price not stacked): ${label} — covered by “New web + shop” estimate.`,
      )
    } else {
      lines.push(
        language === 'hr'
          ? `Paket: ${label} — od ${formatEur(def.fromEur, language)} (${def.pages} stranica, ${def.revisions} revizija).`
          : `Package: ${label} — from ${formatEur(def.fromEur, language)} (${def.pages} pages, ${def.revisions} revisions).`,
      )
    }
  } else {
    lines.push(language === 'hr' ? 'Paket: nije odabran.' : 'Package: not selected.')
  }

  const addonLines = estimate.lines.filter((line) => line.kind !== 'package')
  if (addonLines.length === 0) {
    lines.push(language === 'hr' ? 'Dodaci: nema.' : 'Add-ons: none.')
  } else {
    lines.push(language === 'hr' ? 'Dodaci / opcije:' : 'Add-ons / options:')
    for (const line of addonLines) {
      lines.push(`- ${describeLine(line, language)}`)
    }
  }

  if (estimate.fixedTotalEur > 0) {
    lines.push(
      language === 'hr'
        ? `Fiksni zbroj (paket + fiksni dodaci): ${formatEur(estimate.fixedTotalEur, language)}`
        : `Fixed subtotal (package + fixed add-ons): ${formatEur(estimate.fixedTotalEur, language)}`,
    )
  }

  if (estimate.estimateFloorEur != null) {
    lines.push(
      language === 'hr'
        ? `Informativna procjena (od): ${formatEur(estimate.estimateFloorEur, language)}`
        : `Indicative estimate (from): ${formatEur(estimate.estimateFloorEur, language)}`,
    )
  }

  if (estimate.hasCustomQuote) {
    lines.push(
      language === 'hr'
        ? 'Uključene stavke s individualnom ponudom — cijena se dogovara nakon pregleda.'
        : 'Includes custom-quote items — price agreed after review.',
    )
  }

  if (estimate.exclusionsApplied.length > 0) {
    lines.push(
      language === 'hr'
        ? `Primijenjena pravila isključenja: ${estimate.exclusionsApplied.join(', ')}`
        : `Exclusions applied: ${estimate.exclusionsApplied.join(', ')}`,
    )
  }

  lines.push(WEB_ATELIER_CONFIG_MARKER_END)
  return lines.join('\n')
}

function describeLine(line: ConfiguratorLine, language: 'hr' | 'en'): string {
  const label = addonLabel(line.id as ConfiguratorAddonId, language)
  if (line.customQuote || line.kind === 'custom_quote') {
    return language === 'hr' ? `${label}: individualna ponuda` : `${label}: custom quote`
  }
  if (line.kind === 'estimate_from' && line.unitEur != null) {
    const qty = line.quantity > 1 ? ` × ${line.quantity}` : ''
    return language === 'hr'
      ? `${label}${qty}: od ${formatEur(line.unitEur * line.quantity, language)}`
      : `${label}${qty}: from ${formatEur(line.unitEur * line.quantity, language)}`
  }
  if (line.lineEur != null && line.unitEur != null) {
    const qty = line.quantity > 1 ? ` × ${line.quantity}` : ''
    return `${label}${qty}: ${formatEur(line.lineEur, language)}`
  }
  return label
}

export function addonLabel(id: ConfiguratorAddonId, language: 'hr' | 'en'): string {
  const labels: Record<ConfiguratorAddonId, { hr: string; en: string }> = {
    extra_page: { hr: 'Dodatna stranica', en: 'Extra page' },
    minor_revision: { hr: 'Manja dodatna revizija', en: 'Minor additional revision' },
    ai_localization: { hr: 'AI lokalizacija', en: 'AI localization' },
    external_booking: { hr: 'Integracija vanjskog bookinga', en: 'External booking integration' },
    own_booking: { hr: 'Vlastiti booking sustav', en: 'Own booking system' },
    newsletter: { hr: 'Newsletter', en: 'Newsletter' },
    simple_functionality: { hr: 'Jednostavna funkcionalnost', en: 'Simple functionality' },
    dark_light_mode: { hr: 'Dark/light način', en: 'Dark/light mode' },
    ai_content: { hr: 'AI sadržaj', en: 'AI content' },
    shop_integration: { hr: 'Integracija trgovine', en: 'Shop integration' },
    new_web_shop: {
      hr: 'Nova web + shop (do 30 standardnih proizvoda)',
      en: 'New web + shop (up to 30 standard products)',
    },
    advanced_copywriting: { hr: 'Napredni copywriting', en: 'Advanced copywriting' },
    advanced_ecommerce: { hr: 'Napredni e-commerce zahtjevi', en: 'Advanced ecommerce requirements' },
  }
  return labels[id][language]
}

export function packageLabel(id: ConfiguratorPackageId, language: 'hr' | 'en'): string {
  const names = { start: 'START', pro: 'PRO', premium: 'PREMIUM' } as const
  const name = names[id]
  const def = PACKAGE_BY_ID[id]
  return language === 'hr'
    ? `${name} — od ${formatEur(def.fromEur, language)}`
    : `${name} — from ${formatEur(def.fromEur, language)}`
}

/** Suggested inquiry budget band from indicative floor (soft hint only). */
export function suggestBudgetRange(
  estimateFloorEur: number | null,
): 'under-1000' | '1000-3000' | '3000-7000' | '7000+' | '' {
  if (estimateFloorEur == null || estimateFloorEur <= 0) return ''
  if (estimateFloorEur < 1000) return 'under-1000'
  if (estimateFloorEur < 3000) return '1000-3000'
  if (estimateFloorEur < 7000) return '3000-7000'
  return '7000+'
}

/** Map configurator choices onto existing inquiry feature option labels. */
export function featuresFromConfigurator(selection: ConfiguratorSelection): string[] {
  const features: string[] = []
  const add = (label: string) => {
    if (!features.includes(label)) features.push(label)
  }
  if ((selection.addons.newsletter ?? 0) > 0) {
    add('Integracija s newsletterom (Mailchimp, sl.)')
  }
  if ((selection.addons.external_booking ?? 0) > 0 || (selection.addons.own_booking ?? 0) > 0) {
    add('Sustav za rezervacije (kalendar, termini)')
  }
  if (
    (selection.addons.shop_integration ?? 0) > 0 ||
    (selection.addons.new_web_shop ?? 0) > 0 ||
    (selection.addons.advanced_ecommerce ?? 0) > 0
  ) {
    add('Web shop (košarica, naplata)')
  }
  if ((selection.addons.ai_localization ?? 0) > 0) {
    add('Višejezičnost (npr. HR/EN)')
  }
  return features
}

export function projectTypesFromConfigurator(selection: ConfiguratorSelection): string[] {
  const types: string[] = []
  if ((selection.addons.new_web_shop ?? 0) > 0 || (selection.addons.shop_integration ?? 0) > 0) {
    types.push('Web shop')
  }
  if ((selection.addons.external_booking ?? 0) > 0 || (selection.addons.own_booking ?? 0) > 0) {
    types.push('Sustav za rezervacije / termine')
  }
  if (selection.packageId && types.length === 0) {
    types.push('Nova web stranica od nule')
  }
  return types
}

export function mergeConfiguratorIntoFeaturesNotes(
  existing: string,
  summary: string,
): string {
  const trimmed = existing.trim()
  if (!trimmed) return summary
  if (trimmed.includes(WEB_ATELIER_CONFIG_MARKER_START)) {
    const before = trimmed.slice(0, trimmed.indexOf(WEB_ATELIER_CONFIG_MARKER_START)).trimEnd()
    const endIdx = trimmed.indexOf(WEB_ATELIER_CONFIG_MARKER_END)
    const after =
      endIdx >= 0
        ? trimmed.slice(endIdx + WEB_ATELIER_CONFIG_MARKER_END.length).trimStart()
        : ''
    return [before, summary, after].filter(Boolean).join('\n\n')
  }
  return `${summary}\n\n${trimmed}`
}

export function serializeConfiguratorSelection(selection: ConfiguratorSelection): string {
  return JSON.stringify(normalizeConfiguratorSelection(selection))
}

export function parseConfiguratorSelection(raw: unknown): ConfiguratorSelection | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as { packageId?: unknown; addons?: unknown }
  const packageId =
    obj.packageId === 'start' || obj.packageId === 'pro' || obj.packageId === 'premium'
      ? obj.packageId
      : null
  const addons: Partial<Record<ConfiguratorAddonId, number>> = {}
  if (obj.addons && typeof obj.addons === 'object') {
    for (const def of WEB_ATELIER_ADDON_DEFINITIONS) {
      const value = (obj.addons as Record<string, unknown>)[def.id]
      if (typeof value === 'number') {
        const qty = clampAddonQuantity(def.id, value)
        if (qty > 0) addons[def.id] = qty
      }
    }
  }
  return normalizeConfiguratorSelection({ packageId, addons })
}

export function readStoredConfiguratorSelection(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): ConfiguratorSelection | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(WEB_ATELIER_CONFIGURATOR_STORAGE_KEY)
    if (!raw) return null
    return parseConfiguratorSelection(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeStoredConfiguratorSelection(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null | undefined,
  selection: ConfiguratorSelection | null,
): void {
  if (!storage) return
  if (!selection || (!selection.packageId && Object.keys(selection.addons).length === 0)) {
    storage.removeItem(WEB_ATELIER_CONFIGURATOR_STORAGE_KEY)
    return
  }
  storage.setItem(WEB_ATELIER_CONFIGURATOR_STORAGE_KEY, serializeConfiguratorSelection(selection))
}

/**
 * Build inquiry field patches from a configurator selection.
 * Uses existing contract fields only: packagePreference, featuresNotes, features, projectTypes, budgetRange.
 */
export function inquiryPatchesFromConfigurator(
  selection: ConfiguratorSelection,
  language: 'hr' | 'en',
  existingFeaturesNotes = '',
): {
  packagePreference: ConfiguratorPackageId | ''
  featuresNotes: string
  features: string[]
  projectTypes: string[]
  budgetRange: 'under-1000' | '1000-3000' | '3000-7000' | '7000+' | ''
  estimate: ConfiguratorEstimate
  summary: string
} {
  const estimate = calculateConfiguratorEstimate(selection)
  const summary = formatConfiguratorSummary(estimate, language)
  return {
    packagePreference: estimate.selection.packageId ?? '',
    featuresNotes: mergeConfiguratorIntoFeaturesNotes(existingFeaturesNotes, summary),
    features: featuresFromConfigurator(estimate.selection),
    projectTypes: projectTypesFromConfigurator(estimate.selection),
    budgetRange: suggestBudgetRange(estimate.estimateFloorEur),
    estimate,
    summary,
  }
}
