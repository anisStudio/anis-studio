import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type Language = 'hr' | 'en'

interface PresentationProduct {
  id: string
  title: Record<Language, string>
  eyebrow: Record<Language, string>
  description: Record<Language, string>
  materialRequest: Record<Language, string>
  photos: readonly { src: string; alt: Record<Language, string> }[]
}

const PRESENTATION_PRODUCTS: readonly PresentationProduct[] = [
  {
    id: 'wine-bottle-box',
    title: {
      hr: 'Kutija za vinsku bocu 0,75 l',
      en: 'Box for a 0.75 L wine bottle',
    },
    eyebrow: {
      hr: 'Veća prezentacijska kutija',
      en: 'Larger presentation box',
    },
    description: {
      hr: 'Drvena prezentacijska kutija namijenjena standardnoj vinskoj boci od 0,75 l. Završna obrada, gravura i unutarnji detalji prikazat će se nakon potvrde fotografija konkretnog primjerka.',
      en: 'A wooden presentation box intended for a standard 0.75 L wine bottle. Finish, engraving, and interior details will be shown after photos of the exact item are confirmed.',
    },
    materialRequest: {
      hr: 'Potrebno dostaviti: fotografiju zatvorene kutije, fotografiju otvorene kutije s bocom, jedan detalj gravure te potvrđene vanjske i unutarnje dimenzije.',
      en: 'Required: one photo of the closed box, one open-box photo with the bottle, one engraving detail, and confirmed exterior and interior dimensions.',
    },
    photos: [],
  },
  {
    id: 'liqueur-bottle-box',
    title: {
      hr: 'Kutija za bocu likera',
      en: 'Box for a liqueur bottle',
    },
    eyebrow: {
      hr: 'Manja prezentacijska kutija',
      en: 'Smaller presentation box',
    },
    description: {
      hr: 'Kompaktnija drvena kutija za bocu likera, primjerice teranina. Oblik boce može varirati, pa se kompatibilnost i mjere navode tek nakon provjere konkretnog primjerka.',
      en: 'A compact wooden box for a liqueur bottle, such as teranino. Bottle shapes vary, so compatibility and dimensions are listed only after the exact item is checked.',
    },
    materialRequest: {
      hr: 'Potrebno dostaviti: fotografiju zatvorene kutije, fotografiju otvorene kutije s odgovarajućom bocom, jedan detalj gravure te potvrđene dimenzije kutije i boce.',
      en: 'Required: one photo of the closed box, one open-box photo with the matching bottle, one engraving detail, and confirmed box and bottle dimensions.',
    },
    photos: [],
  },
]

function ProductPlaceholder({ language }: { language: Language }) {
  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center bg-gradient-to-br from-lavender/30 via-white/70 to-amethyst/15 px-5 text-center dark:from-amethyst/20 dark:via-[#171329] dark:to-lavender/10">
      <svg
        viewBox="0 0 96 96"
        className="h-20 w-20 text-amethyst/75 dark:text-lavender/80"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <path d="M21 31 48 17l27 14-27 14-27-14Z" />
        <path d="M21 31v34l27 14 27-14V31M48 45v34" />
        <path d="M39 27h18" />
      </svg>
      <p className="mt-3 text-xs font-semibold text-plum/70 dark:text-pearl/70">
        {language === 'hr' ? 'Fotografije čekaju potvrdu' : 'Photos awaiting confirmation'}
      </p>
    </div>
  )
}

