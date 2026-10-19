// F2.10 contract tests — no network. Ensures premium UX keeps pricing + visibility gates.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  calculateConfiguratorEstimate,
  emptyConfiguratorSelection,
} from '../src/lib/webAtelierConfigurator.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const section = readFileSync(join(root, 'src/components/WebAtelierSection.tsx'), 'utf8')
const configurator = readFileSync(join(root, 'src/components/WebAtelierConfigurator.tsx'), 'utf8')
const page = readFileSync(join(root, 'src/pages/WebAtelierPage.tsx'), 'utf8')
const inquiry = readFileSync(join(root, 'src/pages/WebAtelierInquiryPage.tsx'), 'utf8')
const settings = readFileSync(join(root, 'src/hooks/useSettings.ts'), 'utf8')
const sitemap = readFileSync(join(root, 'public/sitemap.xml'), 'utf8')
const robots = readFileSync(join(root, 'public/robots.txt'), 'utf8')

assert.match(section, /wa-prem-hero/)
assert.match(section, /Pošalji upit|Send inquiry/)
assert.match(section, /#web-atelier-configurator/)
assert.match(section, /Tri različita koraka|Three distinct steps/)
assert.doesNotMatch(section, /garancija rangiranja|unlimited revisions|besplatno hosting/i)

assert.match(configurator, /wa-cfg-progress/)
assert.match(configurator, /calculateConfiguratorEstimate/)
assert.match(configurator, /writeStoredConfiguratorSelection/)
assert.match(configurator, /ConfigStep/)

assert.match(page, /noIndex/)
assert.match(inquiry, /noIndex/)
assert.match(inquiry, /PublicConsultationBooking/)
assert.match(inquiry, /web-atelier-booking/)

assert.match(settings, /web_atelier_public_visible:\s*false/)
assert.doesNotMatch(sitemap, /web-atelier/)
assert.doesNotMatch(robots, /Allow:.*web-atelier/i)

const base = emptyConfiguratorSelection()
const withPro = calculateConfiguratorEstimate({
  ...base,
  packageId: 'pro',
  addons: { extra_page: 1 },
})
assert.ok((withPro.estimateFloorEur ?? 0) > 0)
assert.equal(withPro.selection.packageId, 'pro')

console.log('web-atelier premium UX contract tests passed')
