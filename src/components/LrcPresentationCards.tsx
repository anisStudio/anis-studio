import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  APPROVED_LRC_CODES,
  formatLrcEuro,
  lrcCoverIndex,
  lrcCoverPhoto,
  lrcFrameStyle,
  type LrcProduct,
} from '../lib/lrcCatalog'
import { usePublicLrcProducts } from '../hooks/usePublicLrcProducts'

type Language = 'hr' | 'en'

export type { LrcProduct as LrcPresentationProduct } from '../lib/lrcCatalog'
export { formatLrcEuro, lrcPresentationInquirySummary } from '../lib/lrcCatalog'


function ProductPrices({
  product,
  language,
}: {
  product: LrcProduct
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
        style={lrcFrameStyle(frame)}
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
  product: LrcProduct
}) {
  const [index, setIndex] = useState(() => lrcCoverIndex(product.photos))
  const count = product.photos.length
  const current = product.photos[index] ?? product.photos[0]
  const show = (next: number) => setIndex((next + count) % count)
  const previousLabel = language === 'hr' ? 'Prethodna slika' : 'Previous image'
  const nextLabel = language === 'hr' ? 'Sljedeća slika' : 'Next image'

  if (!current) {
    return (
      <p className="text-sm text-plum/70 dark:text-pearl/70">
        {language === 'hr' ? 'Nema fotografija.' : 'No photographs.'}
      </p>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-[6.5rem] flex-1">
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl"
          style={lrcFrameStyle(current.frame)}
        >
          <img
            src={current.src}
            alt={current.alt[language]}
            className="max-h-full max-w-full object-contain"
            style={{ boxShadow: `0 0 18px 8px ${current.frame}` }}
          />
        </div>
        {count > 1 ? (
          <>
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
          </>
        ) : null}
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
              key={`${item.src}-${photoIndex}`}
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
  product: LrcProduct
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
            <ProductGallery key={product.code} language={language} product={product} />
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
  const catalog = usePublicLrcProducts()
  const products = catalog.products
  const [selectedProduct, setSelectedProduct] = useState<LrcProduct | null>(null)
  const approvedIntro =
    catalog.status !== 'ready' ||
    (products.length === APPROVED_LRC_CODES.length &&
      products.every((product, index) => product.code === APPROVED_LRC_CODES[index]))

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
          {approvedIntro
            ? language === 'hr'
              ? 'Tri kutije za uspomene i poklon boce, s gravurom po želji.'
              : 'Three boxes for keepsakes and gift bottles, with engraving to your wishes.'
            : language === 'hr'
              ? 'Personalizirane kutije za uspomene i poklon boce, s gravurom po želji.'
              : 'Personalized boxes for keepsakes and gift bottles, with engraving to your wishes.'}
        </p>
      </header>

      {catalog.status === 'loading' ? (
        <p className="px-4 text-center text-sm text-plum/70 dark:text-pearl/70">
          {language === 'hr' ? 'Učitavanje proizvoda...' : 'Loading products...'}
        </p>
      ) : null}
      {catalog.status === 'error' ? (
        <p className="px-4 text-center text-sm text-plum/70 dark:text-pearl/70">
          {language === 'hr'
            ? 'Proizvodi se trenutno ne mogu učitati.'
            : 'The products cannot be loaded right now.'}
        </p>
      ) : null}
      {catalog.status === 'ready' && products.length === 0 ? (
        <p className="px-4 text-center text-sm text-plum/70 dark:text-pearl/70">
          {language === 'hr'
            ? 'Trenutno nema javno vidljivih proizvoda.'
            : 'There are no publicly visible products right now.'}
        </p>
      ) : null}

      {catalog.status === 'ready' && products.length > 0 ? (
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {products.map((product) => {
          const main = lrcCoverPhoto(product.photos)
          return (
            <article
              key={product.code}
              className="surface-premium flex min-w-0 flex-col overflow-hidden rounded-2xl"
            >
              <div className="border-b border-amethyst/15 dark:border-lavender/15">
                {main ? (
                  <ProductPhoto
                    src={main.src}
                    alt={main.alt[language]}
                    caption={main.caption[language]}
                    frame={main.frame}
                  />
                ) : (
                  <div className="flex h-[210px] items-center justify-center bg-[#f3ece8] text-sm text-plum/60 lg:h-[240px]">
                    {language === 'hr' ? 'Bez fotografije' : 'No photograph'}
                  </div>
                )}
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
      ) : null}

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
