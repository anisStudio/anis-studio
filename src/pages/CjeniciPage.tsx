import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatedPage } from '../components/AnimatedPage'
import { DecorativeSkyBackdrop } from '../components/DecorativeSkyBackdrop'
import { PageSEO } from '../components/PageSEO'
import { OfficialParraPriceListHubCta } from '../components/pricing/OfficialParraPriceListLink'
import { usePublicDepartmentVisibility } from '../hooks/usePublicDepartmentVisibility'
import { formatInteriorsPriceById } from '../lib/interiorsPricing'
import type { PublicService } from '../lib/publicServiceAccess'

interface CjeniciPageProps {
  language: 'hr' | 'en'
}

type HubDepartmentId = 'interijeri' | 'webAtelier' | 'lrc'

function PricingHubCard({
  image,
  title,
  subtitle,
  description,
  priceLine,
  status,
  cta,
}: {
  image: string
  title: string
  subtitle?: string
  description: string
  priceLine?: string
  status?: string
  cta?: { label: string; to: string }
}) {
  /** Half of hub circle (108px mobile / 128px sm+) — reserved in flow so grid row-gap clears the protrusion. */
  const circleTopClass = 'top-[3.375rem] sm:top-16'

  return (
    <div className="relative min-w-0 pt-[3.375rem] sm:pt-16 lg:h-full">
      <img
        src={image}
        alt=""
        aria-hidden
        width={128}
        height={128}
        decoding="async"
        loading="lazy"
        className={`pointer-events-none absolute left-1/2 z-10 size-[108px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amethyst/30 bg-white/90 object-cover object-center shadow-[0_8px_26px_rgba(110,68,255,0.2)] sm:size-[128px] dark:border-lavender/35 dark:bg-white/10 dark:shadow-[0_8px_28px_rgba(189,166,255,0.18)] ${circleTopClass}`}
      />
      <article
        className="flex min-h-[11rem] h-full flex-col rounded-2xl border border-amethyst/14 bg-white/65 px-4 pb-4 pt-[3.375rem] shadow-sm backdrop-blur-sm dark:border-lavender/14 dark:bg-white/[0.06] sm:min-h-[12rem] sm:px-5 sm:pb-5 sm:pt-16 lg:min-h-0"
      >
        <h2 className="font-heading text-base font-bold text-plum/92 dark:text-pearl sm:text-lg">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs font-medium tracking-wide text-plum/52 dark:text-pearl/48">
            {subtitle}
          </p>
        ) : null}
        <p className="mt-2 flex-1 text-sm leading-relaxed text-plum/72 dark:text-pearl/68">
          {description}
        </p>
        <div className="mt-auto">
          {priceLine ? (
            <p className="mt-3 text-lg font-bold text-[--color-primary] dark:text-lavender">{priceLine}</p>
          ) : null}
          {status ? (
            <p className="mt-3 text-sm font-medium text-plum/58 dark:text-pearl/55">{status}</p>
          ) : null}
          {cta ? (
            <Link
              to={cta.to}
              className="mt-4 inline-flex min-h-[40px] w-full items-center justify-center rounded-xl border border-amethyst/22 bg-white/80 px-4 py-2 text-sm font-semibold text-plum/88 transition hover:border-[--color-primary]/40 hover:bg-white dark:border-lavender/22 dark:bg-white/[0.08] dark:text-pearl dark:hover:bg-white/[0.12]"
            >
              {cta.label}
            </Link>
          ) : (
            <div className="mt-4 min-h-[40px]" aria-hidden />
          )}
        </div>
      </article>
    </div>
  )
}

const HUB_TO_SERVICE: Record<HubDepartmentId, PublicService> = {
  interijeri: 'interiors',
  lrc: 'lrc',
  webAtelier: 'webAtelier',
}

const HUB_DEPARTMENT_ORDER: readonly HubDepartmentId[] = ['lrc', 'interijeri', 'webAtelier']

