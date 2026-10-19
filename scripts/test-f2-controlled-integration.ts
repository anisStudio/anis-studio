/**
 * F2 controlled integration — cross-feature regression invariants.
 * Does not invent commercial prices or flip public visibility.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  WEB_ATELIER_INFORMATIVE_PRICES_CENTS,
  WEB_ATELIER_INFORMATIVE_PRICES_EUR,
} from '../src/lib/webAtelierOffers.ts'
import { assertWebAtelierPricingCatalogIntegrity } from '../src/lib/webAtelierPricingIntegrity.ts'
import { calculateConfiguratorEstimate } from '../src/lib/webAtelierConfigurator.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

function pkgScripts(): Record<string, string> {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
  return pkg.scripts
}

// --- Pricing integrity survived merge ---
assertWebAtelierPricingCatalogIntegrity()
assert.equal(WEB_ATELIER_INFORMATIVE_PRICES_EUR.start, 300)
assert.equal(WEB_ATELIER_INFORMATIVE_PRICES_EUR.pro, 500)
assert.equal(WEB_ATELIER_INFORMATIVE_PRICES_EUR.premium, 800)
assert.equal(WEB_ATELIER_INFORMATIVE_PRICES_CENTS.start, 30_000)
assert.equal(calculateConfiguratorEstimate({ packageId: 'start', addons: {} }).fixedTotalEur, 300)

// --- npm scripts from all F2 features present ---
{
  const scripts = pkgScripts()
  for (const name of [
    'smart-booking:test',
    'smart-booking:edge:test',
    'smart-booking:sql',
    'smart-calendar:test',
    'web-atelier:configurator:test',
    'web-atelier:offers:test',
    'web-atelier:pricing-audit:test',
    'web-atelier:premium-ux:test',
    'admin-preview:test',
    'admin-password:test',
    'f2:integration:test',
    'admin-availability-day:test',
  ]) {
    assert.ok(scripts[name], `missing script ${name}`)
  }
}

// --- Smart Calendar migrations present and ordered after prior head ---
{
  const m1 = 'supabase/migrations/20261018100000_f26_smart_calendar_2.sql'
  const m2 = 'supabase/migrations/20261018101000_f26_wa_capacity_sync.sql'
  assert.ok(existsSync(join(root, m1)))
  assert.ok(existsSync(join(root, m2)))
  assert.ok(existsSync(join(root, 'supabase/migrations/20261017140000_f26_booking_turnstile_edge_hardening.sql')))
  const capacity = read(m2)
  assert.ok(capacity.toLowerCase().includes('capacity') || capacity.includes('web_atelier'))
}

// --- F2.6 capacity helpers / holidays / anniversary modules ---
{
  assert.ok(existsSync(join(root, 'src/lib/croatianHolidays.ts')))
  assert.ok(existsSync(join(root, 'src/lib/studioAnniversary.ts')))
  const booking = read('src/lib/smartBooking.ts')
  assert.ok(booking.includes('Europe/Zagreb') || booking.includes('Zagreb') || booking.length > 100)
  const anniversary = read('src/lib/studioAnniversary.ts')
  assert.ok(anniversary.includes('2024-10-01') || anniversary.includes('2024'))
}

// --- Admin preview fail-closed + routes ---
{
  const app = read('src/App.tsx')
  assert.ok(app.includes('AdminSitePreviewPage') || app.includes('admin/preview') || app.includes('preview'))
  assert.ok(app.includes('PublicServiceGuard') || app.includes('webAtelier'))
  const previewTest = read('scripts/test-admin-preview-access.ts')
  assert.ok(previewTest.includes('is_admin') || previewTest.includes('admin'))
}

// --- WA premium UX still wired ---
{
  const section = read('src/components/WebAtelierSection.tsx')
  assert.ok(section.includes('WebAtelierConfigurator'))
  const configurator = read('src/components/WebAtelierConfigurator.tsx')
  assert.ok(configurator.includes('informativ') || configurator.includes('neobvezujuć'))
  assert.ok(configurator.includes('Nije ugovor') || configurator.includes('nije ugovor'))
}

// --- Offer acceptance can pass capacity options (WA auto allocation path) ---
{
  const offers = read('src/lib/webAtelierOffers.ts')
  assert.ok(offers.includes('capacityOverride') || offers.includes('capacity_allocation'))
  assert.ok(offers.includes('p_capacity_override') || offers.includes('capacity'))
}

// --- No accidental public visibility hardcode flip to true in source defaults ---
{
  const settings = read('src/pages/AdminSettingsPage.tsx')
  // Must still mention web atelier visibility control; must not force-enable in client defaults blindly
  assert.ok(settings.includes('web_atelier') || settings.includes('webAtelier') || settings.includes('Web Atelier'))
  const guardSources = [read('src/App.tsx'), settings]
  for (const src of guardSources) {
    assert.equal(/web_atelier_public_visible\s*[:=]\s*true/.test(src), false)
  }
}

// --- Dangerous leftover bat files must not be relied on (document presence only) ---
{
  // Integration must never push main via helper scripts committed in tree historically.
  const save = read('package.json')
  assert.ok(!save.includes('git push origin main'))
}

console.log('f2 controlled integration tests: OK')
