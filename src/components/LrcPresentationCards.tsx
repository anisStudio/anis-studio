import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

type Language = 'hr' | 'en'

const IMAGE_BASE = '/lrc_image/proizvodi/slike'

export interface LrcPresentationProduct {
  code: 'LRC-BAB-03' | 'LRC-VIN-02' | 'LRC-VIN-03'
  /** Maloprodajna cijena, ista kao na kartici u trenutku slanja upita. */
  retailPriceEuro: number
  /** Bazna cijena. Prikazuje se uz datum, bez precrtavanja. */
  basePriceEuro: number
  /** Datum prvog stavljanja u ponudu, kako je zapisan uz baznu cijenu. */
  basePriceDate: string
  title: Record<Language, string>
  specs: Record<Language, string>
  description: Record<Language, string>
  photos: readonly {
    src: string
    alt: Record<Language, string>
    caption: Record<Language, string>
    /** Bež uz lijevi i desni rub fotografije. Okvir izvan kadra koristi istu nijansu. */
    frame: string
  }[]
}

function photo(
  file: string,
  altHr: string,
  altEn: string,
  frame: string,
  captionHr = '',
  captionEn = '',
) {
  return {
    src: `${IMAGE_BASE}/${file}`,
    alt: { hr: altHr, en: altEn },
    caption: { hr: captionHr, en: captionEn },
    frame,
  }
}

function softenFrame(frame: string): string {
  const value = Number.parseInt(frame.slice(1), 16)
  const channel = (shift: number) => Math.min(255, ((value >> shift) & 255) + 12)
  return `#${[channel(16), channel(8), channel(0)].map((part) => part.toString(16).padStart(2, '0')).join('')}`
}

function frameStyle(frame: string): CSSProperties {
  const edge = softenFrame(frame)
  return {
    backgroundColor: frame,
    backgroundImage: `linear-gradient(90deg, ${edge} 0%, transparent 14%, transparent 86%, ${edge} 100%)`,
  }
}

