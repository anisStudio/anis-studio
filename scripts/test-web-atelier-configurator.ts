import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WEB_ATELIER_INFORMATIVE_PRICES_EUR } from '../src/lib/webAtelierOffers.ts'
import {
  WEB_ATELIER_CONFIG_MARKER_END,
  WEB_ATELIER_CONFIG_MARKER_START,
  calculateConfiguratorEstimate,
  emptyConfiguratorSelection,
  featuresFromConfigurator,
  formatConfiguratorSummary,
  inquiryPatchesFromConfigurator,
  mergeConfiguratorIntoFeaturesNotes,
  normalizeConfiguratorSelection,
  parseConfiguratorSelection,
  projectTypesFromConfigurator,
  suggestBudgetRange,
} from '../src/lib/webAtelierConfigurator.ts'

assert.equal(WEB_ATELIER_CONFIG_MARKER_START.includes('F2.5 CONFIGURATOR'), true)
assert.equal(WEB_ATELIER_CONFIG_MARKER_END.includes('END F2.5'), true)

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

// --- Package selection & floors (reuse offers informative prices) ---
assert.equal(WEB_ATELIER_INFORMATIVE_PRICES_EUR.start, 300)
assert.equal(WEB_ATELIER_INFORMATIVE_PRICES_EUR.pro, 500)
assert.equal(WEB_ATELIER_INFORMATIVE_PRICES_EUR.premium, 800)

{
  const start = calculateConfiguratorEstimate({ packageId: 'start', addons: {} })
  assert.equal(start.fixedTotalEur, 300)
  assert.equal(start.estimateFloorEur, 300)
  assert.equal(start.hasCustomQuote, false)
}

{
  const pro = calculateConfiguratorEstimate({ packageId: 'pro', addons: {} })
  assert.equal(pro.fixedTotalEur, 500)
}

{
  const premium = calculateConfiguratorEstimate({ packageId: 'premium', addons: {} })
  assert.equal(premium.fixedTotalEur, 800)
}

// --- Fixed add-ons ---
{
  const est = calculateConfiguratorEstimate({
    packageId: 'start',
    addons: { extra_page: 2, newsletter: 1, simple_functionality: 1 },
  })
  // 300 + 2*60 + 80 + 50 = 550
  assert.equal(est.fixedTotalEur, 550)
  assert.equal(est.estimateFloorEur, 550)
}

// --- Booking exclusion: own wins over external when both requested ---
{
  const normalized = normalizeConfiguratorSelection({
    packageId: 'pro',
    addons: { external_booking: 1, own_booking: 1 },
  })
  assert.equal(normalized.addons.external_booking, undefined)
  assert.equal(normalized.addons.own_booking, 1)
  const est = calculateConfiguratorEstimate({
    packageId: 'pro',
    addons: { external_booking: 1, own_booking: 1 },
  })
  assert.ok(est.exclusionsApplied.includes('external_booking_vs_own_booking'))
  assert.equal(est.fixedTotalEur, 500 + 300)
}

// --- Ecommerce: new_web_shop supersedes package price ---
{
  const est = calculateConfiguratorEstimate({
    packageId: 'premium',
    addons: { new_web_shop: 1 },
  })
  assert.equal(est.packageSupersededByEcommerce, true)
  assert.equal(est.fixedTotalEur, 0)
  assert.equal(est.estimateFloorEur, 1500)
  assert.ok(est.exclusionsApplied.includes('package_superseded_by_new_web_shop'))
}

// --- shop vs new_web_shop exclusive ---
{
  const normalized = normalizeConfiguratorSelection({
    packageId: 'start',
    addons: { shop_integration: 1, new_web_shop: 1 },
  })
  assert.equal(normalized.addons.shop_integration, undefined)
  assert.equal(normalized.addons.new_web_shop, 1)
}

// --- Estimate-from AI content (not binding fixed in fixedTotal) ---
{
  const est = calculateConfiguratorEstimate({
    packageId: 'start',
    addons: { ai_content: 1 },
  })
  assert.equal(est.fixedTotalEur, 300)
  assert.equal(est.estimateFloorEur, 380)
  assert.equal(est.hasEstimateOnly, true)
}

