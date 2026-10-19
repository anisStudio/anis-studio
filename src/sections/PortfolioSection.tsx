import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { usePortfolioItems, type PortfolioGridItem } from '../hooks/usePortfolioItems'
import { usePublicDepartmentVisibility } from '../hooks/usePublicDepartmentVisibility'

type PortfolioFilterCategory = 'all' | 'lrc' | 'interiors' | 'web-atelier'

/** Filter chip order; “Svi” (`all`) always first; category keys match `PortfolioGridItem.category` (e.g. `web-atelier`). */
const PORTFOLIO_FILTER_ORDER: readonly PortfolioFilterCategory[] = [
  'all',
  'lrc',
  'interiors',
  'web-atelier',
]

interface PortfolioSectionProps {
  language: 'hr' | 'en'
}

export default function PortfolioSection({ language }: PortfolioSectionProps) {
  const serviceVisibility = usePublicDepartmentVisibility()
  const translations = {
    title: {
      hr: 'Odabrani projekti 3D vizualizacije prostora',
      en: 'Selected 3D interior visualization projects',
    },
    subtitle: {
      hr: 'Primjeri prikaza rasporeda, materijala i atmosfere prije izvedbe. Portfolio se postupno nadopunjuje stvarnim projektima.',
      en: 'Examples of layout, materials and mood before execution. The portfolio grows as new real projects are added.',
    },
    categories: {
      hr: ['Svi', 'LRC', 'Interijeri', 'Web Atelier'],
      en: ['All', 'LRC', 'Interiors', 'Web Atelier']
    },
    placeholder: {
      hr: "Uskoro",
      en: "Coming soon"
    },
    portfolioCta: {
      heading: {
        hr: 'Sviđa vam se što vidite?',
        en: 'Like what you see?'
      },
      subline: {
        hr: 'Javite nam se kratkim upitom — pričamo o vašem projektu i sljedećim koracima.',
        en: "Send a short message — we'll talk about your project and next steps."
      },
      button: {
        hr: 'Pokreni projekt',
        en: "Let's start a project"
      }
    }
  }

  const [selectedCategory, setSelectedCategory] = useState<PortfolioFilterCategory>('all')
  const [lightboxItem, setLightboxItem] = useState<PortfolioGridItem | null>(null)

  const { items: portfolioItems, resolvedKind } = usePortfolioItems(language)
  const portfolioLoading = resolvedKind === 'loading'

  const visibleFilterCategories = useMemo(() => {
    const categoriesPresent = new Set(portfolioItems.map((item) => item.category))
    const out: PortfolioFilterCategory[] = ['all']
    for (const cat of PORTFOLIO_FILTER_ORDER) {
      if (cat === 'all') continue
      const adminOn =
        cat === 'lrc'
          ? serviceVisibility.lrc
          : cat === 'interiors'
            ? serviceVisibility.interiors
            : serviceVisibility.webAtelier
      if (adminOn && categoriesPresent.has(cat)) out.push(cat)
    }
    return out
  }, [portfolioItems, serviceVisibility])

  useEffect(() => {
    if (!visibleFilterCategories.includes(selectedCategory)) {
      setSelectedCategory('all')
    }
  }, [visibleFilterCategories, selectedCategory])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!lightboxItem) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [lightboxItem])

  // Category icons
  const categoryIcons: Record<string, string> = {
    'lrc': '🎁',
    'interiors': '🏠',
    'web-atelier': '💻'
  }

  const enabledCategorySet = useMemo(
    () => new Set(visibleFilterCategories.filter((c) => c !== 'all')),
    [visibleFilterCategories],
  )

  const filteredItems = useMemo(() => {
    const list =
      selectedCategory === 'all'
        ? portfolioItems.filter((item) => enabledCategorySet.has(item.category))
        : portfolioItems.filter((item) => item.category === selectedCategory)
    const useFallbackLimits =
      list.length === 0 || portfolioItems.every((item) => item.key.startsWith('fallback-'))
    return useFallbackLimits ? list.slice(0, 10) : list
  }, [portfolioItems, selectedCategory, enabledCategorySet])

  const lightboxNavItems = useMemo(
    () => filteredItems.filter((item) => !item.key.startsWith('fallback-')),
    [filteredItems]
  )

  const showLightboxNav = lightboxNavItems.length > 1

  useEffect(() => {
    if (!lightboxItem) return
    const stillInFilter = lightboxNavItems.some((item) => item.key === lightboxItem.key)
    if (!stillInFilter) setLightboxItem(null)
  }, [lightboxNavItems, lightboxItem])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!lightboxItem) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setLightboxItem(null)
        return
      }
      if (lightboxNavItems.length < 2) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const i = lightboxNavItems.findIndex((x) => x.key === lightboxItem.key)
        const idx =
          i < 0 ? lightboxNavItems.length - 1 : (i - 1 + lightboxNavItems.length) % lightboxNavItems.length
        setLightboxItem(lightboxNavItems[idx])
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        const i = lightboxNavItems.findIndex((x) => x.key === lightboxItem.key)
        const idx = i < 0 ? 0 : (i + 1) % lightboxNavItems.length
        setLightboxItem(lightboxNavItems[idx])
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [lightboxItem, lightboxNavItems])

  const gridClasses =
    'grid w-full grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 sm:gap-5 transition-opacity duration-300'

  const categoryLabelFor = (cat: PortfolioGridItem['category']) =>
    translations.categories[language][cat === 'lrc' ? 1 : cat === 'interiors' ? 2 : 3]

  const goLightboxPrev = () => {
    if (!lightboxItem || lightboxNavItems.length < 2) return
    const i = lightboxNavItems.findIndex((x) => x.key === lightboxItem.key)
    const idx = i < 0 ? lightboxNavItems.length - 1 : (i - 1 + lightboxNavItems.length) % lightboxNavItems.length
    setLightboxItem(lightboxNavItems[idx])
  }

  const goLightboxNext = () => {
    if (!lightboxItem || lightboxNavItems.length < 2) return
    const i = lightboxNavItems.findIndex((x) => x.key === lightboxItem.key)
    const idx = i < 0 ? 0 : (i + 1) % lightboxNavItems.length
    setLightboxItem(lightboxNavItems[idx])
  }

  const navBtnClass =
    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-violet-600 text-white shadow-lg touch-manipulation hover:bg-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111018]'

  // If no service category is publicly visible, skip the entire section.
  if (enabledCategorySet.size === 0) return null

  return (
    <section id="portfolio" className="section-with-bg relative overflow-x-clip px-4 py-10 sm:px-6 sm:py-12 md:px-8 md:py-14">
      {/* I8E-3C: samo homepage — pozadina je globalni canvas (body::before); bez sky/wash „ploče“. */}
      <div className="max-w-7xl mx-auto min-w-0 relative z-10">
        {/* Section Header */}
        <div className="mb-5 text-center sm:mb-6">
          <h2 className="mb-3 font-heading text-2xl font-bold tracking-tight text-balance text-plum/90 dark:text-pearl sm:mb-3 sm:text-3xl md:text-4xl">
            {translations.title[language]}
          </h2>
          <p className="mx-auto max-w-2xl px-1 text-base leading-relaxed text-plum/80 dark:text-pearl/75 sm:text-[1.0625rem]">
            {translations.subtitle[language]}
          </p>
        </div>

        {/* Category Filters - with glow on active */}
        <div className="mb-5 flex flex-wrap justify-center gap-2.5 sm:mb-6 sm:gap-3">
          {visibleFilterCategories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`
                px-5 py-2.5 rounded-full text-sm font-medium
                transition-all duration-300 border
                ${selectedCategory === category
                  ? 'bg-amethyst text-white border-amethyst shadow-[0_0_20px_rgba(110,68,255,0.4)] dark:shadow-[0_0_25px_rgba(189,166,255,0.35)]'
                  : 'bg-white/60 dark:bg-white/8 border-amethyst/20 dark:border-lavender/15 text-plum/90 dark:text-pearl hover:bg-amethyst/10 dark:hover:bg-lavender/10 hover:text-plum dark:hover:text-pearl'
                }
              `}
            >
              {translations.categories[language][category === 'all' ? 0 : category === 'lrc' ? 1 : category === 'interiors' ? 2 : 3]}
            </button>
          ))}
        </div>

        {/* Portfolio Grid — compact cards, centered block under heading/filters */}
        <div className="mx-auto w-full max-w-6xl">
          <div
            className={`${gridClasses} ${
              portfolioLoading ? 'opacity-95' : 'opacity-100'
            }`}
            aria-busy={portfolioLoading}
          >
          {filteredItems.map((item, index) => {
            const isFallbackItem = item.key.startsWith('fallback-')

            const cardClassName = `
                  surface-premium group flex h-full flex-col overflow-hidden rounded-2xl text-left
                  transition-all duration-300 hover:-translate-y-0.5
                  ${isFallbackItem ? 'cursor-default' : 'cursor-pointer'}`
            const cardStyle = { animationDelay: `${index * 50}ms` } as const

            const categoryChipLabel =
              translations.categories[language][
                item.category === 'lrc' ? 1 : item.category === 'interiors' ? 2 : 3
              ]

            const cardInner = (
              <>
                <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden border-b border-amethyst/[0.14] dark:border-lavender/10">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.imageAlt ?? ''}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-lavender/30 via-amethyst/20 to-lavender/30 dark:from-lavender/15 dark:via-amethyst/10 dark:to-lavender/15" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span
                          className="text-3xl opacity-60 transition-transform duration-300 group-hover:scale-105 dark:opacity-50"
                          aria-hidden
                        >
                          {categoryIcons[item.category]}
                        </span>
                        <p className="mt-1 text-[10px] font-medium text-plum/70 dark:text-pearl/50 sm:text-xs">
                          {translations.placeholder[language]}
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-3.5">
                  <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-plum/90 transition-colors dark:text-pearl group-hover:text-amethyst dark:group-hover:text-lavender sm:text-sm">
                    {item.title}
                  </h3>
                  <span className="mt-auto inline-flex w-fit max-w-full items-center gap-1 rounded-full border border-amethyst/20 bg-gradient-to-r from-amethyst/15 to-lavender/15 px-2 py-0.5 text-[10px] font-semibold text-amethyst dark:border-lavender/20 dark:from-amethyst/25 dark:to-lavender/20 dark:text-lavender sm:text-[11px]">
                    <span className="shrink-0 text-xs" aria-hidden>
                      {categoryIcons[item.category]}
                    </span>
                    <span className="truncate">{categoryChipLabel}</span>
                  </span>
                </div>
              </>
            )

            if (isFallbackItem) {
              return (
                <div key={item.key} className={cardClassName} style={cardStyle}>
                  {cardInner}
                </div>
              )
            }

            return (
              <button
                key={item.key}
                type="button"
                className={`${cardClassName} w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary] focus-visible:ring-offset-2 dark:focus-visible:ring-lavender/60 dark:focus-visible:ring-offset-slate-900`}
                style={cardStyle}
                onClick={() => setLightboxItem(item)}
                aria-label={
                  language === 'hr'
                    ? `Otvori povećani prikaz: ${item.title}`
                    : `Open enlarged preview: ${item.title}`
                }
              >
                {cardInner}
              </button>
            )
          })}
          </div>
        </div>

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-plum/80 dark:text-pearl/60 text-lg">
              {language === 'hr' ? 'Nema projekata u ovoj kategoriji.' : 'No projects in this category.'}
            </p>
          </div>
        )}

        {/* Conversion CTA — after portfolio grid */}
        <div className="mx-auto mt-8 max-w-xl sm:mt-10" aria-labelledby="portfolio-cta-heading">
          <div className="surface-premium rounded-2xl p-6 text-center sm:p-8">
            <h3
              id="portfolio-cta-heading"
              className="font-heading text-xl font-bold tracking-tight text-balance text-plum/95 dark:text-pearl sm:text-2xl"
            >
              {translations.portfolioCta.heading[language]}
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-plum/78 dark:text-pearl/72 sm:mt-4 sm:text-[0.9375rem] sm:leading-relaxed">
              {translations.portfolioCta.subline[language]}
            </p>
            <Link
              to="/kontakt"
              className="btn btn-primary mt-6 inline-flex min-h-[48px] w-full max-w-sm items-center justify-center px-8 py-3 text-base font-semibold shadow-md transition-all duration-300 hover:shadow-lg sm:mt-7 sm:w-auto sm:px-10 sm:py-3.5"
            >
              {translations.portfolioCta.button[language]}
            </Link>
          </div>
        </div>
      </div>

      {lightboxItem && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/80 px-4 py-6"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) setLightboxItem(null)
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="portfolio-lightbox-title"
                className="portfolio-lightbox-panel relative z-[9999] flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-y-auto overflow-x-hidden rounded-3xl border border-white/10 bg-[#111018] shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setLightboxItem(null)}
                  className="absolute right-3 top-3 z-30 flex items-center gap-2 rounded-full border border-white/20 bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-lg touch-manipulation hover:bg-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111018] sm:right-4 sm:top-4 sm:px-4 sm:py-2.5"
                  aria-label={language === 'hr' ? 'Zatvori prikaz' : 'Close preview'}
                >
                  <span>{language === 'hr' ? 'Zatvori' : 'Close'}</span>
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="flex min-h-0 flex-col gap-5 px-4 pb-8 pt-6 sm:px-6 sm:pb-10 sm:pt-8">
                  <div className="relative shrink-0">
                    {showLightboxNav ? (
                      <>
                        <button
                          type="button"
                          onClick={goLightboxPrev}
                          className={`${navBtnClass} absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 md:flex`}
                          aria-label={language === 'hr' ? 'Prethodna portfolio stavka' : 'Previous portfolio item'}
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={goLightboxNext}
                          className={`${navBtnClass} absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 md:flex`}
                          aria-label={language === 'hr' ? 'Sljedeća portfolio stavka' : 'Next portfolio item'}
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </>
                    ) : null}
                    {lightboxItem.imageUrl ? (
                      <div className="flex w-full min-h-0 min-w-0 shrink-0 justify-center rounded-xl bg-black/25 p-2 sm:p-4">
                        <img
                          src={lightboxItem.imageUrl}
                          alt={lightboxItem.imageAlt ?? ''}
                          decoding="async"
                          className="h-auto w-full max-h-[55vh] max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="relative flex aspect-[4/3] w-full max-h-[55vh] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-900/80">
                        <div className="absolute inset-0 bg-gradient-to-br from-amethyst/25 via-[#111018] to-plum/40" />
                        <div className="relative flex flex-col items-center">
                          <span className="mb-2 text-5xl opacity-70" aria-hidden>
                            {categoryIcons[lightboxItem.category]}
                          </span>
                          <p className="portfolio-lightbox-placeholder-caption text-sm font-medium text-zinc-400">
                            {translations.placeholder[language]}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {showLightboxNav ? (
                    <div className="flex shrink-0 items-center justify-center gap-10 md:hidden">
                      <button
                        type="button"
                        onClick={goLightboxPrev}
                        className={navBtnClass}
                        aria-label={language === 'hr' ? 'Prethodna portfolio stavka' : 'Previous portfolio item'}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={goLightboxNext}
                        className={navBtnClass}
                        aria-label={language === 'hr' ? 'Sljedeća portfolio stavka' : 'Next portfolio item'}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  ) : null}

                  <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-col items-center space-y-3 text-center sm:max-w-4xl">
                    <h2
                      id="portfolio-lightbox-title"
                      className="w-full text-balance font-heading text-xl font-bold leading-snug text-white sm:text-2xl"
                    >
                      {lightboxItem.title}
                    </h2>
                    {lightboxItem.description ? (
                      <p className="portfolio-lightbox-description w-full text-balance text-sm leading-relaxed text-zinc-200 sm:text-base sm:leading-relaxed">
                        {lightboxItem.description}
                      </p>
                    ) : null}
                    <span className="portfolio-lightbox-badge inline-flex max-w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-lavender/40 bg-lavender/15 px-3 py-1.5 text-xs font-semibold sm:text-sm">
                      <span className="shrink-0">{categoryIcons[lightboxItem.category]}</span>
                      <span>{categoryLabelFor(lightboxItem.category)}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  )
}
