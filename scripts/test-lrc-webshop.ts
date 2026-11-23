/**
 * LRC webshop switch: off by default, cart storage untouched, HTTPS link only.
 * Does not call Supabase or change production settings.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CART_STORAGE_KEYS,
  LRC_WEBSHOP_PREVIEW_KEY,
  isLrcWebshopEnabled,
  readLrcWebshopPreview,
  removeLrcWebshopPreview,
  resolveLrcWebshopState,
  resolveLrcWebshopUrl,
  writeLrcWebshopPreview,
  type LrcWebshopStorage,
} from '../src/lib/lrcWebshop.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

class MemoryStorage implements LrcWebshopStorage {
  private readonly values = new Map<string, string>()
  getItem(key: string) {
    return this.values.has(key) ? this.values.get(key)! : null
  }
  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
  removeItem(key: string) {
    this.values.delete(key)
  }
}

assert.equal(isLrcWebshopEnabled(undefined), false)
assert.equal(isLrcWebshopEnabled(null), false)
assert.equal(isLrcWebshopEnabled(false), false)
assert.equal(isLrcWebshopEnabled(true), true)

const unloaded = resolveLrcWebshopState({
  settingsReady: false,
  serverEnabled: true,
  serverUrl: 'https://shop.example',
  preview: { enabled: true, url: 'https://shop.example' },
})
assert.equal(unloaded.enabled, false)
assert.equal(unloaded.webshopUrl, null)

const off = resolveLrcWebshopState({
  settingsReady: true,
  serverEnabled: false,
  serverUrl: 'https://shop.example',
  preview: null,
})
assert.equal(off.enabled, false)
assert.equal(off.webshopUrl, null)

const onWithoutUrl = resolveLrcWebshopState({
  settingsReady: true,
  serverEnabled: true,
  serverUrl: null,
  preview: null,
})
assert.equal(onWithoutUrl.enabled, true)
assert.equal(onWithoutUrl.webshopUrl, null)

const onWithHttps = resolveLrcWebshopState({
  settingsReady: true,
  serverEnabled: true,
  serverUrl: 'https://shop.example/lrc',
  preview: null,
})
assert.equal(onWithHttps.webshopUrl, 'https://shop.example/lrc')
assert.equal(resolveLrcWebshopUrl(true, 'http://shop.example'), null)
assert.equal(resolveLrcWebshopUrl(true, 'https://user:pass@shop.example'), null)
assert.equal(resolveLrcWebshopUrl(false, 'https://shop.example'), null)

const localOn = resolveLrcWebshopState({
  settingsReady: true,
  serverEnabled: false,
  serverUrl: null,
  preview: { enabled: true, url: 'http://not-secure.example' },
})
assert.equal(localOn.enabled, true)
assert.equal(localOn.webshopUrl, null)
assert.equal(localOn.localPreview, true)

const storage = new MemoryStorage()
storage.setItem('cart', '[{"id":"1"}]')
storage.setItem('anis_cart_v1', '[{"id":"box"}]')
writeLrcWebshopPreview(storage, { enabled: true, url: 'https://shop.example' })
assert.equal(storage.getItem('cart'), '[{"id":"1"}]')
assert.equal(storage.getItem('anis_cart_v1'), '[{"id":"box"}]')
assert.deepEqual(readLrcWebshopPreview(storage), {
  enabled: true,
  url: 'https://shop.example',
})
writeLrcWebshopPreview(storage, { enabled: false, url: null })
assert.equal(storage.getItem('cart'), '[{"id":"1"}]')
assert.equal(storage.getItem('anis_cart_v1'), '[{"id":"box"}]')
removeLrcWebshopPreview(storage)
assert.equal(storage.getItem(LRC_WEBSHOP_PREVIEW_KEY), null)
assert.equal(storage.getItem('cart'), '[{"id":"1"}]')
for (const key of CART_STORAGE_KEYS) {
  assert.equal(storage.getItem(key) === null ? key : key, key)
}

const header = read('src/components/Header.tsx')
const section = read('src/components/LRCSection.tsx')
const cards = read('src/components/LrcPresentationCards.tsx')
const app = read('src/App.tsx')
const admin = read('src/pages/AdminSettingsPage.tsx')
const migration = read('supabase/review/lrc_webshop_settings.sql')

assert.match(header, /showCart \? <button/)
assert.match(header, /showCart = false/)
assert.match(section, /webshopEnabled \?/)
assert.match(section, /Pogledaj detalje|inquiryPath/)
assert.match(cards, /Pogledaj detalje/)
assert.match(cards, /Otvori webshop/)
assert.match(cards, /webshopUrl \?/)
assert.doesNotMatch(app, /path="\/(?:cart|checkout|kosarica)"/)
assert.match(app, /isOpen=\{isCartOpen && webshopEnabled\}/)
assert.match(admin, /aria-label="LRC webshop"/)
assert.doesNotMatch(admin, /lrc_webshop_enabled[\s\S]{0,80}lrc_public_visible/)
assert.match(migration, /add column if not exists lrc_webshop_enabled boolean not null default false/)
assert.match(migration, /Do not apply this migration to production/)

console.log('lrc webshop switch: ok')
