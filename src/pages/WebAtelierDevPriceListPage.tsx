import { AnimatedPage } from '../components/AnimatedPage'
import { DecorativeSkyBackdrop } from '../components/DecorativeSkyBackdrop'
import { PageSEO } from '../components/PageSEO'
import {
  WEB_ATELIER_ADDON_DEFINITIONS,
  WEB_ATELIER_PACKAGE_DEFINITIONS,
  addonLabel,
  formatEur,
  type AddonDefinition,
  type AddonPricingKind,
  type PackageDefinition,
} from '../lib/webAtelierConfigurator'

interface WebAtelierDevPriceListPageProps {
  language: 'hr' | 'en'
}

const ECOMMERCE_IDS = new Set<AddonDefinition['id']>([
  'shop_integration',
  'new_web_shop',
  'advanced_ecommerce',
])

const SHARED_INCLUDES = {
  hr: [
    'Responzivni prikaz (mobitel, tablet, desktop)',
    'Osnovna SEO optimizacija',
    'Osnovni kontaktni obrazac',
  ],
  en: [
    'Responsive layout (mobile, tablet, desktop)',
    'Basic SEO optimization',
    'Basic contact form',
  ],
} as const

function listedPrice(
  kind: 'package' | AddonPricingKind,
  unitEur: number | null,
  language: 'hr' | 'en',
): string {
  if (kind === 'custom_quote' || unitEur == null) {
    return language === 'hr' ? 'Individualna ponuda' : 'Individual quote'
  }
  const amount = formatEur(unitEur, language)
  if (kind === 'fixed') return amount
  return language === 'hr' ? `od ${amount}` : `from ${amount}`
}

function correctionLabel(count: number, language: 'hr' | 'en'): string {
  if (language === 'en') {
    return count === 1 ? `${count} correction` : `${count} corrections`
  }
  if (count === 1) return `${count} korekcija`
  if (count >= 2 && count <= 4) return `${count} korekcije`
  return `${count} korekcija`
}

function packageScope(pkg: PackageDefinition, language: 'hr' | 'en'): string {
  const pages =
    pkg.pages === 1
      ? language === 'hr'
        ? '1 stranica'
        : '1 page'
      : language === 'hr'
        ? `do ${pkg.pages} stranica`
        : `up to ${pkg.pages} pages`
  const extras: string[] = []
  if (pkg.includes.includes('mini_branding')) extras.push('mini branding')
  if (pkg.includes.includes('priority_support_30d')) {
    extras.push(
      language === 'hr'
        ? '30 dana prioritetne tehničke podrške'
        : '30 days of priority technical support',
    )
  }
  const extra = extras.length > 0 ? `, ${extras.join(', ')}` : ''
  return `${pages}, ${correctionLabel(pkg.revisions, language)}${extra}.`
}

function basicExecution(def: AddonDefinition, language: 'hr' | 'en'): string | null {
  if (def.kind !== 'fixed') return null
  if (def.quantityAllowed) {
    return language === 'hr' ? 'Po jedinici, osnovna izvedba.' : 'Per unit, basic execution.'
  }
  return language === 'hr' ? 'Osnovna izvedba.' : 'Basic execution.'
}

/**
 * Local development price list only. Registered when import.meta.env.DEV is true.
 * Prices come from the shared package and add-on definitions. No inquiry or contact action.
 */
