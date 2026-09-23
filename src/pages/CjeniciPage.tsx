import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AnimatedPage } from '../components/AnimatedPage'
import { DecorativeSkyBackdrop } from '../components/DecorativeSkyBackdrop'
import { PageSEO } from '../components/PageSEO'
import { useSettings } from '../hooks/useSettings'
import {
  formatInteriorsPrice,
  interiorsPricing,
  publicInteriorsPricingItems,
} from '../lib/interiorsPricing'

interface CjeniciPageProps {
  language: 'hr' | 'en'
}

function InteriorsPricingSection({ language }: CjeniciPageProps) {
  const baseItems = publicInteriorsPricingItems.filter((item) => item.category === 'base')
  const additionalItems = publicInteriorsPricingItems.filter(
    (item) => item.category === 'additional'
  )
  const includedItem = publicInteriorsPricingItems.find(
    (item) => item.category === 'included'
  )
  const discountItem = publicInteriorsPricingItems.find(
    (item) => item.category === 'discount'
  )
  const showDigitalPriceList = interiorsPricing.publicationStatus === 'public-ready'

  const copy = {
    intro: {
      hr: 'B2C cjenik 3D idejnih rješenja za privatne klijente.',
      en: 'B2C pricing for private-client 3D concept designs.',
    },
    base: { hr: 'Osnovne 3D usluge', en: 'Base 3D services' },
    additional: { hr: 'Dodatne usluge i izmjene', en: 'Add-ons and revisions' },
    included: { hr: 'Uključeno', en: 'Included' },
    discount: { hr: 'Paketni popust', en: 'Package discount' },
    pricingRule: {
      hr: 'Konačna cijena 3D idejnog rješenja ovisi o opsegu projekta, broju i složenosti elemenata, rasporedu i ukupnoj zahtjevnosti. Konačna cijena potvrđuje se prije početka izrade.',
      en: 'The final price of a 3D concept design depends on project scope, the number and complexity of elements, the layout, and the overall requirements. The final price is confirmed before work begins.',
    },
    quote: { hr: 'Zatraži ponudu', en: 'Request a quote' },
    csv: { hr: 'Digitalni cjenik (.CSV)', en: 'Digital price list (.CSV)' },
  }

  const itemCard = (
    item: (typeof publicInteriorsPricingItems)[number],
    tone: 'standard' | 'included' | 'discount' = 'standard'
  ) => {
    const toneClass =
      tone === 'included'
        ? 'border-emerald-300/35 bg-emerald-50/65 dark:border-emerald-300/20 dark:bg-emerald-300/[0.06]'
        : tone === 'discount'
          ? 'border-amethyst/25 bg-gradient-to-br from-amethyst/10 to-lavender/15 dark:border-lavender/25 dark:from-amethyst/20 dark:to-lavender/10'
          : 'border-amethyst/15 bg-white/72 dark:border-lavender/15 dark:bg-white/[0.06]'

    return (
      <article
        key={item.id}
        className={`flex h-full flex-col rounded-2xl border p-5 shadow-sm ${toneClass}`}
      >
        <h4 className="font-heading text-base font-bold leading-snug text-plum/95 dark:text-pearl">
          {item.name[language]}
        </h4>
        <p
          className={`mt-3 text-xl font-bold ${
            tone === 'included'
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-[--color-primary] dark:text-lavender'
          }`}
        >
          {formatInteriorsPrice(item.price, language)}
          {item.price.type === 'discount' ? (
            <span className="ml-1 text-base font-semibold">
              {language === 'hr' ? 'na 3D projektiranje' : 'on 3D design'}
            </span>
          ) : null}
        </p>
        {item.description ? (
          <p className="mt-3 text-sm leading-relaxed text-plum/72 dark:text-pearl/68">
            {item.description[language]}
          </p>
        ) : null}
        {item.calculationNotes ? (
          <p className="mt-3 text-xs leading-relaxed text-plum/62 dark:text-pearl/58">
            {item.calculationNotes[language]}
          </p>
        ) : null}
      </article>
    )
  }

  return (
    <section
      id="interijeri"
      className="scroll-mt-24 rounded-3xl border border-[rgba(110,68,255,0.14)] bg-white/58 p-5 shadow-[0_12px_45px_rgba(46,36,71,0.08)] backdrop-blur-md dark:border-lavender/15 dark:bg-white/[0.05] dark:shadow-[0_18px_55px_rgba(0,0,0,0.28)] sm:scroll-mt-28 sm:p-8 md:p-10"
      aria-labelledby="interijeri-pricing-heading"
    >
      <header className="mx-auto mb-8 max-w-3xl text-center">
        <p className="font-heading text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-amethyst/80 dark:text-lavender/85">
          {language === 'hr' ? 'Odjel' : 'Department'}
        </p>
        <h2
          id="interijeri-pricing-heading"
          className="mt-3 font-heading text-2xl font-bold tracking-tight text-balance text-plum/95 dark:text-pearl sm:text-3xl"
        >
          Ani&apos;s Interijeri
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-plum/76 dark:text-pearl/72 sm:text-base">
          {copy.intro[language]}
        </p>
      </header>

      <div className="space-y-9">
        <div>
          <h3 className="mb-4 font-heading text-lg font-bold text-plum/90 dark:text-pearl">
            {copy.base[language]}
          </h3>
          <div className="grid gap-4 md:grid-cols-3">{baseItems.map((item) => itemCard(item))}</div>
        </div>

        <div>
          <h3 className="mb-4 font-heading text-lg font-bold text-plum/90 dark:text-pearl">
            {copy.additional[language]}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {additionalItems.map((item) => itemCard(item))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {includedItem ? (
            <div>
              <h3 className="mb-4 font-heading text-lg font-bold text-plum/90 dark:text-pearl">
                {copy.included[language]}
              </h3>
              {itemCard(includedItem, 'included')}
            </div>
          ) : null}
          {discountItem ? (
            <div>
              <h3 className="mb-4 font-heading text-lg font-bold text-plum/90 dark:text-pearl">
                {copy.discount[language]}
              </h3>
              {itemCard(discountItem, 'discount')}
            </div>
          ) : null}
        </div>

        <p className="rounded-2xl border border-amethyst/15 bg-white/55 px-5 py-4 text-sm font-medium leading-relaxed text-plum/80 dark:border-lavender/15 dark:bg-white/[0.04] dark:text-pearl/75">
          {copy.pricingRule[language]}
        </p>

        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            to="/interijeri/klijenti"
            className="btn btn-primary inline-flex min-h-[48px] items-center justify-center px-7 py-3.5 text-center text-sm font-semibold sm:text-base"
          >
            {copy.quote[language]}
          </Link>
          {showDigitalPriceList ? (
            <a
              href="/cjenik/interijeri.csv"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-amethyst/25 bg-white/70 px-6 py-3 text-sm font-semibold text-plum/88 transition hover:border-[--color-primary]/45 hover:bg-white/90 dark:border-lavender/25 dark:bg-white/[0.08] dark:text-pearl dark:hover:bg-white/[0.12]"
              download
            >
              {copy.csv[language]}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default function CjeniciPage({ language }: CjeniciPageProps) {
  const { settings, isLoading, error } = useSettings()
  const showInteriors =
    !isLoading && error === null && settings?.interiors_public_visible === true

  useEffect(() => {
    if (!showInteriors || window.location.hash !== '#interijeri') return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('interijeri')?.scrollIntoView({ block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [showInteriors])

  const copy = {
    title: { hr: 'Cjenici', en: 'Price lists' },
    intro: {
      hr: "Na jednom mjestu nalaze se aktualni cjenici usluga i proizvoda pojedinih odjela Ani's Studija.",
      en: "Current price lists for services and products from Ani's Studio departments are available in one place.",
    },
    empty: {
      hr: 'Trenutno nema javno dostupnih cjenika.',
      en: 'There are currently no publicly available price lists.',
    },
  }

  return (
    <AnimatedPage>
      <PageSEO
        title="Cjenici"
        description="Aktualni cjenici usluga i proizvoda Ani's Studija na jednom mjestu."
        canonical="/cjenici"
      />
      <main className="min-w-0">
        <section className="Section fade-in relative section-with-bg overflow-x-clip">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <DecorativeSkyBackdrop priority="high" />
            <div className="absolute inset-0 section-bg-overlay-light dark:section-bg-overlay-dark" />
          </div>

          <div className="relative z-10 mx-auto min-w-0 max-w-6xl px-0 py-8 sm:py-10 lg:py-12">
            <header className="mx-auto mb-10 max-w-3xl px-2 text-center sm:mb-12">
              <h1 className="font-heading text-3xl font-bold tracking-tight text-balance text-plum/95 dark:text-pearl sm:text-4xl">
                {copy.title[language]}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-plum/76 dark:text-pearl/72 sm:text-lg">
                {copy.intro[language]}
              </p>
            </header>

            {isLoading ? (
              <div
                className="flex min-h-40 items-center justify-center"
                aria-busy="true"
                aria-live="polite"
              >
                <div
                  className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--clr-primary)] border-t-transparent"
                  role="status"
                />
                <span className="sr-only">
                  {language === 'hr' ? 'Učitavanje…' : 'Loading…'}
                </span>
              </div>
            ) : showInteriors ? (
              <InteriorsPricingSection language={language} />
            ) : (
              <p className="rounded-2xl border border-amethyst/12 bg-white/55 px-5 py-10 text-center text-sm text-plum/70 dark:border-lavender/12 dark:bg-white/[0.04] dark:text-pearl/65">
                {copy.empty[language]}
              </p>
            )}
          </div>
        </section>
      </main>
    </AnimatedPage>
  )
}