export const LRC_PRESENTATION_PRODUCTS: readonly LrcPresentationProduct[] = [
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

export function formatLrcEuro(amount: number): string {
  const [whole, fraction] = amount.toFixed(2).split('.')
  return `${whole},${fraction} €`
}

/** Sažetak koji ide u postojeće polje `product` tablice lrc_inquiries. */
export function lrcPresentationInquirySummary(
  product: LrcPresentationProduct,
  language: Language,
): string {
  const price = formatLrcEuro(product.retailPriceEuro)
  const title = product.title[language]
  return language === 'hr'
    ? `${product.code} — ${title} — maloprodajna cijena ${price}`
    : `${product.code} — ${title} — retail price ${price}`
}

function ProductPrices({
  product,
  language,
}: {
  product: LrcPresentationProduct
  language: Language
}) {
  const priceLabel = language === 'hr' ? 'Cijena' : 'Price'
  const baseLabel = language === 'hr' ? 'Bazna cijena' : 'Base price'
  return (
    <div className="mt-3 space-y-2 text-sm text-plum dark:text-pearl">
      <p>
        <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-plum/60 dark:text-pearl/55">
          {priceLabel}
        </span>
        <span className="mt-0.5 block font-semibold">{formatLrcEuro(product.retailPriceEuro)}</span>
      </p>
      <p className="text-plum/80 dark:text-pearl/75">
        {baseLabel} {formatLrcEuro(product.basePriceEuro)} ({product.basePriceDate})
      </p>
    </div>
  )
}

export function lrcPresentationInquiryPath(inquiryPath: string, code: string): string {
  const params = new URLSearchParams({ proizvod: code })
  const separator = inquiryPath.includes('?') ? '&' : '?'
  return `${inquiryPath}${separator}${params.toString()}`
}

function ProductPhoto({
  src,
  alt,
  caption,
  frame,
}: {
  src: string
  alt: string
  caption: string
  frame: string
}) {
  return (
    <figure className="min-w-0">
      <div
        className="flex h-[210px] items-center justify-center overflow-hidden lg:h-[240px]"
        style={frameStyle(frame)}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="max-h-full max-w-full object-contain"
          style={{ boxShadow: `0 0 18px 8px ${frame}` }}
        />
      </div>
      {caption ? (
        <figcaption className="px-1 pt-2 text-xs leading-relaxed text-plum/75 dark:text-pearl/70">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

function ProductGallery({
  language,
  product,
}: {
  language: Language
  product: LrcPresentationProduct
}) {
  const [index, setIndex] = useState(0)
  const count = product.photos.length
  const current = product.photos[index]
  const show = (next: number) => setIndex((next + count) % count)
  const previousLabel = language === 'hr' ? 'Prethodna slika' : 'Previous image'
  const nextLabel = language === 'hr' ? 'Sljedeća slika' : 'Next image'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-[6.5rem] flex-1">
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl"
          style={frameStyle(current.frame)}
        >
          <img
            src={current.src}
            alt={current.alt[language]}
            className="max-h-full max-w-full object-contain"
            style={{ boxShadow: `0 0 18px 8px ${current.frame}` }}
          />
        </div>
        <button
          type="button"
          onClick={() => show(index - 1)}
          className="absolute left-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-amethyst/20 bg-white/95 text-xl font-semibold text-plum shadow-sm dark:border-lavender/25 dark:bg-[#211a35] dark:text-pearl"
          aria-label={previousLabel}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => show(index + 1)}
          className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-amethyst/20 bg-white/95 text-xl font-semibold text-plum shadow-sm dark:border-lavender/25 dark:bg-[#211a35] dark:text-pearl"
          aria-label={nextLabel}
        >
          ›
        </button>
      </div>
      {current.caption[language] ? (
        <p className="shrink-0 px-1 pt-2 text-xs leading-relaxed text-plum/75 dark:text-pearl/70">
          {current.caption[language]}
        </p>
      ) : null}
      <div className="mt-2 flex shrink-0 gap-2 overflow-x-auto pb-1">
        {product.photos.map((item, photoIndex) => {
          const selected = photoIndex === index
          return (
            <button
              key={item.src}
              type="button"
              onClick={() => setIndex(photoIndex)}
              aria-label={item.alt[language]}
              aria-current={selected ? 'true' : undefined}
              className={`h-16 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${
                selected
                  ? 'border-amethyst ring-2 ring-amethyst/40 dark:border-lavender dark:ring-lavender/40'
                  : 'border-transparent opacity-80'
              }`}
              style={{ backgroundColor: item.frame }}
            >
              <img src={item.src} alt="" className="h-full w-full object-contain" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ProductDetails({
  language,
  product,
  inquiryPath,
  onClose,
}: {
  language: Language
  product: LrcPresentationProduct
  inquiryPath: string
  onClose: () => void
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-2 backdrop-blur-sm sm:p-4"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`lrc-product-${product.code}`}
        className="relative flex h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-lavender/20 bg-[#f8f6ff] p-3 shadow-2xl sm:h-[min(calc(100dvh-2rem),860px)] sm:p-6 dark:bg-[#111018]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 inline-flex min-h-10 items-center justify-center rounded-full border border-amethyst/20 bg-white px-3 text-sm font-semibold text-plum shadow-sm dark:border-lavender/25 dark:bg-[#211a35] dark:text-pearl"
          aria-label={language === 'hr' ? 'Zatvori detalje' : 'Close details'}
        >
          {language === 'hr' ? 'Zatvori' : 'Close'}
        </button>

        <div className="shrink-0 pr-20">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amethyst dark:text-lavender">
            {product.code}
          </p>
          <h3
            id={`lrc-product-${product.code}`}
            className="mt-1 font-heading text-xl font-bold leading-tight text-plum dark:text-pearl sm:text-2xl"
          >
            {product.title[language]}
          </h3>
          <p className="mt-1 text-sm text-plum/70 dark:text-pearl/65">{product.specs[language]}</p>
          <ProductPrices product={product} language={language} />
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch">
          <div className="flex min-h-0 flex-1 flex-col lg:max-w-[46%]">
            <ProductGallery language={language} product={product} />
          </div>
          <p className="min-h-0 shrink-0 overflow-y-auto text-sm leading-relaxed text-plum/85 max-lg:max-h-24 dark:text-pearl/82 lg:min-h-0 lg:flex-1 lg:shrink lg:text-base">
            {product.description[language]}
          </p>
        </div>
        <Link
          to={lrcPresentationInquiryPath(inquiryPath, product.code)}
          className="btn btn-primary mt-3 inline-flex min-h-12 w-full shrink-0 items-center justify-center"
        >
          {language === 'hr' ? 'Pošalji upit' : 'Send inquiry'}
        </Link>
      </section>
    </div>
  )
}

export function LrcPresentationCards({
  language,
  inquiryPath = '/lrc/upit',
}: {
  language: Language
  inquiryPath?: string
}) {
  const [selectedProduct, setSelectedProduct] = useState<LrcPresentationProduct | null>(null)
  const cover = (product: LrcPresentationProduct) => product.photos[0]

  return (
    <section className="mb-12 sm:mb-14" aria-labelledby="lrc-presentation-title">
      <header className="mx-auto mb-6 max-w-2xl px-4 text-center sm:mb-8">
        <p className="mx-auto w-fit max-w-full text-balance text-center text-xs font-bold uppercase leading-snug tracking-[0.18em] text-amethyst [text-indent:0.18em] dark:text-lavender">
          {language === 'hr' ? 'Izdvojeni proizvodi' : 'Featured products'}
        </p>
        <h2
          id="lrc-presentation-title"
          className="mx-auto mt-2 w-fit max-w-full text-balance text-center font-heading text-xl font-bold tracking-tight text-plum dark:text-pearl sm:text-2xl"
        >
          {language === 'hr' ? 'Personalizirane kutije' : 'Personalized boxes'}
        </h2>
        <p className="mx-auto mt-3 text-sm leading-relaxed text-plum/78 dark:text-pearl/72 sm:text-[0.9375rem]">
          {language === 'hr'
            ? 'Tri kutije za uspomene i poklon boce, s gravurom po želji.'
            : 'Three boxes for keepsakes and gift bottles, with engraving to your wishes.'}
        </p>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {LRC_PRESENTATION_PRODUCTS.map((product) => {
          const main = cover(product)
          return (
            <article
              key={product.code}
              className="surface-premium flex min-w-0 flex-col overflow-hidden rounded-2xl"
            >
              <div className="border-b border-amethyst/15 dark:border-lavender/15">
                <ProductPhoto
                  src={main.src}
                  alt={main.alt[language]}
                  caption={main.caption[language]}
                  frame={main.frame}
                />
              </div>
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <h3 className="font-heading text-lg font-bold leading-snug text-plum dark:text-pearl sm:text-xl">
                  {product.title[language]}
                </h3>
                <ProductPrices product={product} language={language} />
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(product)}
                    className="btn btn-secondary min-h-12 w-full justify-center"
                  >
                    {language === 'hr' ? 'Pogledaj detalje' : 'View details'}
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {selectedProduct && typeof document !== 'undefined'
        ? createPortal(
            <ProductDetails
              language={language}
              product={selectedProduct}
              inquiryPath={inquiryPath}
              onClose={() => setSelectedProduct(null)}
            />,
            document.body,
          )
        : null}
    </section>
  )
}
