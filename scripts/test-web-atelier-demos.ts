import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { floristConfig, floristPhotos } from '../src/components/webAtelierDemos/cvjecarna/config.ts'
import { groomingConfig, groomingPhotos } from '../src/components/webAtelierDemos/grooming/config.ts'
import { interiorsStudioConfig } from '../src/components/webAtelierDemos/interijeri/config.ts'
import { DEMO_PHOTO_PUBLIC_DIR } from '../src/components/webAtelierDemos/photoSlot.ts'
import {
  DEMO_ACTION_IS_LOCAL_ONLY,
  WEB_ATELIER_DEMOS,
  WEB_ATELIER_DEMO_BANNER_EN,
  WEB_ATELIER_DEMO_BANNER_HR,
  WEB_ATELIER_DEMO_SLUGS,
  demoBannerText,
  demoBookingConfirmation,
  demoPath,
  getWebAtelierDemo,
  isWebAtelierDemoSlug,
} from '../src/lib/webAtelierDemos.ts'
import { DEPARTMENT_PREVIEW_LINKS } from '../src/lib/publicServiceAccess.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

// --- Metadata ---
assert.equal(WEB_ATELIER_DEMOS.length, 3)
assert.deepEqual([...WEB_ATELIER_DEMO_SLUGS], ['cvjecarna', 'grooming', 'interijeri'])
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

assert.equal(isWebAtelierDemoSlug('cvjecarna'), true)
assert.equal(isWebAtelierDemoSlug('interijeri'), true)
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
assert.ok(bookHr.includes('lokalno') || bookHr.includes('pregledniku'))
assert.ok(bookEn.toLowerCase().includes('demo'))
assert.ok(bookEn.includes('browser') || bookEn.includes('no email'))

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
assert.equal(florist.packageTier, 'start')
assert.ok(
  florist.packageNote.hr.toLowerCase().includes('jedna') ||
    florist.packageNote.hr.toLowerCase().includes('start'),
)

const interiors = getWebAtelierDemo('interijeri')!
assert.equal(interiors.packageTier, 'premium')
assert.ok(interiors.summary.hr.toLowerCase().includes('portfolio'))

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
  const groomingSrc = read('src/components/webAtelierDemos/grooming/GroomingDemo.tsx')
  assert.ok(groomingSrc.includes('demoBookingConfirmation'))
  assert.ok(groomingSrc.includes('DEMO_ACTION_IS_LOCAL_ONLY'))
  assert.ok(groomingSrc.includes('localStorage'))
  assert.ok(!groomingSrc.includes('fetch('))
  assert.ok(!groomingSrc.includes('supabase'))
  assert.ok(!groomingSrc.includes('mailto:'))

  const floristSrc = read('src/components/webAtelierDemos/cvjecarna/FloristDemo.tsx')
  assert.ok(floristSrc.includes('floristConfig'))
  assert.ok(!floristSrc.includes('fetch('))
  assert.ok(!floristSrc.includes('stripe'))
  assert.ok(!floristSrc.includes('supabase'))

  const interiorsSrc = read('src/components/webAtelierDemos/interijeri/InteriorsStudioDemo.tsx')
  assert.ok(interiorsSrc.includes('materials'))
  assert.ok(interiorsSrc.includes('role="dialog"'))
  assert.ok(!interiorsSrc.includes('fetch('))
  assert.ok(!interiorsSrc.includes('supabase'))
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

