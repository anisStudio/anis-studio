import { Link } from 'react-router-dom'
import { STARLINK_HR_PATH } from '../config/starlinkHr'

interface StarlinkHomeCardProps {
  language: 'hr' | 'en'
}

const copy = {
  label: {
    hr: 'Referral pogodnost',
    en: 'Referral benefit',
  },
  title: {
    hr: '1 mjesec Starlink usluge bez naknade',
    en: '1 month of Starlink service at no charge',
  },
  text: {
    hr: 'Putem moje referral poveznice vi možete dobiti jedan mjesec usluge bez naknade, a pogodnost mogu dobiti i ja. Prije narudžbe pročitajte kratki vodič na hrvatskom.',
    en: 'Through my referral link, you may receive one month of service at no charge, and I may also receive a referral benefit. Read the short guide before ordering.',
  },
  button: {
    hr: 'Otvori vodič',
    en: 'Open the guide',
  },
} as const

/**
 * Discrete homepage strip — not a fourth studio service card.
 */
export default function StarlinkHomeCard({ language }: StarlinkHomeCardProps) {
  return (
    <section
      className="px-4 sm:px-6"
      aria-labelledby="starlink-home-card-heading"
    >
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 rounded-2xl border border-[rgba(110,68,255,0.1)] bg-white/35 px-5 py-5 backdrop-blur-sm dark:border-lavender/10 dark:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-6 sm:py-4">
          <img
            src="/images/starlink-preporuka.webp"
            alt=""
            width={120}
            height={120}
            className="mx-auto h-24 w-24 shrink-0 object-contain sm:mx-0 sm:h-28 sm:w-28"
            loading="lazy"
            decoding="async"
          />
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-plum/50 dark:text-pearl/55">
              {copy.label[language]}
            </p>
            <h2
              id="starlink-home-card-heading"
              className="mt-1 font-heading text-lg font-bold tracking-tight text-balance text-plum/90 dark:text-pearl max-sm:text-center sm:text-xl"
            >
              {copy.title[language]}
            </h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-plum/72 dark:text-pearl/70">
              {copy.text[language]}
            </p>
          </div>
          <Link
            to={STARLINK_HR_PATH}
            className="btn btn-secondary inline-flex min-h-[44px] w-full shrink-0 items-center justify-center !whitespace-normal px-5 py-2.5 text-sm sm:w-auto"
          >
            {copy.button[language]}
          </Link>
        </div>
      </div>
    </section>
  )
}
