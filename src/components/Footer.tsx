import { Link } from 'react-router-dom'
import { CONTACT_INFO } from '../config/contact'
import { usePublicDepartmentVisibility } from '../hooks/usePublicDepartmentVisibility'

interface FooterProps {
  language?: 'hr' | 'en'
}

const PHONE_TEL_HREF = `tel:${CONTACT_INFO.phone.replace(/\s/g, '')}`
const PHONE_DISPLAY = '095 552 6625'

const linkClass =
  'text-sm text-plum/80 underline-offset-2 transition-colors hover:text-[--color-primary] hover:underline dark:text-pearl/70 dark:hover:text-lavender'
const headingClass =
  'mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-plum/55 dark:text-pearl/50'

export default function Footer({ language = 'hr' }: FooterProps) {
  const visibility = usePublicDepartmentVisibility()
  const { interiors: showInteriorsSocial, lrc: showLrcSocial } = visibility
  const hasFooterSocialIcons = showInteriorsSocial || showLrcSocial

  const copy = {
    tagline: {
      hr: 'Svaka ideja je bitna!',
      en: 'Every idea matters!',
    },
    priceListsTitle: {
      hr: 'Cjenici usluga',
      en: 'Service price lists',
    },
    priceLists: {
      hr: 'Pogledaj cjenike',
      en: 'View price lists',
    },
    departments: {
      hr: 'Odjeli',
      en: 'Departments',
    },
    quickLinks: {
      hr: 'Brze poveznice',
      en: 'Quick links',
    },
    contact: {
      hr: 'Kontakt',
      en: 'Contact',
    },
    consultation: {
      hr: 'Savjetovanje / upit',
      en: 'Consultation / inquiry',
    },
    about: {
      hr: 'O nama',
      en: 'About',
    },
    faq: {
      hr: 'Česta pitanja',
      en: 'FAQ',
    },
    review: {
      hr: 'Ostavi recenziju',
      en: 'Leave a review',
    },
    privacy: {
      hr: 'Politika privatnosti',
      en: 'Privacy Policy',
    },
    lrc: { hr: 'LRC', en: 'LRC' },
    interiors: { hr: 'Interijeri', en: 'Interiors' },
    webAtelier: { hr: 'Web Atelier', en: 'Web Atelier' },
    copyright: {
      hr: "© 2026 Ani's Studio — ručno izrađeno i dizajnirano u Hrvatskoj",
      en: "© 2026 Ani's Studio — handcrafted and designed in Croatia",
    },
  }

  const departmentLinks = [
    { show: visibility.lrc, to: '/lrc', label: copy.lrc[language] },
    { show: visibility.interiors, to: '/interijeri', label: copy.interiors[language] },
    { show: visibility.webAtelier, to: '/web-atelier', label: copy.webAtelier[language] },
  ].filter((item) => item.show)

  return (
    <footer className="border-t border-[rgba(110,68,255,0.12)] dark:border-lavender/20 bg-gradient-to-b from-white to-[rgba(247,246,255,0.6)] dark:from-[#070812] dark:to-[#12101c]/95">
      {/* Full-width price-lists band — muted purple (light) / brighter lavender (dark) */}
      <div className="border-b border-amethyst/25 bg-[rgba(86,48,120,0.14)] dark:border-lavender/30 dark:bg-lavender/30">
        <div className="Section flex flex-col items-center gap-4 py-5 sm:py-6 md:flex-row md:items-center md:justify-between md:gap-6">
          <p className="hidden font-heading text-xl font-bold tracking-tight text-plum dark:text-pearl md:block md:text-2xl">
            {copy.priceListsTitle[language]}
          </p>

          <div className="flex w-full flex-col items-center gap-3 md:hidden">
            <img
              src="/logo-reference-purple.png"
              alt=""
              width={320}
              height={132}
              decoding="async"
              aria-hidden="true"
              className="mx-auto h-14 w-auto max-w-[min(70%,14rem)] object-contain object-center"
            />
            <Link
              to="/cjenici"
              className="public-action inline-flex min-h-[44px] w-full max-w-xs items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white"
            >
              {copy.priceLists[language]}
            </Link>
          </div>

          <Link
            to="/cjenici"
            className="public-action hidden min-h-[44px] items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold text-white md:inline-flex"
          >
            {copy.priceLists[language]}
          </Link>
        </div>
      </div>

      <section className="Section py-10 sm:py-12">
        {/* Mobile: stacked. Desktop: logo | Odjeli | Brze poveznice | Kontakt (top-aligned) */}
        <div className="grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-4 lg:gap-8 xl:gap-10">
          {/* Logo + tagline */}
          <div className="flex min-w-0 flex-col items-center gap-3 lg:items-start">
            <div className="group/logo-ft inline-flex items-center rounded-md">
              <span className="inline-block transition-[transform,filter] duration-300 ease-out group-hover/logo-ft:-translate-y-0.5 group-hover/logo-ft:drop-shadow-[0_12px_34px_rgba(110,68,255,0.24)] dark:group-hover/logo-ft:drop-shadow-[0_14px_38px_rgba(189,166,255,0.16)] [@media(prefers-reduced-motion:reduce)]:!translate-y-0 [@media(prefers-reduced-motion:reduce)]:transition-none [@media(prefers-reduced-motion:reduce)]:drop-shadow-none [@media(prefers-reduced-motion:reduce)]:group-hover/logo-ft:drop-shadow-none">
                <img
                  src="/logo-reference-purple.png"
                  alt="Ani's Studio"
                  width={640}
                  height={264}
                  decoding="async"
                  className="mx-auto block h-[7.5rem] w-auto max-w-[min(100%,28rem)] object-contain object-center sm:h-[8.5rem] lg:mx-0 lg:object-left md:h-[9.5rem]"
                />
              </span>
            </div>
            <p className="max-w-[22rem] text-center text-base font-semibold leading-snug text-plum/90 dark:text-pearl lg:text-left">
              {copy.tagline[language]}
            </p>
          </div>

          {/* Odjeli */}
          <div className="min-w-0">
            {departmentLinks.length > 0 ? (
              <>
                <h2 className={headingClass}>{copy.departments[language]}</h2>
                <ul className="flex flex-col gap-2.5">
                  {departmentLinks.map((item) => (
                    <li key={item.to}>
                      <Link to={item.to} className={linkClass}>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          {/* Brze poveznice */}
          <div className="min-w-0">
            <h2 className={headingClass}>{copy.quickLinks[language]}</h2>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link to="/o-nama" className={linkClass}>
                  {copy.about[language]}
                </Link>
              </li>
              <li>
                <Link to="/faq" className={linkClass}>
                  {copy.faq[language]}
                </Link>
              </li>
              <li>
                <Link to="/ostavi-recenziju" className={linkClass}>
                  {copy.review[language]}
                </Link>
              </li>
              <li>
                <Link to="/politika-privatnosti" className={linkClass}>
                  {copy.privacy[language]}
                </Link>
              </li>
            </ul>
          </div>

          {/* Kontakt + social */}
          <div className="min-w-0">
            <h2 className={headingClass}>{copy.contact[language]}</h2>
            <ul className="flex flex-col gap-2.5">
              <li>
                <a
                  href={`mailto:${CONTACT_INFO.email}`}
                  className={linkClass}
                  aria-label={`Email ${CONTACT_INFO.email}`}
                >
                  {CONTACT_INFO.email}
                </a>
              </li>
              <li>
                <a
                  href={PHONE_TEL_HREF}
                  className={linkClass}
                  aria-label={`${language === 'hr' ? 'Telefon' : 'Phone'} ${PHONE_DISPLAY}`}
                >
                  {PHONE_DISPLAY}
                </a>
              </li>
              <li>
                <Link to="/kontakt" className={linkClass}>
                  {copy.consultation[language]}
                </Link>
              </li>
            </ul>

            {hasFooterSocialIcons ? (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {showInteriorsSocial && (
                  <a
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(110,68,255,0.15)] bg-white/80 shadow-md backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:border-[#0077B5] hover:shadow-lg dark:border-lavender/20 dark:bg-white/8"
                    href="https://www.linkedin.com/in/anamarija-vinceti%C4%87-92118336/"
                    aria-label="LinkedIn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#0077B5' }}>
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </a>
                )}

                {showLrcSocial && (
                  <>
                    <a
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(110,68,255,0.15)] bg-white/80 shadow-md backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:border-transparent hover:shadow-lg dark:border-lavender/20 dark:bg-white/8"
                      href="https://www.instagram.com/ani.lrc/"
                      aria-label="Instagram"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                        <defs>
                          <linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#833AB4' }} />
                            <stop offset="50%" style={{ stopColor: '#FD1D1D' }} />
                            <stop offset="100%" style={{ stopColor: '#FCB045' }} />
                          </linearGradient>
                        </defs>
                        <path
                          fill="url(#instagram-gradient)"
                          d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
                        />
                      </svg>
                    </a>

                    <a
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(110,68,255,0.15)] bg-white/80 shadow-md backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:border-[#1877F2] hover:shadow-lg dark:border-lavender/20 dark:bg-white/8"
                      href="https://www.facebook.com/profile.php?id=61566842910187"
                      aria-label="Facebook"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#1877F2' }}>
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    </a>

                    <a
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(110,68,255,0.15)] bg-white/80 shadow-md backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:border-[#000000] hover:shadow-lg dark:border-lavender/20 dark:bg-white/8 dark:hover:border-slate-500"
                      href="https://www.tiktok.com/@ani.lrc"
                      aria-label="TikTok"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#000000' }}>
                        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                      </svg>
                    </a>

                    <a
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(110,68,255,0.15)] bg-white/80 shadow-md backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:border-[#FF0000] hover:shadow-lg dark:border-lavender/20 dark:bg-white/8"
                      href="https://www.youtube.com/channel/UCXbvukeRxI8_z6t_pNAscQQ"
                      aria-label="YouTube"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#FF0000' }}>
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                      </svg>
                    </a>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <p className="mt-8 max-w-full text-center text-sm text-plum/70 [overflow-wrap:anywhere] dark:text-pearl/55 sm:mt-10">
          {copy.copyright[language]}
        </p>
      </section>
    </footer>
  )
}
