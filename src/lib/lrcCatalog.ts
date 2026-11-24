export type LrcLanguage = 'hr' | 'en'

export interface LrcLocalizedText {
  hr: string
  en: string
}

export interface LrcCatalogPhoto {
  src: string
  alt: LrcLocalizedText
  caption: LrcLocalizedText
  /** Boja ruba fotografije. Okvir izvan kadra koristi istu nijansu. */
  frame: string
  /** Jedna fotografija može biti naslovna bez obzira na redoslijed. */
  cover?: boolean
}

export interface LrcProduct {
  code: string
  isVisible: boolean
  sortOrder: number
  retailPriceEuro: number
  basePriceEuro: number
  basePriceDate: string
  title: LrcLocalizedText
  specs: LrcLocalizedText
  description: LrcLocalizedText
  photos: LrcCatalogPhoto[]
}

export interface LrcProductDraft {
  code: string
  sortOrder: number
  retailPriceEuro: number
  basePriceEuro: number
  basePriceDate: string
  title: LrcLocalizedText
  specs: LrcLocalizedText
  description: LrcLocalizedText
  photos: LrcCatalogPhoto[]
}

export interface LrcProductInput {
  code: string
  sortOrder: string
  retailPrice: string
  basePrice: string
  basePriceDate: string
  titleHr: string
  titleEn: string
  specsHr: string
  specsEn: string
  descriptionHr: string
  descriptionEn: string
  photos: LrcCatalogPhoto[]
}

export type LrcDraftResult = { ok: true; draft: LrcProductDraft } | { ok: false; error: string }

export interface LrcProductInsert {
  code: string
  is_visible: false
  sort_order: number
  content: Record<string, unknown>
}

export type PublicLrcCatalogResult =
  | { status: 'ready'; source: 'catalog' | 'fallback'; products: LrcProduct[] }
  | { status: 'error'; products: LrcProduct[] }

export const LRC_PRODUCT_CODE = /^LRC-[A-Z0-9]+(-[A-Z0-9]+)+$/
export const LRC_FRAME_COLOR = /^#[0-9a-fA-F]{6}$/
export const LRC_FRAME_FALLBACK = '#d8cfc8'
export const APPROVED_LRC_CODES = ['LRC-BAB-03', 'LRC-VIN-02', 'LRC-VIN-03'] as const

const IMAGE_BASE = '/lrc_image/proizvodi/slike'

function photo(
  file: string,
  altHr: string,
  altEn: string,
  frame: string,
  captionHr = '',
  captionEn = '',
): LrcCatalogPhoto {
  return {
    src: `${IMAGE_BASE}/${file}`,
    alt: { hr: altHr, en: altEn },
    caption: { hr: captionHr, en: captionEn },
    frame,
  }
}