function ProductDetails({
  language,
  product,
  onClose,
}: {
  language: Language
  product: PresentationProduct
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
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/75 px-3 py-5 backdrop-blur-sm sm:px-5"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`lrc-product-${product.id}`}
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-lavender/20 bg-[#f8f6ff] p-5 shadow-2xl dark:bg-[#111018] sm:p-8"
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

        <div className="pr-20">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amethyst dark:text-lavender">
            {product.eyebrow[language]}
          </p>
          <h3
            id={`lrc-product-${product.id}`}
            className="mt-2 font-heading text-2xl font-bold text-plum dark:text-pearl sm:text-3xl"
          >
            {product.title[language]}
          </h3>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-amethyst/15 dark:border-lavender/20">
          {product.photos.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {product.photos.map((photo) => (
                <img
                  key={photo.src}
                  src={photo.src}
                  alt={photo.alt[language]}
                  className="aspect-[4/3] h-full w-full object-cover"
                />
              ))}
            </div>
          ) : (
            <ProductPlaceholder language={language} />
          )}
        </div>

        <p className="mt-6 text-sm leading-relaxed text-plum/85 dark:text-pearl/82 sm:text-base">
          {product.description[language]}
        </p>
        <div className="mt-5 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 dark:border-amber-300/25 dark:bg-amber-200/10 dark:text-amber-100">
          <p className="font-semibold">
            {language === 'hr' ? 'Materijali za dovršetak prikaza' : 'Materials needed to complete this presentation'}
          </p>
          <p className="mt-1">{product.materialRequest[language]}</p>
        </div>
      </section>
    </div>
  )
}

export function LrcPresentationCards({
  language,
  webshopUrl,
}: {
  language: Language
  webshopUrl?: string | null
}) {
  const [selectedProduct, setSelectedProduct] = useState<PresentationProduct | null>(null)

  return (
    <section className="mb-12 sm:mb-14" aria-labelledby="lrc-presentation-title">
      <header className="mx-auto mb-6 max-w-2xl px-4 text-center sm:mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amethyst dark:text-lavender">
          {language === 'hr' ? 'Izdvojeni proizvodi' : 'Featured products'}
        </p>
        <h2
          id="lrc-presentation-title"
          className="mt-2 font-heading text-xl font-bold tracking-tight text-plum dark:text-pearl sm:text-2xl"
        >
          {language === 'hr' ? 'Prezentacijske kutije za boce' : 'Presentation boxes for bottles'}
        </h2>
        <p className="mx-auto mt-3 text-sm leading-relaxed text-plum/78 dark:text-pearl/72 sm:text-[0.9375rem]">
          {language === 'hr'
            ? 'Dvije veličine kutija za darivanje i personaliziranu prezentaciju boce.'
            : 'Two box sizes for gifting and a personalized bottle presentation.'}
        </p>
      </header>

      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
        {PRESENTATION_PRODUCTS.map((product) => (
          <article
            key={product.id}
            className="surface-premium flex min-w-0 flex-col overflow-hidden rounded-2xl"
          >
            <div className="border-b border-amethyst/15 dark:border-lavender/15">
              <ProductPlaceholder language={language} />
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-amethyst dark:text-lavender">
                {product.eyebrow[language]}
              </p>
              <h3 className="mt-2 font-heading text-lg font-bold leading-snug text-plum dark:text-pearl sm:text-xl">
                {product.title[language]}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-plum/76 dark:text-pearl/70">
                {product.description[language]}
              </p>
              <button
                type="button"
                onClick={() => setSelectedProduct(product)}
                className="btn btn-primary mt-5 min-h-12 w-full justify-center"
              >
                {language === 'hr' ? 'Pogledaj detalje' : 'View details'}
              </button>
            </div>
          </article>
        ))}
      </div>

      {webshopUrl ? (
        <div className="mt-7 text-center">
          <a
            href={webshopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="public-action inline-flex min-h-12 items-center justify-center rounded-xl px-7 py-3 text-sm font-semibold"
          >
            {language === 'hr' ? 'Idi na webshop' : 'Go to webshop'}
          </a>
        </div>
      ) : null}

      {selectedProduct && typeof document !== 'undefined'
        ? createPortal(
            <ProductDetails
              language={language}
              product={selectedProduct}
              onClose={() => setSelectedProduct(null)}
            />,
            document.body,
          )
        : null}
    </section>
  )
}
