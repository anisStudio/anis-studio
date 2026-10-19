/**
 * F2.9 Web Atelier pricing regression matrix.
 * Uses repository-declared catalog values only — does not invent commercial prices.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  WEB_ATELIER_ADDON_DEFINITIONS,
  WEB_ATELIER_PACKAGE_DEFINITIONS,
  calculateConfiguratorEstimate,
  clampAddonQuantity,
  emptyConfiguratorSelection,
  inquiryPatchesFromConfigurator,
  normalizeConfiguratorSelection,
  parseConfiguratorSelection,
  type ConfiguratorAddonId,
  type ConfiguratorSelection,
} from '../src/lib/webAtelierConfigurator.ts'
import {
  WEB_ATELIER_INFORMATIVE_PRICES_CENTS,
  WEB_ATELIER_INFORMATIVE_PRICES_EUR,
  calculateOfferTotals,
  eurosToCents,
  lineTotalCents,
  suggestedLineForTier,
  validateOfferItems,
} from '../src/lib/webAtelierOffers.ts'
import {
  assertWebAtelierPricingCatalogIntegrity,
  buildWebAtelierPricingInventory,
  catalogEurToCents,
} from '../src/lib/webAtelierPricingIntegrity.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

// --- Catalog integrity (EUR ↔ cents, definition drift) ---
assertWebAtelierPricingCatalogIntegrity()

{
  const inventory = buildWebAtelierPricingInventory()
  assert.ok(inventory.some((r) => r.id === 'package:start' && r.unitEur === 300))
  assert.ok(inventory.some((r) => r.id === 'package:pro' && r.unitEur === 500))
  assert.ok(inventory.some((r) => r.id === 'package:premium' && r.unitEur === 800))
  assert.ok(inventory.some((r) => r.id === 'addon:extra_page' && r.unitEur === 60))
  assert.ok(inventory.some((r) => r.authority === 'admin_offer_line_items'))
  assert.ok(inventory.some((r) => r.authority === 'accepted_offer_snapshot'))
}

for (const tier of ['start', 'pro', 'premium'] as const) {
  assert.equal(
    WEB_ATELIER_INFORMATIVE_PRICES_CENTS[tier],
    WEB_ATELIER_INFORMATIVE_PRICES_EUR[tier] * 100,
  )
  assert.equal(catalogEurToCents(WEB_ATELIER_INFORMATIVE_PRICES_EUR[tier]), eurosToCents(WEB_ATELIER_INFORMATIVE_PRICES_EUR[tier]))
}

for (const pkg of WEB_ATELIER_PACKAGE_DEFINITIONS) {
  assert.equal(pkg.fromEur, WEB_ATELIER_INFORMATIVE_PRICES_EUR[pkg.id])
  assert.ok(pkg.includes.includes('responsive'), `missing responsive:${pkg.id}`)
  assert.ok(pkg.includes.includes('basic_seo'), `missing basic_seo:${pkg.id}`)
  assert.ok(pkg.includes.includes('basic_contact_form'), `missing contact:${pkg.id}`)
}
assert.ok(WEB_ATELIER_PACKAGE_DEFINITIONS.find((p) => p.id === 'start')!.pages === 1)
assert.ok(WEB_ATELIER_PACKAGE_DEFINITIONS.find((p) => p.id === 'pro')!.pages === 5)
assert.ok(WEB_ATELIER_PACKAGE_DEFINITIONS.find((p) => p.id === 'premium')!.pages === 7)
assert.ok(WEB_ATELIER_PACKAGE_DEFINITIONS.find((p) => p.id === 'premium')!.includes.includes('mini_branding'))
assert.ok(
  WEB_ATELIER_PACKAGE_DEFINITIONS.find((p) => p.id === 'premium')!.includes.includes(
    'priority_support_30d',
  ),
)

// --- Each package alone ---
{
  const cases = [
    { id: 'start' as const, eur: 300 },
    { id: 'pro' as const, eur: 500 },
    { id: 'premium' as const, eur: 800 },
  ]
  for (const c of cases) {
    const est = calculateConfiguratorEstimate({ packageId: c.id, addons: {} })
    assert.equal(est.fixedTotalEur, c.eur)
    assert.equal(est.estimateFloorEur, c.eur)
    assert.equal(est.hasCustomQuote, false)
    assert.equal(Number.isInteger(est.fixedTotalEur), true)
  }
}

// --- Each optional priced feature (fixed + estimate_from) on START ---
{
  for (const def of WEB_ATELIER_ADDON_DEFINITIONS) {
    if (def.unitEur == null) continue
    const est = calculateConfiguratorEstimate({
      packageId: 'start',
      addons: { [def.id]: 1 },
    })
    if (def.id === 'new_web_shop') {
      // Supersedes package
      assert.equal(est.packageSupersededByEcommerce, true)
      assert.equal(est.fixedTotalEur, 0)
      assert.equal(est.estimateFloorEur, def.unitEur)
      continue
    }
    if (def.kind === 'fixed') {
      assert.equal(est.fixedTotalEur, 300 + def.unitEur)
      assert.equal(est.estimateFloorEur, 300 + def.unitEur)
    } else if (def.kind === 'estimate_from') {
      assert.equal(est.fixedTotalEur, 300)
      assert.equal(est.estimateFloorEur, 300 + def.unitEur)
    }
  }
}

// --- Minimum valid configuration (empty) ---
{
  const est = calculateConfiguratorEstimate(emptyConfiguratorSelection())
  assert.equal(est.fixedTotalEur, 0)
  assert.equal(est.estimateFloorEur, null)
  assert.equal(est.lines.length, 0)
}

// --- Maximum valid configuration (all compatible max quantities) ---
{
  const addons: ConfiguratorSelection['addons'] = {
    extra_page: 20,
    minor_revision: 10,
    ai_localization: 1,
    own_booking: 1, // wins over external
    newsletter: 1,
    simple_functionality: 1,
    dark_light_mode: 1,
    ai_content: 1,
    new_web_shop: 1, // wins over shop_integration; supersedes package
    advanced_copywriting: 1,
    // advanced_ecommerce would drop new_web_shop — omit for max priced ecommerce path
  }
  const est = calculateConfiguratorEstimate({ packageId: 'premium', addons })
  assert.equal(est.packageSupersededByEcommerce, true)
  assert.equal(est.hasCustomQuote, true)
  assert.equal(est.hasEstimateOnly, true)
  // fixed: 20*60 + 10*40 + 100 + 300 + 80 + 50 + 100 = 1200+400+100+300+80+50+100 = 2230
  assert.equal(est.fixedTotalEur, 2230)
  // floor adds estimate_from: ai_content 80 + new_web_shop 1500
  assert.equal(est.estimateFloorEur, 2230 + 80 + 1500)
}

// --- Incompatible combinations ---
{
  const booking = normalizeConfiguratorSelection({
    packageId: 'pro',
    addons: { external_booking: 1, own_booking: 1 },
  })
  assert.equal(booking.addons.external_booking, undefined)
  assert.equal(booking.addons.own_booking, 1)

  const shop = normalizeConfiguratorSelection({
    packageId: 'start',
    addons: { shop_integration: 1, new_web_shop: 1 },
  })
  assert.equal(shop.addons.shop_integration, undefined)
  assert.equal(shop.addons.new_web_shop, 1)

  const adv = normalizeConfiguratorSelection({
    packageId: 'pro',
    addons: { shop_integration: 1, new_web_shop: 1, advanced_ecommerce: 1 },
  })
  assert.equal(adv.addons.shop_integration, undefined)
  assert.equal(adv.addons.new_web_shop, undefined)
  assert.equal(adv.addons.advanced_ecommerce, 1)
}

// --- Invalid option identifiers ignored ---
{
  const parsed = parseConfiguratorSelection({
    packageId: 'start',
    addons: { not_a_real_addon: 1, newsletter: 1, extra_page: '3' },
  })
  assert.ok(parsed)
  assert.equal(parsed!.addons.newsletter, 1)
  assert.equal((parsed!.addons as Record<string, number>).not_a_real_addon, undefined)
  // non-number quantities ignored by parse
  assert.equal(parsed!.addons.extra_page, undefined)
}

// --- Duplicate options collapse to clamped quantity ---
{
  const est = calculateConfiguratorEstimate({
    packageId: 'start',
    addons: { newsletter: 5 },
  })
  assert.equal(est.selection.addons.newsletter, 1)
  assert.equal(est.fixedTotalEur, 380)
}

// --- Negative / zero / large quantities ---
{
  assert.equal(clampAddonQuantity('extra_page', -3), 0)
  assert.equal(clampAddonQuantity('extra_page', 0), 0)
  assert.equal(clampAddonQuantity('extra_page', 999), 20)
  assert.equal(clampAddonQuantity('extra_page', Number.NaN), 0)
  assert.equal(clampAddonQuantity('extra_page', 2.9), 2)

  const est = calculateConfiguratorEstimate({
    packageId: 'start',
    addons: { extra_page: -1, newsletter: 0 },
  })
  assert.equal(est.fixedTotalEur, 300)
  assert.deepEqual(est.selection.addons, {})
}

// --- Decimal rounding (offer path uses integer cents; configurator catalog is whole EUR) ---
{
  assert.equal(eurosToCents(123.456), 12346)
  assert.equal(lineTotalCents(2.5, 12_345), 30_863)
  assert.throws(() => catalogEurToCents(12.5), /catalog_eur_must_be_integer/)
}

// --- Discounts + custom items (offer totals) ---
{
  const totals = calculateOfferTotals([
    { item_type: 'service', description: 'START', quantity: 1, unit_price_cents: 30_000 },
    { item_type: 'other', description: 'Custom scope', quantity: 1, unit_price_cents: 12_500 },
    { item_type: 'discount', description: 'Courtesy', quantity: 1, unit_price_cents: 5_000 },
  ])
  assert.equal(totals.subtotal_cents, 42_500)
  assert.equal(totals.discount_cents, 5_000)
  assert.equal(totals.total_cents, 37_500)

  assert.throws(
    () =>
      calculateOfferTotals([
        { item_type: 'service', description: 'X', quantity: 1, unit_price_cents: 1000 },
        { item_type: 'discount', description: 'Too much', quantity: 1, unit_price_cents: 2000 },
      ]),
    /discount_exceeds_subtotal/,
  )
}

// --- Suggested informative line matches package floors (not auto-issued) ---
{
  for (const tier of ['start', 'pro', 'premium'] as const) {
    const line = suggestedLineForTier(tier)
    assert.equal(line.unit_price_cents, WEB_ATELIER_INFORMATIVE_PRICES_CENTS[tier])
    assert.ok(line.description.toLowerCase().includes('informativ'))
    assert.ok(line.details?.includes('responzivni') || line.details?.includes('SEO'))
    assert.ok(line.details?.toLowerCase().includes('hosting'))
    assert.ok(line.details?.toLowerCase().includes('ponud'))
  }
  const premium = suggestedLineForTier('premium')
  assert.ok(premium.details?.toLowerCase().includes('mini branding'))
  assert.ok(premium.details?.includes('30'))
}

// --- Persistence roundtrip (selection serialize/parse) ---
{
  const original: ConfiguratorSelection = {
    packageId: 'pro',
    addons: { extra_page: 3, dark_light_mode: 1, ai_content: 1 },
  }
  const json = JSON.stringify(original)
  const roundtrip = parseConfiguratorSelection(JSON.parse(json))
  assert.ok(roundtrip)
  const a = calculateConfiguratorEstimate(original)
  const b = calculateConfiguratorEstimate(roundtrip!)
  assert.equal(a.fixedTotalEur, b.fixedTotalEur)
  assert.equal(a.estimateFloorEur, b.estimateFloorEur)
  assert.deepEqual(a.selection, b.selection)
}

// --- Inquiry patches never treat estimate as binding total field ---
{
  const patches = inquiryPatchesFromConfigurator(
    { packageId: 'premium', addons: { newsletter: 1 } },
    'hr',
  )
  assert.equal(patches.budgetRange, 'under-1000')
  assert.ok(patches.featuresNotes.includes('neobvezujuć') || patches.featuresNotes.includes('informativ'))
  assert.ok(!('total_cents' in patches))
  assert.ok(!('grandTotal' in patches))
}

// --- Unauthorized / malformed offer item invariants ---
{
  assert.throws(
    () => validateOfferItems([{ item_type: 'service', description: '', quantity: 1, unit_price_cents: 100 }]),
    /./,
  )
  assert.throws(() => lineTotalCents(0, 1000), /items_quantity_invalid/)
  assert.throws(() => lineTotalCents(-1, 1000), /items_quantity_invalid/)
  assert.throws(() => lineTotalCents(1, -1), /items_price_invalid/)
}

// --- Stale configuration: unknown package id dropped ---
{
  const parsed = parseConfiguratorSelection({ packageId: 'enterprise', addons: {} })
  assert.ok(parsed)
  assert.equal(parsed!.packageId, null)
}

// --- UX copy: estimate ≠ contract (HR) + package content alignment ---
{
  const configurator = read('src/components/WebAtelierConfigurator.tsx')
  assert.ok(configurator.includes('informativan') || configurator.includes('neobvezujuć'))
  assert.ok(configurator.includes('Nije ugovor') || configurator.includes('nije ugovor'))
  assert.ok(configurator.includes('packageIncludes') || configurator.includes('responzivni'))

  const section = read('src/components/WebAtelierSection.tsx')
  assert.ok(section.includes('Informativna procjena') || section.includes('informativ'))
  assert.ok(section.includes('packageMarketingBullets'))
  assert.ok(section.includes('hosting') || section.includes('Hosting'))

  const faq = read('src/sections/FAQSection.tsx')
  assert.ok(faq.includes('responzivni prikaz'))
  assert.ok(faq.includes('osnovna SEO optimizacija') || faq.includes('osnovni kontaktni'))
  assert.ok(faq.includes('Hosting, domena i održavanje'))
  assert.ok(faq.includes('nisu automatski dio paketa') || faq.includes('nisu automatski'))
  // Must not promise Analytics as a default package inclusion
  assert.equal(/uključuje[^\n.]{0,120}Google Analytics/i.test(faq), false)

  // No VAT invention on WA pricing surfaces
  assert.equal(/\bPDV\b/i.test(configurator), false)
  assert.equal(/\bVAT\b/i.test(configurator), false)
}

// --- Client grand total not wired as authoritative on inquiry submit ---
{
  const inquiry = read('src/lib/webAtelierInquiry.ts')
  assert.ok(!inquiry.includes('total_cents'))
  assert.ok(!inquiry.includes('grandTotal'))
  const gateway = read('src/lib/webAtelierEdgeHandler.ts')
  assert.ok(!gateway.includes('p_total_cents'))
  assert.ok(!gateway.includes('grand_total'))
}

// --- Determinism: same selection → same totals (100×) ---
{
  const sel: ConfiguratorSelection = {
    packageId: 'pro',
    addons: {
      extra_page: 4,
      minor_revision: 2,
      newsletter: 1,
      shop_integration: 1,
    },
  }
  const first = calculateConfiguratorEstimate(sel)
  for (let i = 0; i < 100; i++) {
    const next = calculateConfiguratorEstimate(sel)
    assert.equal(next.fixedTotalEur, first.fixedTotalEur)
    assert.equal(next.estimateFloorEur, first.estimateFloorEur)
  }
  // 500 + 4*60 + 2*40 + 80 = 500+240+80+80 = 900 fixed; floor +1000 shop = 1900
  assert.equal(first.fixedTotalEur, 900)
  assert.equal(first.estimateFloorEur, 1900)
}

// --- All addon ids covered by clamp ---
{
  for (const def of WEB_ATELIER_ADDON_DEFINITIONS) {
    const id = def.id as ConfiguratorAddonId
    assert.equal(clampAddonQuantity(id, def.maxQuantity + 5), def.maxQuantity)
  }
}

console.log('web-atelier pricing audit tests: OK')