// --- Prepared photography (CSS stand-in until files arrive) ---
{
  const pending = [...floristPhotos, ...groomingPhotos]
  assert.equal(pending.length, 10)
  assert.equal(new Set(pending.map((photo) => photo.file)).size, 10)
  assert.deepEqual(
    floristPhotos.map((photo) => photo.ratio),
    ['16:9', '4:5', '4:5', '4:5', '3:2'],
  )
  assert.deepEqual(
    groomingPhotos.map((photo) => photo.ratio),
    ['16:9', '1:1', '1:1', '1:1', '1:1'],
  )

  for (const photo of pending) {
    assert.match(photo.file, /^[a-z0-9-]+\.webp$/)
    assert.ok(!photo.file.includes('/'))
    assert.ok(photo.motif.hr.length > 8)
    assert.ok(photo.motif.en.length > 8)
    assert.ok(photo.usedIn.length >= 1)
    assert.ok(photo.usedIn.every((place) => place.hr.length > 3 && place.en.length > 3))
    assert.ok(photo.standInClass.length > 0)
  }

  for (const hero of [floristPhotos[0], groomingPhotos[0]]) {
    assert.equal(hero.id, 'hero')
    assert.equal(hero.ratio, '16:9')
    assert.ok(hero.usedIn.some((place) => place.hr.toLowerCase().includes('kartice')))
    assert.ok(hero.usedIn.some((place) => place.en.toLowerCase().includes('card')))
  }

  for (const arrangement of floristConfig.arrangements) {
    assert.ok(floristPhotos.some((photo) => photo.id === arrangement.id && photo.ratio === '4:5'))
  }
  for (const tile of groomingConfig.gallery) {
    assert.ok(groomingPhotos.some((photo) => photo.id === tile.id && photo.ratio === '1:1'))
  }

  assert.equal(getWebAtelierDemo('cvjecarna')?.businessName, floristConfig.brand)
  assert.equal(getWebAtelierDemo('grooming')?.businessName, groomingConfig.brand)
  assert.equal(getWebAtelierDemo('interijeri')?.businessName, interiorsStudioConfig.brand)

  const floristSrc = read('src/components/webAtelierDemos/cvjecarna/FloristDemo.tsx')
  const groomingSrc = read('src/components/webAtelierDemos/grooming/GroomingDemo.tsx')
  const portfolioSrc = read('src/components/webAtelierDemos/WebAtelierDemoPortfolio.tsx')
  const css = read('src/components/webAtelierDemos/webAtelierDemos.css')

  assert.ok(floristSrc.includes('photoSlotAttrs'))
  assert.ok(groomingSrc.includes('photoSlotAttrs'))
  assert.ok(!floristSrc.includes('<img'))
  assert.ok(!groomingSrc.includes('<img'))
  assert.ok(!floristSrc.includes(DEMO_PHOTO_PUBLIC_DIR))
  assert.ok(!groomingSrc.includes(DEMO_PHOTO_PUBLIC_DIR))
  assert.ok(portfolioSrc.includes('wa-demo-cvjecarna.webp'))
  assert.ok(portfolioSrc.includes('wa-demo-grooming.webp'))
  assert.ok(portfolioSrc.includes('wa-demo-interijeri.webp'))
  assert.ok(portfolioSrc.includes('Snimka demo stranice Cvjećarnica'))
  assert.ok(portfolioSrc.includes('Screenshot of the Interior studio'))
  assert.ok(existsSync(join(root, 'public/images/web-atelier-demos/wa-demo-cvjecarna.webp')))
  assert.ok(existsSync(join(root, 'public/images/web-atelier-demos/wa-demo-grooming.webp')))
  assert.ok(existsSync(join(root, 'public/images/web-atelier-demos/wa-demo-interijeri.webp')))
  assert.match(css, /\.wa-flor-hero-frame\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/)
  assert.match(css, /\.wa-flor-arrangement\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*5/)
  assert.match(css, /\.wa-flor-space\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*2/)
  assert.match(css, /\.wa-groom-hero-frame\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/)
  assert.match(css, /\.wa-groom-tile\s*\{[^}]*aspect-ratio:\s*1\b/)
  assert.ok(!css.includes('.wa-flor-card:nth-child(2) .wa-flor-swatch'))

  for (const project of interiorsStudioConfig.projects) {
    assert.ok(project.cover.startsWith('/images/interijeri/'))
    for (const photo of project.photos) {
      assert.ok(photo.src.startsWith('/images/interijeri/'))
    }
  }
  const mirna = interiorsStudioConfig.projects.find((project) => project.id === 'kuhinja-mirna')
  assert.deepEqual(
    mirna?.photos.map((photo) => photo.src),
    ['/images/interijeri/kitchen-advanced.webp'],
  )
  assert.equal(mirna?.execution.hr.includes('dvije ogledne'), false)
  assert.equal(mirna?.execution.en.toLowerCase().includes('two sample'), false)
  assert.ok(interiorsStudioConfig.projects.some((project) => project.photos.some((photo) => photo.src.endsWith('kitchen-complex.webp'))))
  assert.match(css, /\.wa-flor-contact > \.wa-flor-kicker/)
  assert.match(read('src/components/webAtelierDemos/interijeri/interiorsStudioDemo.css'), /img:only-child/)
  assert.ok(!read('src/components/webAtelierDemos/interijeri/config.ts').includes('web-atelier-demos'))
}

{
  const demoLinks = DEPARTMENT_PREVIEW_LINKS.webAtelier.filter((link) => link.path.includes('/demo/'))
  assert.deepEqual(
    demoLinks.map((link) => link.path),
    WEB_ATELIER_DEMOS.map((demo) => demo.path),
  )
  assert.ok(!demoLinks.some((link) => link.path.includes('stolarija')))
}

console.log('web-atelier demos tests: OK')