const APPROVED_LRC_CONTENT: readonly Omit<LrcProduct, 'isVisible' | 'sortOrder'>[] = [
  {
    code: 'LRC-BAB-03',
    retailPriceEuro: 25,
    basePriceEuro: 25,
    basePriceDate: '10. 9. 2026.',
    title: {
      hr: 'Personalizirana kutija uspomena za bebe',
      en: 'Personalized baby memory box',
    },
    specs: {
      hr: '350 × 110 × 112 mm · bijeli MDF, 3 mm',
      en: '350 × 110 × 112 mm · white MDF, 3 mm',
    },
    description: {
      hr: 'Kutija s unutarnjim pregradama i prigodnom gravurom s imenom i podacima o rođenju, prema želji kupca. U nju, primjerice, stanu dva bodija veličine 3–6 mjeseci, mala igračka i prve cipelice. Kutija se prodaje prazna, a uspomene koje ćeš u nju staviti biraš samostalno.',
      en: 'A box with interior dividers and an engraving of the name and birth details, as you wish. It can hold, for example, two bodysuits in size 3–6 months, a small toy, and the first shoes. The box is sold empty, and you choose the keepsakes yourself.',
    },
    photos: [
      photo(
        'lrc-bab-03-01-zatvorena.webp',
        'Zatvorena bijela kutija uspomena za bebe s motivom medvjedića i oglednim imenom Lana',
        'Closed white baby memory box with a teddy-bear motif and the sample name Lana',
        '#cec0bc',
        'Ogledni prikaz s izmišljenim podacima.',
        'Sample view with fictional details.',
      ),
      photo(
        'lrc-bab-03-02-primjer-sadrzaja.webp',
        'Otvorena kutija s pregradama, dvama bodijima, plišanom igračkom i prvim cipelicama',
        'Open box with dividers, two bodysuits, a plush toy, and first shoes',
        '#d3c2bc',
        'Primjer korištenja. Kutija se prodaje prazna. Prikazana odjeća, igračka i cipelice nisu uključene u cijenu.',
        'Example of use. The box is sold empty. The clothing, toy, and shoes shown are not included in the price.',
      ),
      photo(
        'lrc-bab-03-03-primjer-za-djecaka.webp',
        'Zatvorena kutija snimljena sprijeda, s motivom medvjedića i oglednim imenom Lovro',
        'Closed box photographed from the front, with a teddy-bear motif and the sample name Lovro',
        '#d8c6c2',
        'Ogledni prikaz s izmišljenim podacima.',
        'Sample view with fictional details.',
      ),
    ],
  },
  {
    code: 'LRC-VIN-02',
    retailPriceEuro: 25,
    basePriceEuro: 25,
    basePriceDate: '10. 9. 2026.',
    title: {
      hr: 'Personalizirana poklon kutija za bocu od 0,75 l',
      en: 'Personalized gift box for a 0.75 L bottle',
    },
    specs: {
      hr: '350 × 110 × 112 mm · bijeli MDF, 3 mm',
      en: '350 × 110 × 112 mm · white MDF, 3 mm',
    },
    description: {
      hr: 'Poklon kutija s kliznim poklopcem za jednu bocu od 0,75 l odgovarajućeg oblika. U cijenu je uključena gravura po želji. Na poklopac možemo ugravirati portret prema tvojoj fotografiji, posvetu ili oboje. Boca nije uključena.',
      en: 'A gift box with a sliding lid for one 0.75 L bottle of a suitable shape. Engraving to your wishes is included. We can engrave a portrait from your photo, a dedication, or both on the lid. The bottle is not included.',
    },
    photos: [
      photo(
        'lrc-vin-02-03-digitalni-primjer-gravure.webp',
        'Digitalni primjer gravure portreta para i posvete na poklopcu',
        'Digital example of an engraved couple portrait and dedication on the lid',
        '#cab5aa',
        'Digitalni primjer gravure portreta prema fotografiji.',
        'Digital example of a portrait engraving from a photograph.',
      ),
      photo(
        'lrc-vin-02-01-zatvorena.webp',
        'Zatvorena bijela poklon kutija za bocu od 0,75 l s kliznim poklopcem i ručkom',
        'Closed white gift box for a 0.75 L bottle, with a sliding lid and a handle',
        '#cbb8ae',
      ),
      photo(
        'lrc-vin-02-02-unutrasnjost.webp',
        'Otvorena prazna kutija od 0,75 l s vidljivim držačima za bocu',
        'Open empty 0.75 L box with the bottle holders visible',
        '#cdb9ae',
      ),
      photo(
        'lrc-vin-usporedba-05-i-075.webp',
        'Dvije bijele kutije za boce, manja lijevo i veća desno',
        'Two white bottle boxes, the smaller on the left and the larger on the right',
        '#c4b1a8',
        'Lijevo kutija za bocu od 0,5 l, desno kutija za bocu od 0,75 l.',
        'Left: box for a 0.5 L bottle. Right: box for a 0.75 L bottle.',
      ),
    ],
  },
  {
    code: 'LRC-VIN-03',
    retailPriceEuro: 22,
    basePriceEuro: 22,
    basePriceDate: '1. 11. 2026.',
    title: {
      hr: 'Personalizirana poklon kutija za bocu likera od 0,5 l',
      en: 'Personalized gift box for a 0.5 L liqueur bottle',
    },
    specs: {
      hr: '250 × 110 × 112 mm · bijeli MDF, 3 mm',
      en: '250 × 110 × 112 mm · white MDF, 3 mm',
    },
    description: {
      hr: 'Poklon kutija s kliznim poklopcem za jednu bocu likera od 0,5 l odgovarajućeg oblika, primjerice teranina. U cijenu je uključena gravura po želji. Boca nije uključena.',
      en: 'A gift box with a sliding lid for one 0.5 L liqueur bottle of a suitable shape, such as teranino. Engraving to your wishes is included. The bottle is not included.',
    },
    photos: [
      photo(
        'lrc-vin-03-03-digitalni-primjer-gravure.webp',
        'Digitalni primjer gravure ženskog portreta i natpisa Sretan rođendan na manjoj kutiji',
        'Digital example of an engraved female portrait and the words Happy birthday on the smaller box',
        '#c8b5ae',
        'Digitalni primjer rođendanske gravure s izmišljenim portretom.',
        'Digital example of a birthday engraving with a fictional portrait.',
      ),
      photo(
        'lrc-vin-03-01-zatvorena.webp',
        'Zatvorena manja bijela poklon kutija za bocu likera od 0,5 l',
        'Closed smaller white gift box for a 0.5 L liqueur bottle',
        '#c8b5ac',
      ),
      photo(
        'lrc-vin-03-02-unutrasnjost.webp',
        'Otvorena prazna manja kutija s podignutim poklopcem i držačem za bocu',
        'Open empty smaller box with the lid raised and a bottle holder',
        '#cab3a8',
      ),
      photo(
        'lrc-vin-usporedba-05-i-075.webp',
        'Dvije bijele kutije za boce, manja lijevo i veća desno',
        'Two white bottle boxes, the smaller on the left and the larger on the right',
        '#c4b1a8',
        'Lijevo kutija za bocu od 0,5 l, desno kutija za bocu od 0,75 l.',
        'Left: box for a 0.5 L bottle. Right: box for a 0.75 L bottle.',
      ),
    ],
  },
]

