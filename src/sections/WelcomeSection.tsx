import { Link } from 'react-router-dom'
import './welcome.css'
import { usePublicDepartmentVisibility } from '../hooks/usePublicDepartmentVisibility'
import { trackEvent } from '../lib/analytics'

interface WelcomeSectionProps {
  language?: 'hr' | 'en'
}

export default function WelcomeSection({ language = 'hr' }: WelcomeSectionProps) {
  const serviceCardVisibility = usePublicDepartmentVisibility()

  const visibleDepartments = [
    { visible: serviceCardVisibility.lrc, path: '/lrc', intent: 'lrc_service_page' },
    { visible: serviceCardVisibility.interiors, path: '/interijeri', intent: 'interiors_service_page' },
    { visible: serviceCardVisibility.webAtelier, path: '/web-atelier', intent: 'web_atelier_service_page' },
  ].filter(department => department.visible)
  const multipleDepartments = visibleDepartments.length > 1
  const primary = multipleDepartments
    ? { path: '#odjeli', intent: 'department_selection' }
    : visibleDepartments[0] ?? { path: '/kontakt', intent: 'contact_page' }

  const onlyInteriors = serviceCardVisibility.interiors && !serviceCardVisibility.lrc && !serviceCardVisibility.webAtelier

  const translations = {
    headline: {
      hr: 'Mjesto gdje ideje postaju stvarnost.',
      en: 'Where ideas become reality.'
    },
    subtitle: {
      hr: '3D vizualizacije interijera i kuhinja — prostor, raspored i materijale jasno vidite prije izvedbe. Fotorealistični prikaz moguć je po dogovoru, uz konzistentnu vizualnu priču.',
      en: '3D interior and kitchen visualizations — see space, layout, and materials clearly before work begins. Photorealistic rendering is available by arrangement, with a clear, cohesive visual story.',
    },
    bridge: {
      hr: [
        "Javni fokus Ani's Studija danas je na vizualnoj prezentaciji prostora: priprema prikaza prije gradnje ili montaže, kako biste donijeli odluke uz mir u glavi.",
        'Svaki projekt gradimo uz direktnu komunikaciju i transparentan tijek — bez agencijskog “telefona”, uz pažnju na stil, funkciju i realne detalje izvedbe.',
      ],
      en: [
        "Ani's Studio’s public focus is on visualizing spaces before work begins — so you can decide with confidence, from layout to materials and overall mood.",
        'We collaborate directly with a transparent process — no agency layers — with attention to style, function, and build-ready detail.',
      ],
    },
    ctaPrimary: {
      hr: 'Započnimo projekt',
      en: "Let's start a project"
    },
    ctaSecondary: {
      hr: 'Pogledaj radove',
      en: 'View our work'
    },
    cardsTitle: {
      hr: onlyInteriors ? 'Interijeri — tvoj sljedeći korak' : 'Kako vam možemo pomoći?',
      en: onlyInteriors ? 'Interiors — your next step' : 'How can we help?',
    },
    cards: {
      lrc: {
        title: { hr: 'Želim poklon koji ima priču', en: 'I want a gift with a story' },
        subtitle: { hr: 'LRC Shop', en: 'LRC Shop' },
        description: {
          hr: 'Personalizirani ručni radovi — lasersko graviranje, epoksidna smola, svila',
          en: 'Personalized handmade work — laser engraving, epoxy resin, silk',
        },
      },
      interiors: {
        title: { hr: 'Želim vidjeti prostor prije nego ga napravim', en: 'I want to see the space before I build it' },
        subtitle: { hr: 'Interijeri', en: 'Interiors' },
        description: {
          hr: '3D prikazi interijera — vidiš točno kako će izgledati',
          en: '3D interior renders — see exactly how it will look',
        },
      },
      webAtelier: {
        title: { hr: 'Trebam web koji donosi klijente', en: 'I need a website that brings clients' },
        subtitle: { hr: 'Web Atelier', en: 'Web Atelier' },
        description: {
          hr: 'Landing stranice za male biznise — brzo, profesionalno, bez komplikacija',
          en: 'Landing pages for small businesses — fast, professional, uncomplicated',
        },
      },
    }
  }

  return (
    <section id="welcome" className="relative min-h-[min(72svh,720px)] sm:min-h-[78vh] overflow-x-clip [isolation:isolate] section-with-bg">
      <div className="welcome-hero relative">
        <div aria-hidden="true" className="welcome-atrium" />
        <div className="welcome-content relative z-10 mx-auto min-w-0 max-w-5xl px-4 text-center sm:px-6">
          <div className="welcome-panel welcome-intro mx-auto max-w-[min(100%,34rem)] sm:max-w-2xl">
            <h1 className="font-heading font-extrabold tracking-tight break-words text-balance">
              {translations.headline[language]}
            </h1>
          {/* Subtitle */}
          <p className="mt-4 sm:mt-5 text-[0.9375rem] leading-relaxed sm:text-lg md:text-xl text-plum/80 dark:text-pearl/80">
            {translations.subtitle[language]}
          </p>
          </div>

          {/* CTA buttons */}
          <div className="mt-7 sm:mt-8 flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center sm:gap-4 mx-auto">
            <Link
              to={primary.path}
              reloadDocument={multipleDepartments}
              onClick={() =>
                trackEvent('homepage_line_click', {
                  line: 'welcome_primary_cta',
                  destination: primary.path,
                  intent: primary.intent,
                })
              }
              className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center rounded-2xl px-6 py-3.5 sm:px-8 sm:py-4 text-sm sm:text-base font-semibold text-white
                public-action">
              {translations.ctaPrimary[language]}
            </Link>

            <a
              href="#portfolio"
              className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center rounded-2xl px-6 py-3.5 sm:px-8 sm:py-4 text-sm sm:text-base font-semibold
                public-action">
              {translations.ctaSecondary[language]}
            </a>
          </div>

          {/* Bridge — što je Ani's Studio (interiors-first javni fokus) */}
          <div
            className="welcome-panel mx-auto mt-10 max-w-[min(100%,34rem)] space-y-4 border-t border-amethyst/10 px-1 pt-10 text-center dark:border-transparent sm:mt-12 sm:max-w-2xl sm:space-y-5 sm:pt-12"
            aria-labelledby="welcome-bridge-heading"
          >
            <h2 id="welcome-bridge-heading" className="sr-only">
              {language === 'hr' ? 'Što je Ani\'s Studio' : "What is Ani's Studio"}
            </h2>
            {translations.bridge[language].map((paragraph, i) => (
              <p
                key={i}
                className="text-[0.9375rem] leading-relaxed text-plum/78 dark:text-pearl/75 sm:text-base sm:leading-relaxed"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 pb-12 text-center sm:px-6 sm:pb-14">
        {/* Cards Section — only rendered when at least one service is publicly visible */}
        {visibleDepartments.length > 0 && (
        <>
        <h2 id="odjeli" tabIndex={-1} className="scroll-mt-28 welcome-services-title mt-10 font-heading text-2xl font-bold text-balance text-plum/90 dark:text-pearl sm:mt-14 sm:text-3xl">
          {translations.cardsTitle[language]}
        </h2>
        {multipleDepartments && (
          <p className="mx-auto mt-2 text-center text-base text-plum/90 dark:text-pearl/90">
            {language === 'hr' ? 'Odaberite karticu koja vas zanima.' : 'Choose the card that interests you.'}
          </p>
        )}

        <div className="welcome-services mt-5 flex flex-wrap justify-center gap-4 sm:mt-6 sm:gap-6">
          {/* LRC Shop Card */}
          {serviceCardVisibility.lrc ? (
          <Link
            to="/lrc"
            onClick={() => trackEvent('homepage_line_click', { line: 'lrc' })}
            className="surface-premium group relative rounded-[2rem] p-6 sm:p-8 text-center
            hover:-translate-y-2 transition-all duration-300 will-change-transform">
            {/* Project count badge */}
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                bg-amethyst/10 dark:bg-lavender/15 text-amethyst dark:text-lavender border border-amethyst/20 dark:border-lavender/20">
                50+
              </span>
            </div>
            <div className="flex flex-col items-center">
              <img src="/images/odjeli/poklon.webp" alt="" width="100" height="76" className="mb-4 h-[76px] w-[100px] object-contain" />
              <div>
                <div className="text-lg font-bold text-plum/90 dark:text-pearl group-hover:text-amethyst dark:group-hover:text-lavender transition-colors">{translations.cards.lrc.title[language]}</div>
                <div className="mt-1 text-sm font-semibold text-plum/80 dark:text-pearl/70">{translations.cards.lrc.subtitle[language]}</div>
                <p className="mt-3 text-xs text-plum/75 dark:text-pearl/60">
                  {translations.cards.lrc.description[language]}
                </p>
              </div>
            </div>
          </Link>
          ) : null}

          {/* Interijeri Card */}
          {serviceCardVisibility.interiors ? (
          <Link
            to="/interijeri"
            onClick={() => trackEvent('homepage_line_click', { line: 'interijeri' })}
            className="surface-premium group relative rounded-[2rem] p-6 sm:p-8 text-center
            hover:-translate-y-2 transition-all duration-300 will-change-transform">
            {/* Project count badge */}
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                bg-amethyst/10 dark:bg-lavender/15 text-amethyst dark:text-lavender border border-amethyst/20 dark:border-lavender/20">
                20+
              </span>
            </div>
            <div className="flex flex-col items-center">
              <img src="/images/odjeli/dnevni-boravak.webp" alt="" width="168" height="110" className="mb-4 h-auto w-[168px] max-w-full object-contain" />
              <div>
                <div className="text-lg font-bold text-plum/90 dark:text-pearl group-hover:text-amethyst dark:group-hover:text-lavender transition-colors">{translations.cards.interiors.title[language]}</div>
                <div className="mt-1 text-sm font-semibold text-plum/80 dark:text-pearl/70">{translations.cards.interiors.subtitle[language]}</div>
                <p className="mt-3 text-xs text-plum/75 dark:text-pearl/60">
                  {translations.cards.interiors.description[language]}
                </p>
              </div>
            </div>
          </Link>
          ) : null}

          {/* Web Atelier Card */}
          {serviceCardVisibility.webAtelier ? (
          <Link
            to="/web-atelier"
            onClick={() => trackEvent('homepage_line_click', { line: 'web-atelier' })}
            className="surface-premium group relative rounded-[2rem] p-6 sm:p-8 text-center
            hover:-translate-y-2 transition-all duration-300 will-change-transform">
            {/* Project count badge */}
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                bg-amethyst/10 dark:bg-lavender/15 text-amethyst dark:text-lavender border border-amethyst/20 dark:border-lavender/20">
                10+
              </span>
            </div>
            <div className="flex flex-col items-center">
              <img src="/images/odjeli/racunalo.webp" alt="" width="100" height="76" className="mb-4 h-[76px] w-[100px] object-contain" />
              <div>
                <div className="text-lg font-bold text-plum/90 dark:text-pearl group-hover:text-amethyst dark:group-hover:text-lavender transition-colors">{translations.cards.webAtelier.title[language]}</div>
                <div className="mt-1 text-sm font-semibold text-plum/80 dark:text-pearl/70">{translations.cards.webAtelier.subtitle[language]}</div>
                <p className="mt-3 text-xs text-plum/75 dark:text-pearl/60">
                  {translations.cards.webAtelier.description[language]}
                </p>
              </div>
            </div>
          </Link>
          ) : null}
        </div>
        </>
        )}
      </div>
    </section>
  )
}
