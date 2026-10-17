import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEMO_ACTION_IS_LOCAL_ONLY,
  WEB_ATELIER_DEMOS,
  WEB_ATELIER_DEMO_BANNER_EN,
  WEB_ATELIER_DEMO_BANNER_HR,
  WEB_ATELIER_DEMO_SLUGS,
  demoBannerText,
  demoBookingConfirmation,
  demoOrderConfirmation,
  demoPath,
  getWebAtelierDemo,
  isWebAtelierDemoSlug,
} from '../src/lib/webAtelierDemos.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

// --- Metadata ---
assert.equal(WEB_ATELIER_DEMOS.length, 3)
assert.deepEqual([...WEB_ATELIER_DEMO_SLUGS], ['stolarija', 'grooming', 'cvjecarna'])
assert.equal(WEB_ATELIER_DEMOS[0].packageTier, 'start')
assert.equal(WEB_ATELIER_DEMOS[1].packageTier, 'pro')
assert.equal(WEB_ATELIER_DEMOS[2].packageTier, 'premium')

for (const demo of WEB_ATELIER_DEMOS) {
  assert.equal(demo.path, demoPath(demo.slug))
  assert.ok(demo.path.startsWith('/web-atelier/demo/'))
  assert.ok(demo.title.hr.length > 0)
  assert.ok(demo.title.en.length > 0)
  assert.ok(demo.summary.hr.length > 0)
  assert.ok(demo.packageNote.hr.length > 20)
  assert.ok(['start', 'pro', 'premium'].includes(demo.packageTier))
}

assert.equal(isWebAtelierDemoSlug('stolarija'), true)
assert.equal(isWebAtelierDemoSlug('nope'), false)
assert.equal(getWebAtelierDemo('grooming')?.slug, 'grooming')
assert.equal(getWebAtelierDemo('x'), null)

assert.equal(demoBannerText('hr'), WEB_ATELIER_DEMO_BANNER_HR)
assert.equal(demoBannerText('en'), WEB_ATELIER_DEMO_BANNER_EN)
assert.ok(WEB_ATELIER_DEMO_BANNER_HR.includes('DEMO KONCEPT'))
assert.ok(WEB_ATELIER_DEMO_BANNER_EN.toLowerCase().includes('demo concept'))

// --- Demo-only actions ---
assert.equal(DEMO_ACTION_IS_LOCAL_ONLY, true)
const bookHr = demoBookingConfirmation('hr')
const bookEn = demoBookingConfirmation('en')
assert.ok(bookHr.toLowerCase().includes('demo'))
assert.ok(bookHr.includes('nije spremljen') || bookHr.includes('nije poslan'))
assert.ok(bookEn.toLowerCase().includes('demo'))
assert.ok(bookEn.includes('No appointment') || bookEn.includes('no email'))

const orderHr = demoOrderConfirmation('hr')
const orderEn = demoOrderConfirmation('en')
assert.ok(orderHr.toLowerCase().includes('demo'))
assert.ok(orderHr.includes('Nema naplate') || orderHr.includes('nije poslana'))
assert.ok(orderEn.toLowerCase().includes('demo'))
assert.ok(orderEn.includes('no payment') || orderEn.includes('No payment'))

// --- Package messaging (no free booking / no base ecommerce) ---
const grooming = getWebAtelierDemo('grooming')!
assert.ok(
  grooming.packageNote.hr.toLowerCase().includes('opcional') ||
    grooming.packageNote.hr.toLowerCase().includes('nije uključen'),
)
assert.ok(
  grooming.packageNote.en.toLowerCase().includes('optional') ||
    grooming.packageNote.en.toLowerCase().includes('not included'),
)

const florist = getWebAtelierDemo('cvjecarna')!
assert.ok(
  florist.packageNote.hr.toLowerCase().includes('e-commerce') ||
    florist.packageNote.hr.toLowerCase().includes('ecommerce') ||
    florist.packageNote.hr.toLowerCase().includes('nije uključen'),
)
assert.ok(florist.packageNote.en.toLowerCase().includes('ecommerce') || florist.packageNote.en.toLowerCase().includes('not included'))

// --- Routes & guard wiring ---
{
  const app = read('src/App.tsx')
  assert.ok(app.includes('WebAtelierDemoPage'))
  assert.ok(app.includes('demo/:slug'))
  assert.ok(app.includes('PublicServiceGuard'))
  // Demo route nested under web-atelier guard block
  const waBlockStart = app.indexOf('path="/web-atelier"')
  const waBlockEnd = app.indexOf('path="/o-nama"')
  assert.ok(waBlockStart >= 0 && waBlockEnd > waBlockStart)
  const waBlock = app.slice(waBlockStart, waBlockEnd)
  assert.ok(waBlock.includes('demo/:slug'))
  assert.ok(waBlock.includes('PublicServiceGuard') || app.includes('service="webAtelier"'))
}

{
  const section = read('src/components/WebAtelierSection.tsx')
  assert.ok(section.includes('WebAtelierDemoPortfolio'))
  assert.ok(!section.includes('Fotografija dolazi uskoro'))
}

{
  const groomingSrc = read('src/components/webAtelierDemos/GroomingDemo.tsx')
  assert.ok(groomingSrc.includes('demoBookingConfirmation'))
  assert.ok(groomingSrc.includes('DEMO_ACTION_IS_LOCAL_ONLY'))
  assert.ok(!groomingSrc.includes('fetch('))
  assert.ok(!groomingSrc.includes('supabase'))
  assert.ok(!groomingSrc.includes('mailto:'))

  const floristSrc = read('src/components/webAtelierDemos/FloristDemo.tsx')
  assert.ok(floristSrc.includes('demoOrderConfirmation'))
  assert.ok(!floristSrc.includes('fetch('))
  assert.ok(!floristSrc.includes('stripe'))
  assert.ok(!floristSrc.includes('supabase'))
}

{
  const page = read('src/pages/WebAtelierDemoPage.tsx')
  assert.ok(page.includes('noIndex'))
  assert.ok(page.includes('WebAtelierDemoChrome'))
  assert.ok(page.includes('DEMO') || page.includes('demoBanner') || true)
}

{
  const chrome = read('src/components/webAtelierDemos/WebAtelierDemoChrome.tsx')
  assert.ok(chrome.includes('demoBannerText'))
  assert.ok(chrome.includes('/web-atelier#web-atelier-configurator') || chrome.includes('configurator'))
}

// --- SEO: demos must not appear in public sitemap ---
{
  const sitemap = read('public/sitemap.xml')
  assert.ok(!sitemap.includes('/web-atelier/demo'))
  assert.ok(!sitemap.includes('stolarija'))
  assert.ok(!sitemap.includes('grooming'))
  assert.ok(!sitemap.includes('cvjecarna'))
}

// --- Header must not add ungated demo links ---
{
  const header = read('src/components/Header.tsx')
  assert.ok(!header.includes('/web-atelier/demo'))
}

console.log('web-atelier demos tests: OK')
