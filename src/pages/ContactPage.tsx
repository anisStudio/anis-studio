import { Link } from 'react-router-dom'
import ContactSection from '../components/ContactSection'
import { AnimatedPage } from '../components/AnimatedPage'
import { PageSEO } from '../components/PageSEO'
import { CONTACT_INFO } from '../config/contact'
import { ErrorBoundary } from '../ErrorBoundary'
import { usePublicDepartmentVisibility } from '../hooks/usePublicDepartmentVisibility'

interface ContactPageProps {
  language: 'hr' | 'en'
}

type ContactServiceRoutingKey = 'lrc' | 'interiors' | 'webAtelier'

type ContactServiceVisibility = Record<ContactServiceRoutingKey, boolean>

function getServiceRoutingCopy(
  language: 'hr' | 'en',
  vis: ContactServiceVisibility,
): { title: string; subtitle: string } {
  const activeCount =
    Number(vis.lrc) + Number(vis.interiors) + Number(vis.webAtelier)

  const multi =
    language === 'hr'
      ? {
          title: 'Odaberite smjer upita',
          subtitle:
            'Odaberite smjer koji vam treba ili nam pošaljite opći upit u nastavku. Ako niste sigurni, javite se porukom i usmjerit ćemo vas.',
        }
      : {
          title: 'Choose your inquiry path',
          subtitle:
            'Choose the service direction you need or send a general inquiry below. If you are not sure, message us and we will guide you.',
        }

  if (activeCount >= 2) {
    return multi
  }

  if (activeCount === 1) {
    if (vis.interiors) {
      return language === 'hr'
        ? {
            title: 'Znate što vam treba?',
            subtitle:
              'Za 3D vizualizacije interijera najbrži put je stranica Interijeri ili opća forma u nastavku. Ostalo možemo dogovoriti mailom ili porukom.',
          }
        : {
            title: 'Know what you need?',
            subtitle:
              'For 3D interior visualizations, the fastest path is the Interiors page or the general form below. We can clarify the rest by email or message.',
          }
    }
    if (vis.lrc) {
      return language === 'hr'
        ? {
            title: 'Upit za LRC radove',
            subtitle:
              'Za personalizirane radove i proizvode odaberite LRC upit ili nam pošaljite opću poruku u nastavku.',
          }
        : {
            title: 'LRC inquiry',
            subtitle:
              'For personalized handmade products, choose the LRC inquiry path or send a general message below.',
          }
    }
    if (vis.webAtelier) {
      return language === 'hr'
        ? {
            title: 'Upit za Web Atelier',
            subtitle:
              'Za web stranicu, landing page ili vizualnu prezentaciju brenda odaberite Web Atelier ili nam pošaljite opću poruku u nastavku.',
          }
        : {
            title: 'Web Atelier inquiry',
            subtitle:
              'For a website, landing page or brand presentation, choose Web Atelier or send a general message below.',
          }
    }
  }

  return multi
}

