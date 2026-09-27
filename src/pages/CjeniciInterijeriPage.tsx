import { Link } from 'react-router-dom'
import { AnimatedPage } from '../components/AnimatedPage'
import { DecorativeSkyBackdrop } from '../components/DecorativeSkyBackdrop'
import { PageSEO } from '../components/PageSEO'
import { InteriorsSettingsLoading } from '../components/InteriorsSettingsLoading'
import {
  KitchenPricingIllustrationSlot,
} from '../components/pricing/KitchenPricingIllustrationSlot'
import { useSettings } from '../hooks/useSettings'
import {
  formatInteriorsPrice,
  formatInteriorsPriceById,
  getInteriorsPricingItem,
  getWebVisibleInteriorsPricingItems,
  isOwnRegulatoryCsvPublicationReady,
  type InteriorsPricingItem,
  type PricingLanguage,
} from '../lib/interiorsPricing'
import {
  formatKitchenExampleAmounts,
  getKitchenPricingExampleAmounts,
  KITCHEN_ADVANCED_EXAMPLE_UNITS,
  KITCHEN_COMPLEX_EXAMPLE_UNITS,
} from '../lib/interiorsKitchenPricingExample'

interface CjeniciInterijeriPageProps {
  language: 'hr' | 'en'
}

const unavailableCopy = {
  title: {
    hr: 'Usluga je trenutno u pripremi',
    en: 'This service is currently in preparation',
  },
  text: {
    hr: 'Cjenik trenutno nije javno dostupan. Za upite možete nam se javiti putem kontakt stranice.',
    en: 'This price list is not publicly available at the moment. You can contact us through the contact page.',
  },
  button: { hr: 'Kontakt', en: 'Contact' },
}

const baseTaglines: Record<string, { hr: string; en: string }> = {
  'interior-small-set': {
    hr: 'Idealno za TV zid, manji sklop ili pojedinačne zahvate.',
    en: 'Ideal for a TV wall, a small set, or individual elements.',
  },
  'interior-room': {
    hr: 'Za jednu prostoriju — kupaonicu, spavaću, dnevni boravak i slično.',
    en: 'For one room — bathroom, bedroom, living room, and similar.',
  },
  'interior-kitchen': {
    hr: 'Za cjelovito 3D idejno rješenje kuhinje standardnog opsega.',
    en: 'For a complete 3D kitchen concept within a standard scope.',
  },
}

function displayPrice(item: InteriorsPricingItem, language: PricingLanguage): string {
  if (item.price.type === 'quote') {
    return item.basis[language]
  }
  return formatInteriorsPrice(item.price, language)
}

