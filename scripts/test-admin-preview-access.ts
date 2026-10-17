// Universal admin preview — access rules + route/wiring contract (no network).

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEPARTMENT_PREVIEW_LINKS,
  PUBLIC_SERVICE_SETTING_KEY,
  resolvePublicServiceAccess,
  type PublicService,
} from '../src/lib/publicServiceAccess.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// --- Scenario 1: admin can preview hidden department ---
assert.equal(
  resolvePublicServiceAccess({
    publicVisible: false,
    isAdmin: true,
    loading: false,
  }),
  'allowed_admin_preview',
)

// --- Scenario 2: anonymous / non-admin cannot access hidden department ---
assert.equal(
  resolvePublicServiceAccess({
    publicVisible: false,
    isAdmin: false,
    loading: false,
  }),
  'denied',
)

// --- Scenario 3: publicly visible department stays available ---
assert.equal(
  resolvePublicServiceAccess({
    publicVisible: true,
    isAdmin: false,
    loading: false,
  }),
  'allowed_public',
)
assert.equal(
  resolvePublicServiceAccess({
    publicVisible: true,
    isAdmin: true,
    loading: false,
  }),
  'allowed_public',
)

// Fail closed while loading — never leak content before is_admin settles
assert.equal(
  resolvePublicServiceAccess({
    publicVisible: true,
    isAdmin: false,
    loading: true,
  }),
  'loading',
)
assert.equal(
  resolvePublicServiceAccess({
    publicVisible: false,
    isAdmin: true,
    loading: true,
  }),
  'loading',
)

// Settings unavailable: non-admin denied; admin may preview
assert.equal(
  resolvePublicServiceAccess({
    publicVisible: false,
    isAdmin: false,
    loading: false,
    settingsUnavailable: true,
  }),
  'denied',
)
assert.equal(
  resolvePublicServiceAccess({
    publicVisible: false,
    isAdmin: true,
    loading: false,
    settingsUnavailable: true,
  }),
  'allowed_admin_preview',
)

// Public visibility must be strict true (not truthy coercion from helpers)
assert.equal(PUBLIC_SERVICE_SETTING_KEY.interiors, 'interiors_public_visible')
assert.equal(PUBLIC_SERVICE_SETTING_KEY.lrc, 'lrc_public_visible')
assert.equal(PUBLIC_SERVICE_SETTING_KEY.webAtelier, 'web_atelier_public_visible')

const services: PublicService[] = ['interiors', 'lrc', 'webAtelier']
for (const service of services) {
  assert.ok(DEPARTMENT_PREVIEW_LINKS[service].length >= 1)
  for (const link of DEPARTMENT_PREVIEW_LINKS[service]) {
    assert.ok(link.path.startsWith('/'), `path ${link.path}`)
  }
}

// --- Source contracts ---
const guard = readFileSync(join(root, 'src/components/PublicServiceGuard.tsx'), 'utf8')
const app = readFileSync(join(root, 'src/App.tsx'), 'utf8')
const adminNav = readFileSync(join(root, 'src/components/AdminNav.tsx'), 'utf8')
const previewPage = readFileSync(join(root, 'src/pages/AdminSitePreviewPage.tsx'), 'utf8')
const pageSeo = readFileSync(join(root, 'src/components/PageSEO.tsx'), 'utf8')
const adminAuth = readFileSync(join(root, 'src/providers/AdminAuthProvider.tsx'), 'utf8')
const robots = readFileSync(join(root, 'public/robots.txt'), 'utf8')
const sitemap = readFileSync(join(root, 'public/sitemap.xml'), 'utf8')

assert.match(guard, /useAdminAuth/)
assert.match(guard, /resolvePublicServiceAccess/)
assert.match(guard, /AdminPreviewBanner/)
assert.match(guard, /interiors/)
assert.doesNotMatch(guard, /admin=true/)
assert.doesNotMatch(guard, /localStorage/)

assert.match(adminAuth, /rpc\(['"]is_admin['"]\)/)
assert.match(adminAuth, /data === true/)

assert.match(app, /service="interiors"/)
assert.match(app, /path="\/interijeri"/)
assert.match(app, /path="klijenti"/)
assert.match(app, /path="stolari"/)
assert.match(app, /path="\/cjenici\/interijeri"/)
assert.match(app, /service="lrc"/)
assert.match(app, /service="webAtelier"/)
assert.match(app, /path="upit"/)
assert.match(app, /path="demo\/:slug"/)
assert.match(app, /AdminSitePreviewPage/)
assert.match(app, /path="preview"/)

assert.match(adminNav, /Pregled stranice/)
assert.match(adminNav, /\/admin\/preview/)
assert.match(previewPage, /Pregled stranice/)
assert.match(previewPage, /stvarna produkcijska/)

assert.match(pageSeo, /useAdminDepartmentPreview/)
assert.match(pageSeo, /effectiveNoIndex/)

assert.match(robots, /Disallow:\s*\/admin\//)
assert.match(sitemap, /anislrc\.hr\/interijeri/)
assert.doesNotMatch(sitemap, /\/lrc/)
assert.doesNotMatch(sitemap, /web-atelier/)

// Interiors pages must not re-block admins with a local visibility gate
const interiorsPage = readFileSync(join(root, 'src/pages/InterijeriPage.tsx'), 'utf8')
assert.doesNotMatch(interiorsPage, /interiors_public_visible/)
const clientsPage = readFileSync(join(root, 'src/pages/InterijeriClientsPage.tsx'), 'utf8')
assert.doesNotMatch(clientsPage, /interiors_public_visible/)
const cjenik = readFileSync(join(root, 'src/pages/CjeniciInterijeriPage.tsx'), 'utf8')
assert.doesNotMatch(cjenik, /interiors_public_visible/)

console.log('test-admin-preview-access: PASS')
