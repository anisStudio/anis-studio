/**
 * F2.9 Web Atelier pricing integrity helpers.
 * Catalog inventory + deterministic EUR↔cents checks.
 * Does not invent or change commercial prices — only verifies consistency
 * of already-declared repository values.
 */

import {
  WEB_ATELIER_ADDON_DEFINITIONS,
  WEB_ATELIER_PACKAGE_DEFINITIONS,
  type AddonPricingKind,
  type ConfiguratorAddonId,
  type ConfiguratorPackageId,
} from './webAtelierConfigurator.ts'
import {
  WEB_ATELIER_INFORMATIVE_PRICES_CENTS,
  WEB_ATELIER_INFORMATIVE_PRICES_EUR,
  eurosToCents,
  type WebAtelierPackageTier,
} from './webAtelierOffers.ts'

export type PricingAuthority =
  | 'informative_package_floor'
  | 'configurator_addon_catalog'
  | 'admin_offer_line_items'
  | 'accepted_offer_snapshot'

export interface PricingInventoryRow {
  id: string
  label: string
  kind: 'package_floor' | AddonPricingKind | 'note'
  unitEur: number | null
  unitCents: number | null
  authority: PricingAuthority
  sourceFile: string
  notes: string
}

/** Whole-euro catalog amounts → integer cents (deterministic, no float drift). */
export function catalogEurToCents(eur: number): number {
  if (!Number.isFinite(eur) || eur < 0) {
    throw new Error('invalid_catalog_eur')
  }
  if (!Number.isInteger(eur)) {
    // Catalog must stay whole euros until business approves fractional list prices.
    throw new Error('catalog_eur_must_be_integer')
  }
  return eurosToCents(eur)
}

export function centsToWholeEur(cents: number): number {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error('invalid_cents')
  }
  if (cents % 100 !== 0) {
    // Display helpers may still format fractional cents for offers;
    // integrity path for whole-euro catalog only.
    return cents / 100
  }
  return cents / 100
}

export function buildWebAtelierPricingInventory(): PricingInventoryRow[] {
  const rows: PricingInventoryRow[] = []

  for (const pkg of WEB_ATELIER_PACKAGE_DEFINITIONS) {
    rows.push({
      id: `package:${pkg.id}`,
      label: `Package ${pkg.id.toUpperCase()} floor`,
      kind: 'package_floor',
      unitEur: pkg.fromEur,
      unitCents: catalogEurToCents(pkg.fromEur),
      authority: 'informative_package_floor',
      sourceFile: 'src/lib/webAtelierOffers.ts → WEB_ATELIER_INFORMATIVE_PRICES_*',
      notes: 'Informative floor only. Formal offer uses admin line items.',
    })
  }

  for (const addon of WEB_ATELIER_ADDON_DEFINITIONS) {
    rows.push({
      id: `addon:${addon.id}`,
      label: addon.id,
      kind: addon.kind,
      unitEur: addon.unitEur,
      unitCents: addon.unitEur == null ? null : catalogEurToCents(addon.unitEur),
      authority: 'configurator_addon_catalog',
      sourceFile: 'src/lib/webAtelierConfigurator.ts → WEB_ATELIER_ADDON_DEFINITIONS',
      notes:
        addon.kind === 'custom_quote'
          ? 'No numeric price — individual quote after review.'
          : addon.kind === 'estimate_from'
            ? 'Estimate floor (“od”); not a fixed contractual amount.'
            : 'Fixed indicative unit in configurator estimate.',
    })
  }

  rows.push({
    id: 'note:formal_offer',
    label: 'Formal quotation lines',
    kind: 'note',
    unitEur: null,
    unitCents: null,
    authority: 'admin_offer_line_items',
    sourceFile: 'web_atelier_offer_items (DB) + admin UI',
    notes: 'Authoritative commercial amounts after admin draft/issue. Integer euro cents.',
  })

  rows.push({
    id: 'note:accepted_snapshot',
    label: 'Accepted offer snapshot / project agreed_total',
    kind: 'note',
    unitEur: null,
    unitCents: null,
    authority: 'accepted_offer_snapshot',
    sourceFile: 'web_atelier_offers.snapshot_* + web_atelier_projects.agreed_total_cents',
    notes: 'Immutable after send/accept; must not recalculate from later catalog changes.',
  })

  return rows
}

/**
 * Throws if package EUR/CENTS maps disagree, or package definitions drift
 * from informative floors. Safe to call from tests only.
 */
export function assertWebAtelierPricingCatalogIntegrity(): void {
  const tiers: WebAtelierPackageTier[] = ['start', 'pro', 'premium']
  for (const tier of tiers) {
    const eur = WEB_ATELIER_INFORMATIVE_PRICES_EUR[tier]
    const cents = WEB_ATELIER_INFORMATIVE_PRICES_CENTS[tier]
    if (catalogEurToCents(eur) !== cents) {
      throw new Error(`package_price_drift:${tier}:eur=${eur}:cents=${cents}`)
    }
  }

  for (const pkg of WEB_ATELIER_PACKAGE_DEFINITIONS) {
    const expected = WEB_ATELIER_INFORMATIVE_PRICES_EUR[pkg.id as ConfiguratorPackageId]
    if (pkg.fromEur !== expected) {
      throw new Error(`package_definition_drift:${pkg.id}`)
    }
  }

  for (const addon of WEB_ATELIER_ADDON_DEFINITIONS) {
    if (addon.kind === 'custom_quote') {
      if (addon.unitEur != null) {
        throw new Error(`custom_quote_must_have_null_price:${addon.id}`)
      }
      continue
    }
    if (addon.unitEur == null || !Number.isInteger(addon.unitEur) || addon.unitEur < 0) {
      throw new Error(`addon_catalog_invalid:${addon.id as ConfiguratorAddonId}`)
    }
    // Touch cents conversion — throws on non-integer catalog EUR.
    catalogEurToCents(addon.unitEur)
  }
}
