/**
 * LRC product catalog: approved boxes, visibility, photos, and stored inquiries.
 * Does not call Supabase or change a database.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lrcInquiryCustomIdeaOption, sampleProducts } from '../src/data/products.ts'
import {
  APPROVED_LRC_CODES,
  approvedLrcProducts,
  averageRgbHex,
  edgePixels,
  lrcCoverPhoto,
  lrcDraftFromInput,
  lrcProductContent,
  lrcProductFromParts,
  lrcProductImageDirectUrl,
  lrcProductImageObjectPath,
  unusedLrcStorageObjectPaths,
  lrcPresentationInquirySummary,
  lrcPublishBlock,
  lrcStoredProductLabel,
  moveLrcPhoto,
  newLrcProductInsert,
  publicCatalogFromFetch,
  publicCatalogWhenUnconfigured,
  removeLrcPhoto,
  softenLrcFrame,
  visibleLrcProducts,
  withLrcCover,
  type LrcProductInput,
} from '../src/lib/lrcCatalog.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

const approved = approvedLrcProducts()
assert.deepEqual(
  approved.map((product) => product.code),
  [...APPROVED_LRC_CODES],
)
assert.equal(approved.every((product) => product.isVisible), true)

for (const product of approved) {
  const parsed = lrcProductFromParts(
    product.code,
    product.isVisible,
    product.sortOrder,
    lrcProductContent(product),
  )
  assert.deepEqual(parsed, product)
}

const hidden = approved.map((product) =>
  product.code === 'LRC-VIN-03' ? { ...product, isVisible: false } : product,
)
assert.deepEqual(
  visibleLrcProducts(hidden).map((product) => product.code),
  ['LRC-BAB-03', 'LRC-VIN-02'],
)

const catalogOnly = publicCatalogFromFetch({
  ok: true,
  products: visibleLrcProducts(hidden),
})
assert.equal(catalogOnly.status, 'ready')
if (catalogOnly.status === 'ready') {
  assert.equal(catalogOnly.source, 'catalog')
  assert.deepEqual(
    catalogOnly.products.map((product) => product.code),
    ['LRC-BAB-03', 'LRC-VIN-02'],
  )
}

const missingTable = publicCatalogFromFetch({
  ok: false,
  error: {
    code: 'PGRST205',
    message: "Could not find the table 'public.lrc_products' in the schema cache",
  },
})
assert.equal(missingTable.status, 'ready')
if (missingTable.status === 'ready') {
  assert.equal(missingTable.source, 'fallback')
  assert.deepEqual(
    missingTable.products.map((product) => product.code),
    [...APPROVED_LRC_CODES],
  )
}

const failedFetch = publicCatalogFromFetch({ ok: false, error: { message: 'Failed to fetch' } })
assert.equal(failedFetch.status, 'error')
assert.equal(failedFetch.products.length, 0)

const unconfigured = publicCatalogWhenUnconfigured()
assert.equal(unconfigured.status, 'ready')
if (unconfigured.status === 'ready') assert.equal(unconfigured.source, 'fallback')

const input: LrcProductInput = {
  code: 'lrc-new-01',
  sortOrder: '4',
  retailPrice: '19,5',
  basePrice: '19.50',
  basePriceDate: '24. 11. 2026.',
  titleHr: 'Nova kutija',
  titleEn: 'New box',
  specsHr: '',
  specsEn: '',
  descriptionHr: '',
  descriptionEn: '',
  photos: [],
}
const created = lrcDraftFromInput(input)
assert.equal(created.ok, true)
if (created.ok) {
  assert.equal(newLrcProductInsert(created.draft).is_visible, false)
  assert.equal(created.draft.code, 'LRC-NEW-01')
  assert.equal(created.draft.retailPriceEuro, 19.5)
}
assert.equal(lrcDraftFromInput({ ...input, code: 'kutija' }).ok, false)
assert.equal(lrcDraftFromInput(input, { visible: true }).ok, false)
const blocked = approved[0]
assert.equal(lrcPublishBlock({ ...blocked, photos: [] }), 'Dodaj barem jednu fotografiju i spremi proizvod prije javne objave.')

const photos = approved[1].photos.map((photo) => ({ ...photo, alt: { ...photo.alt }, caption: { ...photo.caption } }))
const marked = withLrcCover(photos, 2)
assert.equal(lrcCoverPhoto(marked)?.src, photos[2].src)
const moved = moveLrcPhoto(marked, 2, -1)
assert.equal(moved[1].src, photos[2].src)
assert.equal(lrcCoverPhoto(moved)?.src, photos[2].src)
const removed = removeLrcPhoto(marked, 2)
assert.equal(lrcCoverPhoto(removed)?.src, photos[0].src)
assert.equal(lrcProductImageObjectPath(photos[0].src), null)
assert.equal(
  lrcProductImageObjectPath(
    'https://example.supabase.co/storage/v1/object/public/lrc-product-images/LRC-NEW-01/file.webp?v=1',
  ),
  'LRC-NEW-01/file.webp',
)
assert.equal(
  lrcProductImageObjectPath('http://127.0.0.1:54421/functions/v1/lrc-product-image/LRC-NEW-01/file.webp'),
  'LRC-NEW-01/file.webp',
)
assert.equal(
  lrcProductImageDirectUrl('http://127.0.0.1:54421/', 'LRC-NEW-01/file.webp'),
  'http://127.0.0.1:54421/functions/v1/lrc-product-image/LRC-NEW-01/file.webp',
)
assert.equal(lrcProductImageObjectPath('/lrc_image/proizvodi/slike/lrc-bab-03-01-zatvorena.webp'), null)

const width = 3
const height = 1
const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255])
assert.deepEqual(edgePixels(width, height, rgba), [
  [255, 0, 0],
  [0, 0, 255],
])
assert.equal(averageRgbHex(edgePixels(width, height, rgba)), '#800080')
const clearLeft = new Uint8ClampedArray([255, 0, 0, 0, 0, 0, 255, 255])
assert.deepEqual(edgePixels(2, 1, clearLeft), [[0, 0, 255]])
assert.equal(softenLrcFrame('#cec0bc'), '#daccc8')

const stored = lrcPresentationInquirySummary(
  approved.find((product) => product.code === 'LRC-VIN-03')!,
  'hr',
)
const legacy = {
  [lrcInquiryCustomIdeaOption.id]: {
    hr: lrcInquiryCustomIdeaOption.nameHr,
    en: lrcInquiryCustomIdeaOption.name,
  },
  ...Object.fromEntries(sampleProducts.map((product) => [product.id, { hr: product.nameHr, en: product.name }])),
}
assert.equal(lrcStoredProductLabel(stored, 'hr', legacy), stored)
assert.equal(visibleLrcProducts(hidden).some((product) => stored.includes(product.code) && product.code === 'LRC-VIN-03'), false)
assert.match(stored, /LRC-VIN-03/)
assert.match(stored, /22,00 €/)
assert.equal(lrcStoredProductLabel('1', 'hr', legacy), 'Set podmetača od epoksidne smole')
assert.equal(lrcStoredProductLabel('custom-idea', 'en', legacy), 'I have my own idea / a new product')

const sharedSrc = 'http://127.0.0.1:54421/storage/v1/object/public/lrc-product-images/LRC-TEST-01/shared.webp'
const onlySrc = 'http://127.0.0.1:54421/storage/v1/object/public/lrc-product-images/LRC-TEST-01/only.webp?v=1'
const staticSrc = '/lrc_image/proizvodi/slike/lrc-bab-03-01-zatvorena.webp'
const productsAfterSave = [
  { photos: [{ src: sharedSrc }] },
  { photos: [{ src: staticSrc }] },
]
assert.deepEqual(
  unusedLrcStorageObjectPaths([sharedSrc, onlySrc, staticSrc, onlySrc], productsAfterSave),
  ['LRC-TEST-01/only.webp'],
)
assert.deepEqual(unusedLrcStorageObjectPaths([onlySrc], []), ['LRC-TEST-01/only.webp'])
assert.deepEqual(removeLrcPhoto([{ src: onlySrc, alt: { hr: '', en: '' }, caption: { hr: '', en: '' }, frame: '#d8cfc8' }], 0), [])

const migration = read('supabase/migrations/20261124000000_lrc_product_catalog.sql')
assert.match(migration, /is_visible boolean not null default false/)
assert.match(migration, /grant insert, update on public\.lrc_products to authenticated/)
assert.doesNotMatch(migration, /grant delete/i)
assert.match(migration, /Admins read all LRC products/)
assert.match(migration, /Read visible LRC products/)
assert.doesNotMatch(migration, /webshop|cart/i)
for (const product of approved) {
  assert.match(migration, new RegExp(`'${product.code}',true,${product.sortOrder}`))
  for (const photo of product.photos) {
    assert.ok(migration.includes(photo.src), photo.src)
    assert.ok(migration.includes(photo.alt.hr), photo.alt.hr)
  }
  assert.ok(migration.includes(product.title.hr))
  assert.ok(migration.includes(product.description.hr))
}

const productDelete = read('supabase/migrations/20261124230000_lrc_product_delete.sql')
assert.match(productDelete, /grant delete on public\.lrc_products to authenticated/)
assert.match(productDelete, /Admins delete LRC products/)
assert.match(productDelete, /is_admin\(\)/)
assert.match(productDelete, /Do not apply this migration to production/)
assert.doesNotMatch(productDelete, /(?:update|delete|drop)\s+(?:from\s+)?public\.lrc_inquiries/i)

const storage = read('supabase/migrations/20261124010000_lrc_product_images.sql')
assert.match(storage, /lrc-product-images/)
assert.match(storage, /is_admin\(\)/)
assert.match(storage, /image\/webp/)
assert.match(storage, /Do not apply this migration to production/)
assert.doesNotMatch(storage, /lrc-bab-03/)

const privateImages = read('supabase/migrations/20261125010000_lrc_product_images_private.sql')
assert.match(privateImages, /set public = false/)
assert.match(privateImages, /lrc_product_image_is_public/)
assert.match(privateImages, /lrc_product_image_is_allowed/)
assert.match(privateImages, /grant execute on function public\.lrc_product_image_is_allowed\(text, uuid\) to service_role/)
assert.match(privateImages, /Do not apply this migration to production/)
assert.doesNotMatch(privateImages, /lrc_inquiries|lrc-bab-03|createSignedUrl|sign\(/)
const imageFunction = read('supabase/functions/lrc-product-image/index.ts')
assert.match(imageFunction, /lrc_product_image_is_allowed/)
assert.match(imageFunction, /private, no-store/)
assert.doesNotMatch(imageFunction, /createSignedUrl|\/object\/sign\//)

const cards = read('src/components/LrcPresentationCards.tsx')
const form = read('src/components/LRCInquiryForm.tsx')
const section = read('src/components/LRCSection.tsx')
const inquiries = read('src/pages/AdminLrcInquiriesPage.tsx')
const adminPage = read('src/pages/AdminLrcProductsPage.tsx')
const nav = read('src/components/AdminNav.tsx')
const app = read('src/App.tsx')
const api = read('src/lib/lrcCatalogApi.ts')
const frameFile = read('src/lib/lrcPhotoFrame.ts')
const label = read('src/lib/lrcInquiryLabel.ts')

assert.match(cards, /usePublicLrcProducts/)
assert.match(cards, /object-contain/)
assert.match(cards, /Pogledaj detalje/)
assert.doesNotMatch(cards, /object-cover/)
assert.doesNotMatch(cards, /LRC_PRESENTATION_PRODUCTS/)
assert.doesNotMatch(cards, /Otvori webshop/)
assert.match(form, /usePublicLrcProducts/)
assert.match(form, /lrcPresentationInquirySummary/)
assert.doesNotMatch(form, /LRC_PRESENTATION_PRODUCTS/)
assert.match(section, /const SHOW_LEGACY_LRC_CATALOG = false/)
assert.match(inquiries, /lrcInquiryProductLabel/)
assert.doesNotMatch(inquiries, /fetchAdminLrcProducts|fetchPublicLrcProducts/)
assert.match(label, /sampleProducts/)
assert.match(label, /lrcStoredProductLabel/)
assert.match(nav, /'Proizvodi', '\/admin\/lrc-products'[\s\S]*'LRC upiti', '\/admin\/lrc-inquiries'/)
assert.match(app, /path="lrc-products"/)
assert.doesNotMatch(app, /path="\/(?:cart|checkout|kosarica)"/)
assert.match(adminPage, /EyeOff/)
assert.match(adminPage, /createLrcProduct/)
assert.match(adminPage, /setLrcProductVisibility/)
assert.match(adminPage, /Trajno izbriši proizvod/)
assert.match(adminPage, /deleteLrcProduct\(editor\.code\)/)
assert.match(adminPage, /deleteUnusedLrcProductImages\(removedSrcs, rows\)/)
assert.match(adminPage, /deleteUnusedLrcProductImages\(candidates, rows\)/)
assert.doesNotMatch(adminPage, /deleteLrcProductImage/)
assert.match(adminPage, /object-contain/)
assert.match(adminPage, /LrcAdminProductImage/)
assert.doesNotMatch(adminPage, /<img src=\{(?:cover|photo)\.src\}/)
assert.match(api, /frameColorFromImageFile/)
assert.match(api, /lrcProductImageDirectUrl/)
assert.match(api, /loadLrcAdminImage/)
assert.doesNotMatch(api, /getPublicUrl/)
assert.match(api, /\.upload\(objectPath, file/)
assert.match(api, /newLrcProductInsert/)
assert.match(api, /is_visible !== false/)
assert.doesNotMatch(api, /toBlob|toDataURL/)
assert.match(frameFile, /drawImage/)
assert.doesNotMatch(frameFile, /toBlob|toDataURL/)
assert.doesNotMatch(read('src/lib/lrcWebshop.ts'), /lrc_products/)
assert.doesNotMatch(read('src/lib/cart.ts'), /lrcCatalog/)

console.log('lrc catalog: ok')