export default function CjeniciPage({ language }: CjeniciPageProps) {
  const navigate = useNavigate()
  const visibility = usePublicDepartmentVisibility()

  useEffect(() => {
    if (window.location.hash === '#interijeri') {
      navigate('/cjenici/interijeri', { replace: true })
    }
  }, [navigate])

  const interiorsFromPrice = formatInteriorsPriceById('interior-small-set', language)

  const copy = {
    title: { hr: 'Cjenici', en: 'Price lists' },
    intro: {
      hr: "Pregledajte službeno objavljene cijene usluga i proizvoda Ani's Studija.",
      en: "View the officially published prices for Ani's Studio services and products.",
    },
    pricingGuide: {
      heading: { hr: 'Kako se formiraju cijene?', en: 'How are prices determined?' },
      lead: {
        hr: 'Odaberite odjel za dodatna objašnjenja cijena, opsega usluge i primjere.',
        en: 'Choose a department for additional information about pricing, service scope and examples.',
      },
    },
    departments: {
      interijeri: {
        image: '/images/pricing/interijeri.png',
        title: { hr: 'Interijeri', en: 'Interiors' },
        description: {
          hr: '3D idejna rješenja i vizualizacije interijera.',
          en: '3D concept designs and interior visualizations.',
        },
        cta: { hr: 'Detalji i primjeri cijena', en: 'Pricing details and examples' },
      },
      webAtelier: {
        image: '/images/pricing/web-atelier.png',
        title: { hr: 'Web Atelier', en: 'Web Atelier' },
        description: {
          hr: 'START od 300 €, PRO od 500 €, PREMIUM od 800 € — orijentacijski. U svakom paketu: responzivni prikaz, osnovni SEO i kontaktni obrazac. Hosting, domena i održavanje definiraju se ponudom.',
          en: 'START from €300, PRO from €500, PREMIUM from €800 — indicative. Every package: responsive layout, basic SEO, and a contact form. Hosting, domain, and maintenance are defined in the quote.',
        },
        status: {
          hr: 'Detalji i konfigurator u Web Atelier sekciji (kada je odjel javno dostupan)',
          en: 'Details and configurator in the Web Atelier section (when the department is publicly available)',
        },
      },
      lrc: {
        image: '/images/pricing/lrc.png',
        title: { hr: 'LRC', en: 'LRC' },
        acronym: { hr: 'Laser • Resin • Craft', en: 'Laser • Resin • Craft' },
        description: {
          hr: 'Personalizirani proizvodi, laserska izrada i graviranje.',
          en: 'Personalised products, laser work, and engraving.',
        },
        status: { hr: 'Objašnjenje uskoro', en: 'Explanation coming soon' },
      },
    },
  }

  const departments = useMemo(
    () => HUB_DEPARTMENT_ORDER.filter((id) => visibility[HUB_TO_SERVICE[id]] === true),
    [visibility],
  )

  const seoDescription = useMemo(() => {
    const names: string[] = []
    if (visibility.interiors) names.push(language === 'hr' ? 'Interijeri' : 'Interiors')
    if (visibility.webAtelier) names.push('Web Atelier')
    if (visibility.lrc) names.push('LRC')
    if (names.length === 0) {
      return language === 'hr'
        ? "Pregled cjenika Ani's Studija."
        : "Ani's Studio price list overview."
    }
    return language === 'hr'
      ? `Pregled cjenika po odjelima Ani's Studija — ${names.join(', ')}.`
      : `Price lists by Ani's Studio department — ${names.join(', ')}.`
  }, [visibility.interiors, visibility.lrc, visibility.webAtelier, language])

  return (
    <AnimatedPage>
      <PageSEO title="Cjenici" description={seoDescription} canonical="/cjenici" />
      <main className="min-w-0">
        <section className="Section fade-in relative section-with-bg overflow-x-clip">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <DecorativeSkyBackdrop priority="high" />
            <div className="absolute inset-0 section-bg-overlay-light dark:section-bg-overlay-dark" />
          </div>

          <div className="relative z-10 mx-auto min-w-0 max-w-5xl px-2 py-8 sm:px-4 sm:py-10 lg:py-12">
            <header className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
              <h1 className="font-heading text-3xl font-bold tracking-tight text-balance text-plum/95 dark:text-pearl sm:text-4xl">
                {copy.title[language]}
              </h1>
              <p className="mx-auto mt-4 text-base leading-relaxed text-plum/76 dark:text-pearl/72 sm:text-lg">
                {copy.intro[language]}
              </p>
            </header>

            <div className="mb-10 sm:mb-12">
              <OfficialParraPriceListHubCta language={language} />
            </div>

            <div className="mx-auto mb-4 max-w-2xl text-center sm:mb-5">
              <h2 className="font-heading text-lg font-bold tracking-tight text-plum/90 dark:text-pearl sm:text-xl">
                {copy.pricingGuide.heading[language]}
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-plum/72 dark:text-pearl/68 sm:text-base">
                {copy.pricingGuide.lead[language]}
              </p>
            </div>

            {!visibility.ready ? (
              <div
                className="flex min-h-[12rem] items-center justify-center py-10"
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
            ) : departments.length === 0 ? (
              <p className="mx-auto max-w-xl py-10 text-center text-sm text-plum/70 dark:text-pearl/65">
                {language === 'hr'
                  ? 'Trenutačno nema javno objavljenih odjelskih cjenika. Za upite koristite kontakt stranicu.'
                  : 'No department price lists are publicly available right now. Please use the contact page for inquiries.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 items-start gap-x-4 gap-y-20 pt-2 sm:grid-cols-2 sm:gap-y-16 sm:pt-3 lg:grid-cols-3 lg:items-stretch lg:gap-x-4 lg:gap-y-6 lg:pt-4">
                {departments.map((id) => {
                  const dept = copy.departments[id]
                  if (id === 'interijeri') {
                    return (
                      <PricingHubCard
                        key={id}
                        image={dept.image}
                        title={dept.title[language]}
                        description={dept.description[language]}
                        priceLine={interiorsFromPrice}
                        cta={{
                          label: copy.departments.interijeri.cta[language],
                          to: '/cjenici/interijeri',
                        }}
                      />
                    )
                  }
                  const lrcDept = copy.departments.lrc
                  const webDept = copy.departments.webAtelier
                  if (id === 'lrc') {
                    return (
                      <PricingHubCard
                        key={id}
                        image={lrcDept.image}
                        title={lrcDept.title[language]}
                        subtitle={lrcDept.acronym[language]}
                        description={lrcDept.description[language]}
                        status={lrcDept.status[language]}
                      />
                    )
                  }
                  return (
                    <PricingHubCard
                      key={id}
                      image={webDept.image}
                      title={webDept.title[language]}
                      description={webDept.description[language]}
                      status={webDept.status[language]}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </AnimatedPage>
  )
}