export default function ContactPage({ language }: ContactPageProps) {
  const contactServiceVisibility = usePublicDepartmentVisibility()

  const translations = {
    introTitle: {
      hr: "📧 Javite nam se",
      en: "📧 Get in Touch"
    },
    introText: {
      hr: "Imate pitanje ili želite započeti projekt? Kontaktirajte nas putem forme ispod ili koristite kontakt podatke.",
      en: "Have a question or want to start a project? Contact us via the form below or use the contact information."
    },
    contactInfo: {
      hr: {
        email: "Email",
        phone: "Telefon"
      },
      en: {
        email: "Email",
        phone: "Phone"
      }
    },
    serviceRouting: {
      links: {
        hr: [
          { key: 'lrc' as const, label: 'LRC upit', to: '/lrc/upit' },
          { key: 'interiors' as const, label: 'Interijeri', to: '/interijeri' },
          { key: 'webAtelier' as const, label: 'Web Atelier', to: '/web-atelier/upit' }
        ],
        en: [
          { key: 'lrc' as const, label: 'LRC inquiry', to: '/lrc/upit' },
          { key: 'interiors' as const, label: 'Interiors', to: '/interijeri' },
          { key: 'webAtelier' as const, label: 'Web Atelier', to: '/web-atelier/upit' }
        ]
      }
    }
  }

  const visibleServiceLinks = translations.serviceRouting.links[language].filter(
    (item) => contactServiceVisibility[item.key],
  )

  const serviceRoutingCopy = getServiceRoutingCopy(language, contactServiceVisibility)

  return (
    <AnimatedPage>
      <PageSEO
        title="Kontakt"
        description="Kontaktirajte Ani's Studio za upit, projekt ili suradnju. Dostupni smo putem e-maila, telefona i kontakt forme."
        canonical="/kontakt"
      />
      <main className="min-w-0">
      {/* Intro + contact cards */}
      <section className="Section fade-in">
        <div className="mx-auto min-w-0 max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-14 lg:px-8 lg:py-16">
          <h1 className="mb-5 font-heading text-3xl font-bold tracking-tight text-balance text-plum/95 dark:text-pearl sm:mb-6 sm:text-4xl md:text-[2.35rem] md:leading-tight">
            {translations.introTitle[language]}
          </h1>
          <p className="mx-auto mb-9 max-w-xl text-pretty text-base leading-[1.65] text-plum/82 dark:text-pearl/80 sm:mb-11 sm:text-lg sm:leading-relaxed">
            {translations.introText[language]}
          </p>

          <div className="mx-auto flex w-full max-w-2xl flex-col items-stretch justify-center gap-4 sm:max-w-none sm:flex-row sm:items-stretch sm:justify-center sm:gap-5 md:gap-6">
            <div className="flex w-full items-center gap-3 rounded-2xl border border-[rgba(110,68,255,0.16)] bg-white/85 px-5 py-4 text-left shadow-md backdrop-blur-sm dark:border-lavender/18 dark:bg-white/[0.07] sm:min-w-[260px] sm:flex-1 sm:max-w-xs">
              <span className="text-2xl shrink-0" aria-hidden>
                📧
              </span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-[--color-ink-muted] dark:text-pearl/70">
                  {translations.contactInfo[language].email}
                </div>
                <a
                  href="#kontakt-forma"
                  className="break-all text-sm font-semibold text-[--color-primary] transition-colors hover:underline dark:text-lavender"
                >
                  {CONTACT_INFO.email}
                </a>
              </div>
            </div>

            <div className="flex w-full items-center gap-3 rounded-2xl border border-[rgba(110,68,255,0.16)] bg-white/85 px-5 py-4 text-left shadow-md backdrop-blur-sm dark:border-lavender/18 dark:bg-white/[0.07] sm:min-w-[260px] sm:flex-1 sm:max-w-xs">
              <span className="text-2xl shrink-0" aria-hidden>
                📞
              </span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-[--color-ink-muted] dark:text-pearl/70">
                  {translations.contactInfo[language].phone}
                </div>
                <a
                  href={`tel:${CONTACT_INFO.phone.replace(/\s/g, '')}`}
                  className="text-sm font-semibold text-[--color-primary] transition-colors hover:underline dark:text-lavender md:hidden"
                >
                  {CONTACT_INFO.phone}
                </a>
                <a
                  href="#kontakt-forma"
                  className="hidden text-sm font-semibold text-[--color-primary] transition-colors hover:underline dark:text-lavender md:inline"
                >
                  {CONTACT_INFO.phone}
                </a>
              </div>
            </div>
          </div>
        </div>
        <div
          className="mx-auto max-w-3xl border-b border-[rgba(110,68,255,0.1)] px-4 sm:px-6 lg:px-8 dark:border-lavender/12"
          aria-hidden
        />
      </section>

      {/* Service-specific inquiry shortcuts */}
      <section
        className="Section fade-in px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8"
        aria-labelledby="contact-service-routing-heading"
      >
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-[rgba(110,68,255,0.12)] bg-white/50 p-5 text-center shadow-[0_8px_40px_rgba(46,36,71,0.06)] backdrop-blur-md dark:border-lavender/12 dark:bg-white/[0.04] dark:shadow-[0_12px_48px_rgba(0,0,0,0.25)] sm:p-6">
            <h2
              id="contact-service-routing-heading"
              className="font-heading text-base font-bold tracking-tight text-balance text-plum/95 dark:text-pearl sm:text-lg"
            >
              {serviceRoutingCopy.title}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-plum/78 dark:text-pearl/72 sm:text-[0.9375rem]">
              {serviceRoutingCopy.subtitle}
            </p>
            <nav
              className="mt-5 flex flex-col items-stretch gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-3"
              aria-label={language === 'hr' ? 'Izravni upiti po uslugama' : 'Service-specific inquiries'}
            >
              {visibleServiceLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[rgba(110,68,255,0.2)] bg-white/80 px-4 py-2.5 text-sm font-semibold text-[--color-primary] shadow-sm transition-all duration-200 hover:border-[--color-primary]/40 hover:bg-amethyst/5 dark:border-lavender/25 dark:bg-white/[0.06] dark:text-lavender dark:hover:bg-white/10"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <ErrorBoundary name="Contact">
        <ContactSection language={language} />
      </ErrorBoundary>
    </main>
    </AnimatedPage>
  )
}