export function copyLrcPhoto(photoItem: LrcCatalogPhoto): LrcCatalogPhoto {
  return {
    src: photoItem.src,
    alt: { hr: photoItem.alt.hr, en: photoItem.alt.en },
    caption: { hr: photoItem.caption.hr, en: photoItem.caption.en },
    frame: photoItem.frame,
    ...(photoItem.cover ? { cover: true } : {}),
  }
}

export function approvedLrcProducts(): LrcProduct[] {
  return APPROVED_LRC_CONTENT.map((product, index) => ({
    code: product.code,
    isVisible: true,
    sortOrder: index + 1,
    retailPriceEuro: product.retailPriceEuro,
    basePriceEuro: product.basePriceEuro,
    basePriceDate: product.basePriceDate,
    title: { ...product.title },
    specs: { ...product.specs },
    description: { ...product.description },
    photos: product.photos.map(copyLrcPhoto),
  }))
}

export function sortLrcProducts(products: readonly LrcProduct[]): LrcProduct[] {
  return [...products].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
  )
}

export function visibleLrcProducts(products: readonly LrcProduct[]): LrcProduct[] {
  return sortLrcProducts(products.filter((product) => product.isVisible))
}

export function lrcCoverPhoto(photos: readonly LrcCatalogPhoto[]): LrcCatalogPhoto | null {
  if (photos.length === 0) return null
  return photos.find((item) => item.cover) ?? photos[0]
}

export function lrcCoverIndex(photos: readonly LrcCatalogPhoto[]): number {
  const index = photos.findIndex((item) => item.cover)
  return index >= 0 ? index : 0
}

export function withLrcCover(photos: readonly LrcCatalogPhoto[], index: number): LrcCatalogPhoto[] {
  if (index < 0 || index >= photos.length) return photos.map(copyLrcPhoto)
  return photos.map((item, photoIndex) => {
    const next = copyLrcPhoto(item)
    if (photoIndex === index) next.cover = true
    else delete next.cover
    return next
  })
}

