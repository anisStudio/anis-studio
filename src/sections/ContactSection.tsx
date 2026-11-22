import { Link } from 'react-router-dom'
import { CONTACT_INFO } from '../config/contact'
import { Mail, Phone, MessageCircle, Zap, Users } from 'lucide-react'

/** Istovjetan format kao u CONTACT_INFO za tel: URI (bez razmaka). */
const PHONE_TEL_HREF = 'tel:+385955526625'

interface ContactSectionProps {
  language?: 'hr' | 'en'
}

export default function ContactSection({ language = 'hr' }: ContactSectionProps) {
  const translations = {
    title: {
      hr: 'Spremni za suradnju?',
      en: 'Ready to collaborate?'
    },
    subtitle: {
      hr: 'Pošaljite nam upit ili se javite direktno – odgovorimo brzo!',
      en: 'Send us an inquiry or contact us directly – we respond quickly!'
    },
    ctaButton: {
      hr: 'Pokreni projekt',
      en: "Let's start a project"
    },
    email: {
      hr: 'Email',
      en: 'Email'
    },
    phone: {
      hr: 'Telefon',
      en: 'Phone'
    },
    message: {
      hr: 'Poruka',
      en: 'Message'
    },
    socialProof: {
      projects: {
        hr: '50+ projekata',
        en: '50+ projects'
      },
      response: {
        hr: 'Najčešće u 24h',
        en: 'Usually within 24h'
      }
    }
  }

  return (
    <section id="kontakt" className="Section fade-in relative section-with-bg py-14 sm:py-16 md:py-20">
      {/* I8E-3C: samo homepage — bez sekcijskog wash wrappera; globalni body::before platno. */}

      <div className="relative z-10 mx-auto min-w-0 max-w-5xl px-4 sm:px-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-plum/90 dark:text-pearl">
            {translations.title[language]}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl px-1 text-base sm:text-lg text-plum/80 dark:text-pearl/70">
            {translations.subtitle[language]}
          </p>
        </div>

        {/* Contact Cards */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-3 sm:gap-5 md:gap-6">
          {/* Email Card — vodi na kontakt formu (bez mailto) */}
          <Link
            to="/kontakt#kontakt-forma"
            className="surface-premium group flex h-full flex-col rounded-2xl p-5 text-center sm:p-6
              hover:-translate-y-2 transition-all duration-300"
          >
            {/* Icon container with gradient */}
            <div className="flex justify-center">
              <div className="
                w-16 h-16 rounded-2xl flex items-center justify-center
                bg-gradient-to-br from-amethyst/20 to-lavender/20 
                dark:from-amethyst/40 dark:to-lavender/35
                group-hover:from-amethyst/30 group-hover:to-lavender/30
                transition-all duration-300
              ">
                <Mail className="w-7 h-7 text-amethyst dark:text-lavender" />
              </div>
            </div>
            <div className="mt-4 text-sm font-semibold text-plum/80 dark:text-pearl/80">
              {translations.email[language]}
            </div>
            <div className="mt-1 text-base font-bold text-plum/90 dark:text-white break-all group-hover:text-amethyst dark:group-hover:text-lavender transition-colors">
              {CONTACT_INFO.email}
            </div>
          </Link>

          {/* Phone Card — mobilni poziv (tel); desktop → forma (jedna grid ćelija) */}
          <div className="min-h-0">
            <a
              href={PHONE_TEL_HREF}
              className="surface-premium group flex h-full min-h-0 flex-col rounded-2xl p-5 text-center sm:p-6 md:hidden
              hover:-translate-y-2 transition-all duration-300"
            >
              <div className="flex justify-center">
                <div className="
                w-16 h-16 rounded-2xl flex items-center justify-center
                bg-gradient-to-br from-amethyst/20 to-lavender/20 
                dark:from-amethyst/40 dark:to-lavender/35
                group-hover:from-amethyst/30 group-hover:to-lavender/30
                transition-all duration-300
              ">
                  <Phone className="w-7 h-7 text-amethyst dark:text-lavender" />
                </div>
              </div>
              <div className="mt-4 text-sm font-semibold text-plum/80 dark:text-pearl/80">
                {translations.phone[language]}
              </div>
              <div className="mt-1 text-base font-bold text-plum/90 dark:text-white group-hover:text-amethyst dark:group-hover:text-lavender transition-colors">
                095 552 6625
              </div>
            </a>
            <Link
              to="/kontakt#kontakt-forma"
              className="surface-premium group hidden h-full min-h-0 flex-col rounded-2xl p-5 text-center sm:p-6 md:flex
              hover:-translate-y-2 transition-all duration-300"
            >
              <div className="flex justify-center">
                <div className="
                w-16 h-16 rounded-2xl flex items-center justify-center
                bg-gradient-to-br from-amethyst/20 to-lavender/20 
                dark:from-amethyst/40 dark:to-lavender/35
                group-hover:from-amethyst/30 group-hover:to-lavender/30
                transition-all duration-300
              ">
                  <Phone className="w-7 h-7 text-amethyst dark:text-lavender" />
                </div>
              </div>
              <div className="mt-4 text-sm font-semibold text-plum/80 dark:text-pearl/80">
                {translations.phone[language]}
              </div>
              <div className="mt-1 text-base font-bold text-plum/90 dark:text-white group-hover:text-amethyst dark:group-hover:text-lavender transition-colors">
                095 552 6625
              </div>
            </Link>
          </div>

          {/* Message Card */}
          <Link
            to="/kontakt"
            className="surface-premium group flex h-full flex-col rounded-2xl p-5 text-center sm:p-6
              hover:-translate-y-2 transition-all duration-300"
          >
            {/* Icon container with gradient */}
            <div className="flex justify-center">
              <div className="
                w-16 h-16 rounded-2xl flex items-center justify-center
                bg-gradient-to-br from-amethyst/20 to-lavender/20 
                dark:from-amethyst/40 dark:to-lavender/35
                group-hover:from-amethyst/30 group-hover:to-lavender/30
                transition-all duration-300
              ">
                <MessageCircle className="w-7 h-7 text-amethyst dark:text-lavender" />
              </div>
            </div>
            <div className="mt-4 text-sm font-semibold text-plum/80 dark:text-pearl/80">
              {translations.message[language]}
            </div>
            <div className="mt-1 text-base font-bold text-plum/90 dark:text-white group-hover:text-amethyst dark:group-hover:text-lavender transition-colors">
              {translations.ctaButton[language]}
            </div>
          </Link>
        </div>

        {/* CTA Button with glow pulse */}
        <div className="mt-12 flex justify-center">
          <Link
            to="/kontakt"
            className="inline-flex items-center justify-center rounded-2xl px-10 py-5 font-semibold text-white text-lg
              bg-amethyst
              hover:translate-y-[-2px]
              active:translate-y-0 
              transition-transform duration-200"
          >
            {translations.ctaButton[language]}
          </Link>
        </div>

        {/* Social Proof */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          <div className="flex items-center gap-2 text-plum/70 dark:text-pearl/90">
            <div className="w-10 h-10 rounded-full bg-amethyst/10 dark:bg-lavender/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-amethyst dark:text-lavender" />
            </div>
            <span className="text-sm sm:text-base font-medium">
              {translations.socialProof.projects[language]}
            </span>
          </div>
          
          <div className="hidden sm:block w-px h-6 bg-amethyst/20 dark:bg-lavender/30" />
          
          <div className="flex items-center gap-2 text-plum/70 dark:text-pearl/90">
            <div className="w-10 h-10 rounded-full bg-amethyst/10 dark:bg-lavender/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amethyst dark:text-lavender" />
            </div>
            <span className="text-sm sm:text-base font-medium">
              {translations.socialProof.response[language]}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