export default function WebAtelierDevPriceListPage({ language }: WebAtelierDevPriceListPageProps) {
  const packages = WEB_ATELIER_PACKAGE_DEFINITIONS
  const optional = WEB_ATELIER_ADDON_DEFINITIONS.filter((def) => !ECOMMERCE_IDS.has(def.id))
  const ecommerce = WEB_ATELIER_ADDON_DEFINITIONS.filter((def) => ECOMMERCE_IDS.has(def.id))

  const copy = {
    local: {
      hr: 'DEV pregled — nije javno objavljeno',
      en: 'DEV preview — not publicly published',
    },
    dept: { hr: "Ani's Web Atelier", en: "Ani's Web Atelier" },
    title: { hr: 'Cjenik web usluga', en: 'Web services price list' },
    lead: {
      hr: 'Početne cijene daju okvir osnovnog opsega. Konačan opseg i cijena potvrđuju se individualnom pisanom ponudom.',
      en: 'Starting prices frame the basic scope. Final scope and price are confirmed in an individual written offer.',
    },
    packages: { hr: 'Osnovni paketi', en: 'Base packages' },
    addons: { hr: 'Opcionalni dodaci', en: 'Optional add-ons' },
    ecommerce: { hr: 'E-commerce', en: 'Ecommerce' },
    notesTitle: { hr: 'Kako čitati cijene', en: 'How to read the prices' },
    notes: {
      hr: [
        'Iznosi su informativni. Ne predstavljaju ugovor, narudžbu ni plaćanje.',
        'Konačan opseg i cijena utvrđuju se individualnom pisanom ponudom.',
        'Složeniji zahtjevi dodatno se naplaćuju.',
        'Hosting, domenu i vanjske usluge klijent u pravilu plaća izravno pružateljima.',
        'Održavanje nije uključeno u aktivni cjenik.',
      ],
      en: [
        'Amounts are indicative. They are not a contract, an order, or a payment.',
        'Final scope and price are set in an individual written offer.',
        'More complex requests are charged extra.',
        'The client generally pays hosting, the domain, and external services directly to the providers.',
        'Maintenance is not included in the active price list.',
      ],
    },
  }

  const sectionShell =
    'rounded-2xl border border-amethyst/12 bg-white/55 p-4 shadow-sm backdrop-blur-sm dark:border-lavender/12 dark:bg-white/[0.04] sm:p-5'

  return (
    <AnimatedPage>
      <PageSEO
        title={language === 'hr' ? 'Lokalni cjenik Web Ateliera' : 'Local Web Atelier price list'}
        description=""
        noIndex
      />
      <p className="bg-white/80 px-4 py-2 text-center text-xs text-plum/70 dark:bg-black/20 dark:text-pearl/70">
        {copy.local[language]}
      </p>
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
            </header>

            <section className="mb-10" aria-labelledby="wa-packages-heading">
              <h2
                id="wa-packages-heading"
                className="mb-4 font-heading text-lg font-bold text-plum/90 dark:text-pearl"
              >
                {copy.packages[language]}
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {packages.map((pkg) => (
                  <article key={pkg.id} className={`${sectionShell} flex flex-col`}>
                    <h3 className="font-heading text-sm font-bold leading-snug text-plum/92 dark:text-pearl">
                      {pkg.id.toUpperCase()}
                    </h3>
                    <p className="mt-2 text-lg font-bold text-[--color-primary] dark:text-lavender">
                      {listedPrice('package', pkg.fromEur, language)}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-plum/70 dark:text-pearl/65">
                      {packageScope(pkg, language)}
                    </p>
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs leading-snug text-plum/70 dark:text-pearl/65">
                      {SHARED_INCLUDES[language].map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section className="mb-10" aria-labelledby="wa-addons-heading">
              <h2
                id="wa-addons-heading"
                className="mb-4 font-heading text-lg font-bold text-plum/90 dark:text-pearl"
              >
                {copy.addons[language]}
              </h2>
              <ul className="grid min-w-0 gap-3 sm:grid-cols-2 sm:items-stretch">
                {optional.map((def) => (
                  <ServiceCard key={def.id} def={def} language={language} sectionShell={sectionShell} />
                ))}
              </ul>
            </section>

            <section className="mb-8" aria-labelledby="wa-ecommerce-heading">
              <h2
                id="wa-ecommerce-heading"
                className="mb-4 font-heading text-lg font-bold text-plum/90 dark:text-pearl"
              >
                {copy.ecommerce[language]}
              </h2>
              <ul className="grid min-w-0 gap-3 sm:grid-cols-3 sm:items-stretch">
                {ecommerce.map((def) => (
                  <ServiceCard key={def.id} def={def} language={language} sectionShell={sectionShell} />
                ))}
              </ul>
            </section>

            <section
              className="mb-8 rounded-2xl border border-amethyst/10 bg-plum/[0.035] px-4 py-4 text-left dark:border-lavender/12 dark:bg-white/[0.035] sm:px-5"
              aria-labelledby="wa-notes-heading"
            >
              <h2 id="wa-notes-heading" className="font-heading text-sm font-bold text-plum/88 dark:text-pearl">
                {copy.notesTitle[language]}
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-plum/70 dark:text-pearl/65">
                {copy.notes[language].map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          </div>
        </section>
      </main>
    </AnimatedPage>
  )
}

function ServiceCard({
  def,
  language,
  sectionShell,
}: {
  def: AddonDefinition
  language: 'hr' | 'en'
  sectionShell: string
}) {
  const execution = basicExecution(def, language)
  return (
    <li className={`${sectionShell} flex h-full min-w-0 flex-col`}>
      <p className="font-heading text-sm font-bold text-plum/90 dark:text-pearl">
        {addonLabel(def.id, language)}
      </p>
      <p className="mt-1 text-base font-bold text-[--color-primary] dark:text-lavender">
        {listedPrice(def.kind, def.unitEur, language)}
      </p>
      {execution ? (
        <p className="mt-1 text-xs text-plum/68 dark:text-pearl/62">{execution}</p>
      ) : null}
    </li>
  )
}