export function moveLrcPhoto(
  photos: readonly LrcCatalogPhoto[],
  index: number,
  direction: -1 | 1,
): LrcCatalogPhoto[] {
  const target = index + direction
  if (index < 0 || index >= photos.length || target < 0 || target >= photos.length) {
    return photos.map(copyLrcPhoto)
  }
  const next = photos.map(copyLrcPhoto)
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

export function removeLrcPhoto(photos: readonly LrcCatalogPhoto[], index: number): LrcCatalogPhoto[] {
  if (index < 0 || index >= photos.length) return photos.map(copyLrcPhoto)
  return photos.filter((_, photoIndex) => photoIndex !== index).map(copyLrcPhoto)
}

export function formatLrcEuro(amount: number): string {
  const [whole, fraction] = amount.toFixed(2).split('.')
  return `${whole},${fraction} €`
}

export function formatLrcPriceInput(amount: number): string {
  if (Number.isInteger(amount)) return String(amount)
  return amount.toFixed(2).replace('.', ',')
}

export function parseLrcPriceInput(value: string): number | null {
  const normalized = value.trim().replace(/\s+/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount > 100000) return null
  return amount
}

export function parseLrcSortOrder(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const order = Number(value.trim())
  if (!Number.isInteger(order) || order < 0 || order > 100000) return null
  return order
}

export function lrcPresentationInquirySummary(product: Pick<LrcProduct, 'code' | 'title' | 'retailPriceEuro'>, language: LrcLanguage): string {
  const price = formatLrcEuro(product.retailPriceEuro)
  const title = product.title[language]
  return language === 'hr'
    ? `${product.code} — ${title} — maloprodajna cijena ${price}`
    : `${product.code} — ${title} — retail price ${price}`
}

/** Stari upit čuva vlastiti tekst. Katalog se ne pita ponovo, pa skriveni proizvod ne briše zapis. */
export function lrcStoredProductLabel(
  stored: string,
  language: string,
  legacyNames: Readonly<Record<string, LrcLocalizedText>> = {},
): string {
  const legacy = legacyNames[stored]
  if (!legacy) return stored
  return language === 'hr' ? legacy.hr : legacy.en
}

export function softenLrcFrame(frame: string): string {
  const value = Number.parseInt(frame.slice(1), 16)
  if (!Number.isFinite(value)) return frame
  const channel = (shift: number) => Math.min(255, ((value >> shift) & 255) + 12)
  return `#${[channel(16), channel(8), channel(0)].map((part) => part.toString(16).padStart(2, '0')).join('')}`
}

export function lrcFrameStyle(frame: string): { backgroundColor: string; backgroundImage: string } {
  const edge = softenLrcFrame(frame)
  return {
    backgroundColor: frame,
    backgroundImage: `linear-gradient(90deg, ${edge} 0%, transparent 14%, transparent 86%, ${edge} 100%)`,
  }
}

export function averageRgbHex(samples: ReadonlyArray<readonly [number, number, number]>): string {
  if (samples.length === 0) return LRC_FRAME_FALLBACK
  let red = 0
  let green = 0
  let blue = 0
  for (const [r, g, b] of samples) {
    red += r
    green += g
    blue += b
  }
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value / samples.length)))
      .toString(16)
      .padStart(2, '0')
  return `#${channel(red)}${channel(green)}${channel(blue)}`
}

/** Lijevi i desni rub, bez sredine kadra. Prozirni pikseli se preskaču. */
export function edgePixels(
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
): Array<[number, number, number]> {
  const samples: Array<[number, number, number]> = []
  const take = (x: number, y: number) => {
    const offset = (y * width + x) * 4
    if ((rgba[offset + 3] ?? 0) < 16) return
    samples.push([rgba[offset] ?? 0, rgba[offset + 1] ?? 0, rgba[offset + 2] ?? 0])
  }
  for (let y = 0; y < height; y += 1) {
    take(0, y)
    if (width > 1) take(width - 1, y)
  }
  return samples
}

