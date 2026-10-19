/**
 * Unified public department visibility — listing surfaces + route guard invariants.
 * Does not flip production flags or call the network.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PUBLIC_SERVICE_SETTING_KEY,
  allPublicVisibilityCombinations,
  publicDepartmentVisibilityFromSettings,
  resolvePublicServiceAccess,
  type PublicDepartmentVisibility,
  type PublicService,
} from '../src/lib/publicServiceAccess.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

const SERVICES: PublicService[] = ['interiors', 'lrc', 'webAtelier']

// --- Fail closed when not ready ---
{
  const hidden = publicDepartmentVisibilityFromSettings(
    {
      interiors_public_visible: true,
      lrc_public_visible: true,
      web_atelier_public_visible: true,
    },
    { ready: false },
  )
  for (const s of SERVICES) assert.equal(hidden[s], false)

  const nullHidden = publicDepartmentVisibilityFromSettings(null, { ready: false })
  for (const s of SERVICES) assert.equal(nullHidden[s], false)
}

// --- Explicit true only ---
{
  const vis = publicDepartmentVisibilityFromSettings(
    {
      interiors_public_visible: true,
      lrc_public_visible: false,
      web_atelier_public_visible: false,
    },
    { ready: true },
  )
  assert.equal(vis.interiors, true)
  assert.equal(vis.lrc, false)
  assert.equal(vis.webAtelier, false)

  // undefined / missing → false (never default interiors on)
  const missing = publicDepartmentVisibilityFromSettings({}, { ready: true })
  for (const s of SERVICES) assert.equal(missing[s], false)
}

// --- All 8 combinations: toggling one flag must not change the other two ---
{
  const combos = allPublicVisibilityCombinations()
  assert.equal(combos.length, 8)

  for (const combo of combos) {
    const settings = {
      interiors_public_visible: combo.interiors,
      lrc_public_visible: combo.lrc,
      web_atelier_public_visible: combo.webAtelier,
    }
    const vis = publicDepartmentVisibilityFromSettings(settings, { ready: true })
    assert.deepEqual(vis, combo)

    for (const service of SERVICES) {
      const others = SERVICES.filter((s) => s !== service)
      const flipped: PublicDepartmentVisibility = {
        ...combo,
        [service]: !combo[service],
      }
      const flippedSettings = {
        interiors_public_visible: flipped.interiors,
        lrc_public_visible: flipped.lrc,
        web_atelier_public_visible: flipped.webAtelier,
      }
      const flippedVis = publicDepartmentVisibilityFromSettings(flippedSettings, {
        ready: true,
      })
      assert.equal(flippedVis[service], !combo[service])
      for (const o of others) {
        assert.equal(flippedVis[o], combo[o], `flip ${service} must not change ${o}`)
      }
    }
  }
}

// --- Route guard still fail-closed + admin preview independent of listing ---
{
  assert.equal(
    resolvePublicServiceAccess({
      publicVisible: false,
      isAdmin: true,
      loading: false,
    }),
    'allowed_admin_preview',
  )
  assert.equal(
    resolvePublicServiceAccess({
      publicVisible: false,
      isAdmin: false,
      loading: false,
    }),
    'denied',
  )
  assert.equal(
    resolvePublicServiceAccess({
      publicVisible: true,
      isAdmin: false,
      loading: true,
    }),
    'loading',
  )
}

// --- Wiring: public surfaces use central hook / helpers; no fail-open interiors default ---
{
  const hook = read('src/hooks/usePublicDepartmentVisibility.ts')
  assert.ok(hook.includes('publicDepartmentVisibilityFromSettings'))
  assert.ok(hook.includes('ready'))

  const surfaces = [
    'src/components/Header.tsx',
    'src/components/Footer.tsx',
    'src/components/BrandDescriptor.tsx',
    'src/components/AboutSection.tsx',
    'src/pages/ContactPage.tsx',
    'src/pages/CjeniciPage.tsx',
    'src/sections/WelcomeSection.tsx',
    'src/sections/PortfolioSection.tsx',
    'src/sections/TestimonialsSection.tsx',
  ]
  for (const path of surfaces) {
    const src = read(path)
    assert.ok(
      src.includes('usePublicDepartmentVisibility'),
      `${path} must use usePublicDepartmentVisibility`,
    )
    assert.equal(
      src.includes('interiors_public_visible ?? true'),
      false,
      `${path} must not fail-open interiors`,
    )
  }

  const cjenici = read('src/pages/CjeniciPage.tsx')
  assert.ok(cjenici.includes('visibility.ready') || cjenici.includes('!visibility.ready'))
  assert.ok(cjenici.includes('HUB_TO_SERVICE') || cjenici.includes('webAtelier'))

  const guard = read('src/components/PublicServiceGuard.tsx')
  assert.ok(guard.includes('resolvePublicServiceAccess'))
  assert.ok(guard.includes('allowed_admin_preview'))

  // Setting keys remain the only authority (no parallel flags)
  assert.equal(PUBLIC_SERVICE_SETTING_KEY.interiors, 'interiors_public_visible')
  assert.equal(PUBLIC_SERVICE_SETTING_KEY.lrc, 'lrc_public_visible')
  assert.equal(PUBLIC_SERVICE_SETTING_KEY.webAtelier, 'web_atelier_public_visible')
}

console.log('public department visibility tests: OK')