function InteriorsPriceListContent({ language }: { language: 'hr' | 'en' }) {
  const webVisibleItems = getWebVisibleInteriorsPricingItems()
  const baseItems = webVisibleItems.filter((item) => item.category === 'base')
  const discountItem = webVisibleItems.find((item) => item.id === 'multi-room-package')
  const photoItem = getInteriorsPricingItem('photorealistic-visualization')
  const includedItem = getInteriorsPricingItem('included-minor-revision')
  const majorItem = getInteriorsPricingItem('major-revision')
  const kitchenAmounts = getKitchenPricingExampleAmounts()
  const kitchenFormatted = kitchenAmounts
    ? formatKitchenExampleAmounts(language, kitchenAmounts)
    : null
  const showDigitalPriceList = isOwnRegulatoryCsvPublicationReady

  const copy = {
    dept: { hr: "Ani's Interijeri", en: "Ani's Interijeri" },
    title: {
      hr: 'Cjenik 3D idejnih rješenja',
      en: '3D concept design price list',
    },
    lead: {
      hr: 'Početne cijene daju okvir — konačna cijena ovisi o opsegu i složenosti vašeg projekta te se potvrđuje u ponudi prije izrade.',
      en: 'Starting prices provide a framework — the final price depends on your project scope and complexity and is confirmed in a quote before work begins.',
    },
    back: { hr: 'Povratak na sve cjenike', en: 'Back to all price lists' },
    quote: { hr: 'Zatraži ponudu', en: 'Request a quote' },
    baseHeading: {
      hr: 'Odaberite što želite urediti',
      en: 'Choose what you want to design',
    },
    kitchenHeading: {
      hr: 'Kako se formira cijena kuhinje?',
      en: 'How is the kitchen price formed?',
    },
    kitchenCards: {
      basic: {
        title: { hr: 'Osnovna kuhinja', en: 'Basic kitchen' },
        note: {
          hr: 'Jednostavnije rješenje standardnog opsega.',
          en: 'A simpler solution within a standard scope.',
        },
        imageAlt: {
          hr: 'Primjer osnovne kuhinje',
          en: 'Example of a basic kitchen layout',
        },
      },
      complex: {
        title: { hr: 'Složenija kuhinja', en: 'More complex kitchen' },
        exampleLabel: { hr: 'primjer', en: 'example' },
        scenario: {
          hr: 'Primjer kuhinje u L.',
          en: 'Example of an L-shaped kitchen layout.',
        },
        imageAlt: {
          hr: 'Primjer složenije L-kuhinje',
          en: 'Example of a more complex L-shaped kitchen',
        },
      },
      advanced: {
        title: { hr: 'Zahtjevnija kuhinja', en: 'More demanding kitchen' },
        scenario: {
          hr: 'Primjer kuhinje u U s otokom.',
          en: 'Example of a U-shaped kitchen with an island.',
        },
        imageAlt: {
          hr: 'Primjer zahtjevnije U-kuhinje s otokom',
          en: 'Example of a more demanding U-shaped kitchen with an island',
        },
      },
    },
    complexityFactors: {
      hr:
        'Složenost može rasti zbog dodatnih ili posebno modeliranih elemenata, složenije unutarnje organizacije, skrivenih ladica, vertikalnih pregrada za pladnjeve i tacne, dodatnih polica, posebnih kutova, maski ili drugih nestandardnih rješenja koja traže više modeliranja.\n\nObračunska jedinica dodatne složenosti predstavlja dodatni opseg modeliranja i projektiranja — nije pravilo „jedan element = +10 €“. Konačan broj jedinica određuje se prema stvarnom projektu i potvrđuje u ponudi.',
      en:
        'Complexity can increase due to additional or specially modelled elements, more complex internal organisation, hidden drawers, vertical dividers for trays, extra shelves, special corners, panels, or other non-standard solutions that require more modelling.\n\nEach billing unit of additional complexity represents extra modelling and design scope — it is not a rule of “one element = +€10”. The final number of units is determined for your actual project and confirmed in the quote.',
    },
    otherHeading: { hr: 'Ostale usluge', en: 'Other services' },
    photoNote: {
      hr: 'Do dva kadra iste prostorije odobrenog 3D rješenja.',
      en: 'Up to two views of the same room of the approved 3D design.',
    },
    discountLead: {
      hr: 'Projektirate 4 ili više prostorija?',
      en: 'Planning a project with 4 or more rooms?',
    },
    discountBody: {
      hr: '10 % popusta na 3D projektiranje.',
      en: '10% discount on 3D design.',
    },
    discountExclude: {
      hr: 'Popust se ne odnosi na fotorealističnu vizualizaciju.',
      en: 'The discount does not apply to photorealistic visualization.',
    },
    measures: {
      hr:
        'Klijent dostavlja mjere i potrebne podatke. Ani\'s Studio izrađuje 3D idejno rješenje prema tim podacima. Završnu izmjeru i tehničku provjeru prije izvedbe obavlja izvođač ili stolar.',
      en:
        "You supply measurements and the information we need. Ani's Studio prepares the 3D concept design from that information. The contractor or carpenter carries out the final survey and technical check before execution.",
    },
    ctaLead: {
      hr: 'Imate prostor koji želite osmisliti?',
      en: 'Have a space you would like to plan?',
    },
    csv: { hr: 'Digitalni cjenik (.CSV)', en: 'Digital price list (.CSV)' },
  }

  const sectionShell =
    'rounded-2xl border border-amethyst/12 bg-white/55 p-4 shadow-sm backdrop-blur-sm dark:border-lavender/12 dark:bg-white/[0.04] sm:p-5'

  return (
    <main className="min-w-0">
      <section className="Section fade-in relative section-with-bg overflow-x-clip">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <DecorativeSkyBackdrop priority="high" />
          <div className="absolute inset-0 section-bg-overlay-light dark:section-bg-overlay-dark" />
        </div>

        <div className="relative z-10 mx-auto min-w-0 max-w-3xl px-2 py-8 sm:px-4 sm:py-10 lg:py-12">
          <header className="mb-8 flex flex-col items-center text-center sm:mb-10">
            <p className="w-full text-center font-heading text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-amethyst/80 dark:text-lavender/85">
              {copy.dept[language]}
            </p>
            <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight text-balance text-plum/95 dark:text-pearl sm:text-3xl">
              {copy.title[language]}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-plum/76 dark:text-pearl/72 sm:text-base">
              {copy.lead[language]}
            </p>
            <div className="mt-6 flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center sm:justify-center">
              <Link
                to="/interijeri/klijenti"
                className="btn btn-primary inline-flex min-h-[44px] w-full items-center justify-center px-6 py-2.5 text-sm font-semibold sm:w-auto"
              >
                {copy.quote[language]}
              </Link>
              <Link
                to="/cjenici"
                className="btn btn-secondary inline-flex min-h-[44px] w-full items-center justify-center px-6 py-2.5 text-center text-sm font-semibold sm:w-auto"
              >
                {copy.back[language]}
              </Link>
            </div>
          </header>

          <section className="mb-10" aria-labelledby="interiors-base-heading">
            <h2
              id="interiors-base-heading"
              className="mb-4 font-heading text-lg font-bold text-plum/90 dark:text-pearl"
            >
              {copy.baseHeading[language]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {baseItems.map((item) => (
                <article key={item.id} className={`${sectionShell} flex flex-col`}>
                  <h3 className="font-heading text-sm font-bold leading-snug text-plum/92 dark:text-pearl">
                    {item.name[language]}
                  </h3>
                  <p className="mt-2 text-lg font-bold text-[--color-primary] dark:text-lavender">
                    {formatInteriorsPrice(item.price, language)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-plum/70 dark:text-pearl/65">
                    {baseTaglines[item.id]?.[language] ?? item.description?.[language]}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {kitchenFormatted ? (
            <section className="mb-10" aria-labelledby="kitchen-price-heading">
              <h2
                id="kitchen-price-heading"
                className="mb-4 font-heading text-lg font-bold text-plum/90 dark:text-pearl"
              >
                {copy.kitchenHeading[language]}
              </h2>
              <div className="grid gap-4 md:grid-cols-3 md:items-stretch">
                <article className={`${sectionShell} flex h-full flex-col overflow-hidden p-0`}>
                  <KitchenPricingIllustrationSlot
                    variant="basic"
                    alt={copy.kitchenCards.basic.imageAlt[language]}
                  />
                  <div className="flex flex-1 flex-col px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                  <h3 className="font-heading text-sm font-bold text-plum/90 dark:text-pearl">
                    {copy.kitchenCards.basic.title[language]}
                  </h3>
                  <p className="mt-1 text-lg font-bold text-[--color-primary] dark:text-lavender">
                    {formatInteriorsPriceById('interior-kitchen', language)}
                  </p>
                  <p className="mt-2 text-xs text-plum/68 dark:text-pearl/62">
                    {copy.kitchenCards.basic.note[language]}
                  </p>
                  </div>
                </article>

                <article className={`${sectionShell} flex h-full flex-col overflow-hidden p-0`}>
                  <KitchenPricingIllustrationSlot
                    variant="complex"
                    alt={copy.kitchenCards.complex.imageAlt[language]}
                  />
                  <div className="flex flex-1 flex-col px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                  <h3 className="font-heading text-sm font-bold text-plum/90 dark:text-pearl">
                    {copy.kitchenCards.complex.title[language]}
                  </h3>
                  <p className="mt-1 text-lg font-bold text-[--color-primary] dark:text-lavender">
                    {copy.kitchenCards.complex.exampleLabel[language]}{' '}
                    {kitchenFormatted.complexTotal}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-plum/68 dark:text-pearl/62">
                    {kitchenFormatted.base} + {KITCHEN_COMPLEX_EXAMPLE_UNITS} × {kitchenFormatted.unit}{' '}
                    {language === 'hr' ? 'dodatne složenosti' : 'additional complexity'}
                  </p>
                  <p className="mt-2 text-xs italic text-plum/58 dark:text-pearl/52">
                    {copy.kitchenCards.complex.scenario[language]}
                  </p>
                  </div>
                </article>

                <article className={`${sectionShell} flex h-full flex-col overflow-hidden p-0`}>
                  <KitchenPricingIllustrationSlot
                    variant="advanced"
                    alt={copy.kitchenCards.advanced.imageAlt[language]}
                  />
                  <div className="flex flex-1 flex-col px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                  <h3 className="font-heading text-sm font-bold text-plum/90 dark:text-pearl">
                    {copy.kitchenCards.advanced.title[language]}
                  </h3>
                  <p className="mt-1 text-lg font-bold text-[--color-primary] dark:text-lavender">
                    {kitchenFormatted.advancedFrom}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-plum/68 dark:text-pearl/62">
                    {kitchenFormatted.base} + {KITCHEN_ADVANCED_EXAMPLE_UNITS} × {kitchenFormatted.unit}{' '}
                    {language === 'hr' ? 'dodatne složenosti' : 'additional complexity'}
                  </p>
                  <p className="mt-2 text-xs italic text-plum/58 dark:text-pearl/52">
                    {copy.kitchenCards.advanced.scenario[language]}
                  </p>
                  </div>
                </article>
              </div>
              <div className="mx-auto mt-8 max-w-xl text-left sm:mt-10 md:max-w-2xl">
                <p className="whitespace-pre-line text-sm leading-relaxed text-plum/72 dark:text-pearl/68">
                  {copy.complexityFactors[language]}
                </p>
              </div>
            </section>
          ) : null}

          <section className="mb-8" aria-labelledby="other-services-heading">
            <h2
              id="other-services-heading"
              className="mb-4 font-heading text-lg font-bold text-plum/90 dark:text-pearl"
            >
              {copy.otherHeading[language]}
            </h2>
            <ul className="grid min-w-0 gap-3 sm:grid-cols-2 sm:items-stretch lg:grid-cols-3">
              <li className={`${sectionShell} flex h-full min-w-0 flex-col`}>
                <p className="font-heading text-sm font-bold text-plum/90 dark:text-pearl">
                  {photoItem.name[language]}
                </p>
                <p className="mt-1 text-base font-bold text-[--color-primary] dark:text-lavender">
                  {formatInteriorsPrice(photoItem.price, language)}
                </p>
                <p className="mt-1 text-xs text-plum/68 dark:text-pearl/62">{copy.photoNote[language]}</p>
              </li>
              <li className={`${sectionShell} flex h-full min-w-0 flex-col`}>
                <p className="font-heading text-sm font-bold text-plum/90 dark:text-pearl">
                  {includedItem.name[language]}
                </p>
                <p className="mt-1 text-base font-bold text-emerald-700 dark:text-emerald-300">
                  {formatInteriorsPrice(includedItem.price, language)}
                </p>
              </li>
              <li className={`${sectionShell} flex h-full min-w-0 flex-col sm:col-span-2 lg:col-span-1`}>
                <p className="font-heading text-sm font-bold text-plum/90 dark:text-pearl">
                  {majorItem.name[language]}
                </p>
                <p className="mt-1 text-base font-bold text-plum/80 dark:text-pearl/75">
                  {displayPrice(majorItem, language)}
                </p>
              </li>
            </ul>

            <div
              className="mx-auto mt-6 max-w-xl rounded-2xl border border-amethyst/10 bg-plum/[0.035] px-4 py-4 text-left dark:border-lavender/12 dark:bg-white/[0.035] sm:px-5 md:max-w-2xl"
            >
              <p className="text-sm leading-relaxed text-plum/70 dark:text-pearl/65">
                {copy.measures[language]}
              </p>
            </div>
          </section>

          {discountItem ? (
            <aside
              className="mb-8 rounded-2xl border border-amethyst/18 bg-gradient-to-br from-amethyst/[0.08] to-lavender/[0.06] px-4 py-4 text-center dark:border-lavender/20 dark:from-amethyst/15 dark:to-lavender/10 sm:px-5"
              aria-label={copy.discountLead[language]}
            >
              <p className="font-heading text-sm font-bold text-plum/88 dark:text-pearl">
                {copy.discountLead[language]}
              </p>
              <p className="mt-1 text-base font-bold text-[--color-primary] dark:text-lavender">
                {copy.discountBody[language]}
              </p>
              <p className="mt-2 text-xs text-plum/65 dark:text-pearl/58">{copy.discountExclude[language]}</p>
            </aside>
          ) : null}

          <div className="rounded-2xl border border-amethyst/12 bg-white/50 px-4 py-6 text-center dark:border-lavender/12 dark:bg-white/[0.04] sm:px-6">
            <p className="font-heading text-base font-semibold text-plum/88 dark:text-pearl">
              {copy.ctaLead[language]}
            </p>
            <Link
              to="/interijeri/klijenti"
              className="btn btn-primary mt-4 inline-flex min-h-[48px] items-center justify-center px-7 py-3 text-sm font-semibold"
            >
              {copy.quote[language]}
            </Link>
            {showDigitalPriceList ? (
              <a
                href="/cjenik/interijeri.csv"
                className="mt-3 block text-xs font-medium text-plum/60 underline-offset-2 hover:underline dark:text-pearl/55"
                download
              >
                {copy.csv[language]}
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  )
}

export default function CjeniciInterijeriPage({ language }: CjeniciInterijeriPageProps) {
  const { settings, isLoading } = useSettings()
  const interiorsVisible = settings?.interiors_public_visible ?? true

  if (isLoading) {
    return (
      <InteriorsSettingsLoading
        language={language}
        seoTitle={language === 'hr' ? 'Cjenik Interijera' : 'Interiors price list'}
      />
    )
  }

  if (!interiorsVisible) {
    return (
      <AnimatedPage>
        <PageSEO title="Cjenik Interijera" description="" noIndex />
        <main className="min-w-0">
          <section className="Section fade-in">
            <div className="mx-auto max-w-xl px-4 py-20 text-center">
              <h1 className="mb-4 font-heading text-2xl font-bold text-plum/95 dark:text-pearl">
                {unavailableCopy.title[language]}
              </h1>
              <p className="mb-8 text-plum/75 dark:text-pearl/70">{unavailableCopy.text[language]}</p>
              <Link to="/kontakt" className="btn btn-primary inline-flex min-h-[48px] px-8 py-3 font-semibold">
                {unavailableCopy.button[language]}
              </Link>
            </div>
          </section>
        </main>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage>
      <PageSEO
        title="Cjenik Interijera"
        description="Cjenik 3D idejnih rješenja i vizualizacija interijera — početne cijene za manji sklop, prostoriju i kuhinju, uz jasno objašnjenje dodatne složenosti i dodatnih usluga."
        canonical="/cjenici/interijeri"
      />
      <InteriorsPriceListContent language={language} />
    </AnimatedPage>
  )
}