export function lrcProductImageObjectPath(src: string): string | null {
  const marker = '/lrc-product-images/'
  const index = src.indexOf(marker)
  if (index === -1) return null
  const path = decodeURIComponent(src.slice(index + marker.length).split('?')[0] ?? '')
  return path.length > 0 ? path : null
}

function localized(value: unknown): LrcLocalizedText | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.hr !== 'string' || typeof record.en !== 'string') return null
  return { hr: record.hr, en: record.en }
}

function parsePhoto(value: unknown): LrcCatalogPhoto | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.src !== 'string' || record.src.trim().length === 0) return null
  const alt = localized(record.alt)
  const caption = localized(record.caption) ?? { hr: '', en: '' }
  if (!alt) return null
  const frame = typeof record.frame === 'string' && LRC_FRAME_COLOR.test(record.frame)
    ? record.frame
    : LRC_FRAME_FALLBACK
  return {
    src: record.src,
    alt,
    caption,
    frame,
    ...(record.cover === true ? { cover: true } : {}),
  }
}

export function lrcProductFromParts(
  code: string,
  isVisible: boolean,
  sortOrder: number,
  content: unknown,
): LrcProduct | null {
  if (!LRC_PRODUCT_CODE.test(code)) return null
  if (!Number.isInteger(sortOrder) || sortOrder < 0) return null
  const body = typeof content === 'string' ? safeJson(content) : content
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  const title = localized(record.title)
  const specs = localized(record.specs)
  const description = localized(record.description)
  if (!title || !specs || !description) return null
  if (typeof record.retailPriceEuro !== 'number' || !Number.isFinite(record.retailPriceEuro)) return null
  if (typeof record.basePriceEuro !== 'number' || !Number.isFinite(record.basePriceEuro)) return null
  if (typeof record.basePriceDate !== 'string') return null
  if (!Array.isArray(record.photos)) return null
  const photos: LrcCatalogPhoto[] = []
  for (const item of record.photos) {
    const parsed = parsePhoto(item)
    if (!parsed) return null
    photos.push(parsed)
  }
  return {
    code,
    isVisible,
    sortOrder,
    retailPriceEuro: record.retailPriceEuro,
    basePriceEuro: record.basePriceEuro,
    basePriceDate: record.basePriceDate,
    title,
    specs,
    description,
    photos,
  }
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

export function lrcProductContent(draft: LrcProductDraft): Record<string, unknown> {
  return {
    retailPriceEuro: draft.retailPriceEuro,
    basePriceEuro: draft.basePriceEuro,
    basePriceDate: draft.basePriceDate,
    title: { hr: draft.title.hr, en: draft.title.en },
    specs: { hr: draft.specs.hr, en: draft.specs.en },
    description: { hr: draft.description.hr, en: draft.description.en },
    photos: draft.photos.map((item) => ({
      src: item.src,
      alt: { hr: item.alt.hr, en: item.alt.en },
      caption: { hr: item.caption.hr, en: item.caption.en },
      frame: item.frame,
      ...(item.cover ? { cover: true } : {}),
    })),
  }
}

export function newLrcProductInsert(draft: LrcProductDraft): LrcProductInsert {
  return {
    code: draft.code,
    is_visible: false,
    sort_order: draft.sortOrder,
    content: lrcProductContent(draft),
  }
}

export function lrcDraftFromInput(input: LrcProductInput, options?: { visible?: boolean }): LrcDraftResult {
  const code = input.code.trim().toUpperCase()
  if (!LRC_PRODUCT_CODE.test(code)) {
    return { ok: false, error: 'Šifra mora biti oblika LRC-BAB-03.' }
  }
  const sortOrder = parseLrcSortOrder(input.sortOrder)
  if (sortOrder === null) return { ok: false, error: 'Redoslijed mora biti cijeli broj od 0 naviše.' }
  const retailPriceEuro = parseLrcPriceInput(input.retailPrice)
  const basePriceEuro = parseLrcPriceInput(input.basePrice)
  if (retailPriceEuro === null || basePriceEuro === null) {
    return { ok: false, error: 'Cijene upiši kao broj, na primjer 25 ili 22,50.' }
  }
  const basePriceDate = input.basePriceDate.trim()
  if (basePriceDate.length === 0 || basePriceDate.length > 80) {
    return { ok: false, error: 'Upiši datum bazne cijene.' }
  }
  const title = { hr: input.titleHr.trim(), en: input.titleEn.trim() }
  if (!title.hr || !title.en) {
    return { ok: false, error: 'Naziv treba biti upisan na hrvatskom i engleskom.' }
  }
  const photos = input.photos.map(copyLrcPhoto)
  if (photos.some((item) => item.src.trim().length === 0 || !LRC_FRAME_COLOR.test(item.frame))) {
    return { ok: false, error: 'Svaka fotografija treba putanju i boju okvira.' }
  }
  if (options?.visible && photos.length === 0) {
    return { ok: false, error: 'Vidljiv proizvod treba barem jednu fotografiju. Spremi ga skrivenog ili dodaj sliku.' }
  }
  return {
    ok: true,
    draft: {
      code,
      sortOrder,
      retailPriceEuro,
      basePriceEuro,
      basePriceDate,
      title,
      specs: { hr: input.specsHr.trim(), en: input.specsEn.trim() },
      description: { hr: input.descriptionHr.trim(), en: input.descriptionEn.trim() },
      photos,
    },
  }
}

export function lrcPublishBlock(product: Pick<LrcProduct, 'title' | 'photos'>): string | null {
  if (!product.title.hr.trim() || !product.title.en.trim()) {
    return 'Dodaj naziv na hrvatskom i engleskom prije javne objave.'
  }
  if (product.photos.length === 0) {
    return 'Dodaj barem jednu fotografiju i spremi proizvod prije javne objave.'
  }
  if (product.photos.some((item) => !LRC_FRAME_COLOR.test(item.frame))) {
    return 'Svaka fotografija treba boju okvira prije javne objave.'
  }
  return null
}

export function productToInput(product: LrcProduct): LrcProductInput {
  return {
    code: product.code,
    sortOrder: String(product.sortOrder),
    retailPrice: formatLrcPriceInput(product.retailPriceEuro),
    basePrice: formatLrcPriceInput(product.basePriceEuro),
    basePriceDate: product.basePriceDate,
    titleHr: product.title.hr,
    titleEn: product.title.en,
    specsHr: product.specs.hr,
    specsEn: product.specs.en,
    descriptionHr: product.description.hr,
    descriptionEn: product.description.en,
    photos: product.photos.map(copyLrcPhoto),
  }
}

export function emptyLrcProductInput(sortOrder: number): LrcProductInput {
  return {
    code: '',
    sortOrder: String(sortOrder),
    retailPrice: '',
    basePrice: '',
    basePriceDate: '',
    titleHr: '',
    titleEn: '',
    specsHr: '',
    specsEn: '',
    descriptionHr: '',
    descriptionEn: '',
    photos: [],
  }
}

export function isMissingLrcCatalogError(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? ''
  const message = (error.message ?? '').toLowerCase()
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('schema cache') ||
    (message.includes('lrc_products') &&
      (message.includes('does not exist') || message.includes('could not find')))
  )
}

export function publicCatalogWhenUnconfigured(): PublicLrcCatalogResult {
  return { status: 'ready', source: 'fallback', products: approvedLrcProducts() }
}

export function publicCatalogFromFetch(
  result:
    | { ok: true; products: LrcProduct[] }
    | { ok: false; error: { code?: string; message?: string } },
): PublicLrcCatalogResult {
  if (result.ok) return { status: 'ready', source: 'catalog', products: sortLrcProducts(result.products) }
  if (isMissingLrcCatalogError(result.error)) return publicCatalogWhenUnconfigured()
  return { status: 'error', products: [] }
}