// --- Custom quote never invents a fixed price ---
{
  const est = calculateConfiguratorEstimate({
    packageId: 'pro',
    addons: { advanced_copywriting: 1, advanced_ecommerce: 1 },
  })
  assert.equal(est.hasCustomQuote, true)
  const customLines = est.lines.filter((l) => l.customQuote)
  assert.equal(customLines.length, 2)
  for (const line of customLines) {
    assert.equal(line.unitEur, null)
    assert.equal(line.lineEur, null)
  }
  // advanced_ecommerce drops shop lines if present
  const withShop = calculateConfiguratorEstimate({
    packageId: 'pro',
    addons: { shop_integration: 1, advanced_ecommerce: 1 },
  })
  assert.equal(withShop.selection.addons.shop_integration, undefined)
  assert.ok(!withShop.lines.some((l) => l.id === 'shop_integration'))
}

// --- Indicative summary markers ---
{
  const est = calculateConfiguratorEstimate({
    packageId: 'pro',
    addons: { dark_light_mode: 1 },
  })
  const summaryHr = formatConfiguratorSummary(est, 'hr')
  assert.ok(summaryHr.includes(WEB_ATELIER_CONFIG_MARKER_START))
  assert.ok(summaryHr.includes(WEB_ATELIER_CONFIG_MARKER_END))
  assert.ok(summaryHr.toLowerCase().includes('neobvezujuć') || summaryHr.includes('informativ'))
  const summaryEn = formatConfiguratorSummary(est, 'en')
  assert.ok(summaryEn.toLowerCase().includes('nonbinding') || summaryEn.includes('indicative'))
}

// --- Form integration patches (existing fields only) ---
{
  const patches = inquiryPatchesFromConfigurator(
    { packageId: 'start', addons: { newsletter: 1, external_booking: 1 } },
    'hr',
  )
  assert.equal(patches.packagePreference, 'start')
  assert.ok(patches.featuresNotes.includes(WEB_ATELIER_CONFIG_MARKER_START))
  assert.ok(patches.features.includes('Integracija s newsletterom (Mailchimp, sl.)'))
  assert.ok(patches.features.includes('Sustav za rezervacije (kalendar, termini)'))
  assert.ok(patches.projectTypes.includes('Nova web stranica od nule') || patches.projectTypes.includes('Sustav za rezervacije / termine'))
  assert.equal(patches.budgetRange, 'under-1000')
}

{
  const merged = mergeConfiguratorIntoFeaturesNotes(
    'Korisničke napomene',
    `${WEB_ATELIER_CONFIG_MARKER_START}\nX\n${WEB_ATELIER_CONFIG_MARKER_END}`,
  )
  assert.ok(merged.startsWith(WEB_ATELIER_CONFIG_MARKER_START))
  assert.ok(merged.includes('Korisničke napomene'))
  const again = mergeConfiguratorIntoFeaturesNotes(
    merged,
    `${WEB_ATELIER_CONFIG_MARKER_START}\nY\n${WEB_ATELIER_CONFIG_MARKER_END}`,
  )
  assert.equal(again.includes('X'), false)
  assert.ok(again.includes('Y'))
  assert.ok(again.includes('Korisničke napomene'))
}

assert.equal(suggestBudgetRange(300), 'under-1000')
assert.equal(suggestBudgetRange(1500), '1000-3000')
assert.equal(suggestBudgetRange(null), '')

assert.deepEqual(featuresFromConfigurator(emptyConfiguratorSelection()), [])
assert.ok(projectTypesFromConfigurator({ packageId: 'pro', addons: {} }).includes('Nova web stranica od nule'))

{
  const parsed = parseConfiguratorSelection({
    packageId: 'premium',
    addons: { extra_page: 99, newsletter: 1 },
  })
  assert.ok(parsed)
  assert.equal(parsed!.addons.extra_page, 20)
  assert.equal(parsed!.packageId, 'premium')
}

// --- Wiring: section embeds configurator; inquiry applies cfg; no schema migration ---
{
  const section = read('src/components/WebAtelierSection.tsx')
  assert.ok(section.includes('WebAtelierConfigurator'))
  assert.ok(!section.includes('Stripe'))
  assert.ok(!section.includes('299€'))

  const form = read('src/components/WebProjectForm.tsx')
  assert.ok(form.includes('inquiryPatchesFromConfigurator'))
  assert.ok(form.includes('applyStoredConfigurator'))
  assert.ok(form.includes('featuresNotes'))

  const inquiryPage = read('src/pages/WebAtelierInquiryPage.tsx')
  assert.ok(inquiryPage.includes('cfg'))

  const app = read('src/App.tsx')
  assert.ok(app.includes('PublicServiceGuard'))
  assert.ok(app.includes('webAtelier'))
}

console.log('web-atelier configurator tests: OK')
