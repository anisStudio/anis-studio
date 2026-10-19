import { Link } from 'react-router-dom'
import { DecorativeSkyBackdrop } from '../components/DecorativeSkyBackdrop'
import { usePublicDepartmentVisibility } from '../hooks/usePublicDepartmentVisibility'
import { trackEvent } from '../lib/analytics'

interface WelcomeSectionProps {
  language?: 'hr' | 'en'
}

export default function WelcomeSection({ language = 'hr' }: WelcomeSectionProps) {
  const USE_IMAGE_BG = true
  const serviceCardVisibility = usePublicDepartmentVisibility()

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
      hr: serviceCardVisibility.interiors ? 'Interijeri — tvoj sljedeći korak' : 'Izaberite smjer',
      en: serviceCardVisibility.interiors ? 'Interiors — your next step' : 'Choose a direction',
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
      {/* CTA pulse + scroll cue arrow */}
      <style>{`
        @keyframes ctaPulse {
          0%, 100% { box-shadow: 0 18px 50px rgba(110,68,255,0.35); }
          50% { box-shadow: 0 18px 60px rgba(110,68,255,0.5), 0 0 20px rgba(110,68,255,0.3); }
        }
        @keyframes scrollCueArrow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(5px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .scroll-cue-arrow { animation: none !important; }
        }
      `}</style>
      {/* CLIP WRAPPER - contains only visual background layers */}
      <div className="absolute inset-0 overflow-hidden">
        {USE_IMAGE_BG ? (
          <>
            <div className="pointer-events-none absolute inset-0 z-[1]">
              <DecorativeSkyBackdrop priority="high" />
            </div>
          </>
        ) : (
          <>
            {/* Placeholder gradient (light) */}
            <div
              className="pointer-events-none absolute inset-0 z-[1] dark:hidden"
              style={{
                background:
                  "radial-gradient(circle at 50% 20%, rgba(189,166,255,0.55), transparent 60%), radial-gradient(circle at 20% 60%, rgba(110,68,255,0.18), transparent 55%), radial-gradient(circle at 80% 65%, rgba(120,220,255,0.14), transparent 55%), linear-gradient(180deg, rgba(255,255,255,0.96), rgba(249,247,251,0.9))",
              }}
            />
            {/* Placeholder gradient (dark) */}
            <div
              className="pointer-events-none absolute inset-0 z-[1] hidden dark:block"
              style={{
                background:
                  "radial-gradient(circle at 50% 20%, rgba(110,68,255,0.35), transparent 60%), radial-gradient(circle at 80% 65%, rgba(120,220,255,0.18), transparent 55%), linear-gradient(180deg, rgba(7,8,18,0.65), rgba(7,8,18,0.95))",
              }}
            />
          </>
        )}

        {/* Noise overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-[3] opacity-[0.06] mix-blend-overlay dark:opacity-[0.08] dark:mix-blend-soft-light"
          style={{ backgroundImage: "url(/noise.svg)", backgroundSize: "260px 260px" }}
        />

        {/* I8E-3E: SparklesCanvas uklonjen — animirani krugovi uzlazno izgledali su kao mjehurići vode. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-36 dark:hidden sm:h-44"
          style={{
            background:
              'linear-gradient(to bottom, rgba(245,243,250,0) 0%, rgba(189,166,255,0.028) 42%, rgba(245,243,250,0.038) 72%, rgba(245,243,250,0.055) 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-32 hidden dark:block sm:h-40"
          style={{
            background:
              'linear-gradient(to bottom, rgba(7,8,18,0) 0%, rgba(110,68,255,0.04) 38%, rgba(7,8,18,0.045) 100%)',
          }}
        />
      </div>

      {/* Content wrapper */}
      <div className="relative z-10 mx-auto min-w-0 max-w-5xl px-4 pb-12 pt-20 text-center sm:px-6 sm:pb-14 sm:pt-24">
        {/* Subtle glow behind heading */}
        <div 
          className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 z-[9] h-40 w-[min(520px,calc(100vw-2rem))] max-w-full rounded-full blur-2xl dark:hidden"
          style={{
            background: 'radial-gradient(circle, rgba(110,68,255,0.22), transparent 60%)'
          }}
        />
        <div 
          className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 z-[9] h-40 w-[min(520px,calc(100vw-2rem))] max-w-full rounded-full blur-2xl hidden dark:block"
          style={{
            background: 'radial-gradient(circle, rgba(189,166,255,0.14), transparent 60%)'
          }}
        />

        {/* Hero text block — constrained width for readability */}
        <div className="mx-auto max-w-[min(100%,34rem)] sm:max-w-2xl">
        {/* Headline */}
        <h1 className="font-heading text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight break-words text-balance
          text-plum/90 dark:text-pearl drop-shadow-[0_14px_40px_rgba(110,68,255,0.18)]">
          {translations.headline[language]}
          <span className="ml-1.5 sm:ml-3 inline-block align-middle">✨</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-4 sm:mt-5 text-[0.9375rem] leading-relaxed sm:text-lg md:text-xl text-plum/80 dark:text-pearl/80">
          {translations.subtitle[language]}
        </p>
        </div>

        {/* CTA buttons */}
        <div className="mt-7 sm:mt-8 flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center sm:gap-4 mx-auto">
          <Link
            to={serviceCardVisibility.interiors ? '/interijeri' : '/kontakt'}
            onClick={() =>
              trackEvent('homepage_line_click', {
                line: 'welcome_primary_cta',
                destination: serviceCardVisibility.interiors ? '/interijeri' : '/kontakt',
                intent: serviceCardVisibility.interiors ? 'interiors_service_page' : 'contact_page',
              })
            }
            className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center rounded-2xl px-6 py-3.5 sm:px-8 sm:py-4 text-sm sm:text-base font-semibold text-white
              bg-amethyst
              hover:translate-y-[-1px] hover:shadow-[0_24px_70px_rgba(110,68,255,0.45)]
              active:translate-y-0 transition-transform duration-200 will-change-transform"
            style={{ animation: 'ctaPulse 3s ease-in-out infinite' }}>
            {translations.ctaPrimary[language]}
          </Link>

          <a
            href="#portfolio"
            className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center rounded-2xl px-6 py-3.5 sm:px-8 sm:py-4 text-sm sm:text-base font-semibold
              text-plum/90 dark:text-pearl border border-amethyst/25 dark:border-lavender/20
              bg-white/55 dark:bg-white/8 backdrop-blur-2xl
              shadow-[0_10px_30px_rgba(0,0,0,0.06)]
              hover:bg-white/70 dark:hover:bg-white/12 transition">
            {translations.ctaSecondary[language]}
          </a>
        </div>

        {/* Scroll indicator — text-first SCROLL cue */}
        <div className="mt-10 flex justify-center">
          <a
            href="#portfolio"
            className="group inline-flex min-h-[48px] flex-col items-center justify-center gap-2.5 rounded-2xl px-6 py-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amethyst/40 dark:focus-visible:outline-lavender/40"
            aria-label={language === 'hr' ? 'Scroll do istaknutih radova' : 'Scroll to featured work'}
          >
            <span className="text-[0.6875rem] sm:text-xs font-semibold tracking-[0.38em] text-plum/50 dark:text-pearl/55 group-hover:text-amethyst/85 dark:group-hover:text-lavender/80 transition-colors">
              SCROLL
            </span>
            <span
              className="scroll-cue-arrow flex flex-col items-center text-amethyst dark:text-lavender"
              aria-hidden="true"
              style={{ animation: 'scrollCueArrow 2.8s ease-in-out infinite' }}
            >
              <svg
                className="h-5 w-5 shrink-0 opacity-95 drop-shadow-[0_1px_2px_rgba(110,68,255,0.4)] dark:drop-shadow-[0_1px_3px_rgba(189,166,255,0.5)]"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </a>
        </div>

        {/* Bridge — što je Ani's Studio (interiors-first javni fokus) */}
        <div
          className="mx-auto mt-10 max-w-[min(100%,34rem)] space-y-4 border-t border-amethyst/10 px-1 pt-10 text-center dark:border-transparent sm:mt-12 sm:max-w-2xl sm:space-y-5 sm:pt-12"
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

        {/* Cards Section — only rendered when at least one service is publicly visible */}
        {(serviceCardVisibility.lrc || serviceCardVisibility.interiors || serviceCardVisibility.webAtelier) && (
        <>
        <h2 className="mt-10 font-heading text-2xl font-bold text-balance text-plum/90 dark:text-pearl sm:mt-14 sm:text-3xl">
          {translations.cardsTitle[language]}
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:mt-6 sm:gap-6 md:grid-cols-3">
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
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300" role="img" aria-label="Gift">
                🎁
              </div>
              <div>
                <div className="text-lg font-bold text-plum/90 dark:text-pearl group-hover:text-amethyst dark:group-hover:text-lavender transition-colors">{translations.cards.lrc.title[language]}</div>
                <div className="mt-1 text-sm font-semibold text-plum/80 dark:text-pearl/70">{translations.cards.lrc.subtitle[language]}</div>
                <p className="mt-3 text-xs text-plum/75 dark:text-pearl/60">
                  {translations.cards.lrc.description[language]}
                </p>
              </div>
            </div>
          </Link>
          ) : (
            <div
              className="pointer-events-none hidden min-h-0 select-none md:block"
              aria-hidden="true"
            />
          )}

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
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300" role="img" aria-label="House">
                🏠
              </div>
              <div>
                <div className="text-lg font-bold text-plum/90 dark:text-pearl group-hover:text-amethyst dark:group-hover:text-lavender transition-colors">{translations.cards.interiors.title[language]}</div>
                <div className="mt-1 text-sm font-semibold text-plum/80 dark:text-pearl/70">{translations.cards.interiors.subtitle[language]}</div>
                <p className="mt-3 text-xs text-plum/75 dark:text-pearl/60">
                  {translations.cards.interiors.description[language]}
                </p>
              </div>
            </div>
          </Link>
          ) : (
            <div
              className="pointer-events-none hidden min-h-0 select-none md:block"
              aria-hidden="true"
            />
          )}

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
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300" role="img" aria-label="Laptop">
                💻
              </div>
              <div>
                <div className="text-lg font-bold text-plum/90 dark:text-pearl group-hover:text-amethyst dark:group-hover:text-lavender transition-colors">{translations.cards.webAtelier.title[language]}</div>
                <div className="mt-1 text-sm font-semibold text-plum/80 dark:text-pearl/70">{translations.cards.webAtelier.subtitle[language]}</div>
                <p className="mt-3 text-xs text-plum/75 dark:text-pearl/60">
                  {translations.cards.webAtelier.description[language]}
                </p>
              </div>
            </div>
          </Link>
          ) : (
            <div
              className="pointer-events-none hidden min-h-0 select-none md:block"
              aria-hidden="true"
            />
          )}
        </div>
        </>
        )}
      </div>
    </section>
  )
}
