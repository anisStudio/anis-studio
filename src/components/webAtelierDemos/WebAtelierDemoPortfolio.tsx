import { Link } from 'react-router-dom'
import { trackEvent } from '../../lib/analytics'
import { WEB_ATELIER_DEMOS, demoBannerText, type WebAtelierDemoSlug } from '../../lib/webAtelierDemos'
import { DEMO_PHOTO_PUBLIC_DIR } from './photoSlot'
import './webAtelierDemos.css'

interface Props {
  language: 'hr' | 'en'
  /** Public pages keep the inquiry link. DEV preview passes false. */
  enableInquiryLinks?: boolean
}

/** Real page screenshots for the three portfolio cards. Kept at 16:10 to match the card frame. */
const CARD_COVERS: Record<WebAtelierDemoSlug, { file: string; alt: { hr: string; en: string } }> = {
  cvjecarna: {
    file: 'wa-demo-cvjecarna.webp',
    alt: {
      hr: 'Snimka demo stranice Cvjećarnica — START',
      en: 'Screenshot of the Florist — START demo page',
    },
  },
  grooming: {
    file: 'wa-demo-grooming.webp',
    alt: {
      hr: 'Snimka demo stranice Salon za njegu ljubimaca — PRO',
      en: 'Screenshot of the Pet grooming salon — PRO demo page',
    },
  },
  interijeri: {
    file: 'wa-demo-interijeri.webp',
    alt: {
      hr: 'Snimka demo stranice Studio interijera — PREMIUM',
      en: 'Screenshot of the Interior studio — PREMIUM demo page',
    },
  },
}

export function WebAtelierDemoPortfolio({ language, enableInquiryLinks = true }: Props) {
  const hr = language === 'hr'

  return (
    <div className="wa-demo-portfolio" id="web-atelier-demos">
      <div className="mx-auto mb-6 max-w-3xl text-center sm:mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-amethyst dark:text-lavender">
          {demoBannerText(language)}
        </p>
        <h3 className="mt-2 font-heading text-xl font-bold text-balance text-plum dark:text-pearl sm:text-2xl">
          {hr ? 'Tri demo koncepta' : 'Three demo concepts'}
        </h3>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-plum/78 dark:text-pearl/72 sm:text-[0.9375rem]">
          {hr
            ? 'Fiktivni primjeri za START, PRO i PREMIUM — da se vidi vizualni smjer studija. Nisu stvarni klijentski projekti ni rezultati suradnje.'
            : 'Fictional START, PRO, and PREMIUM examples that show the studio’s visual direction. Not real client projects or collaboration results.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
        {WEB_ATELIER_DEMOS.map((demo) => (
          <article key={demo.slug} className="wa-demo-card fade-in">
            <div className="wa-demo-card-visual">
              <img
                className="wa-demo-card-cover"
                src={`${DEMO_PHOTO_PUBLIC_DIR}/${CARD_COVERS[demo.slug].file}`}
                alt={CARD_COVERS[demo.slug].alt[language]}
                width={800}
                height={500}
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="wa-demo-card-body">
              <p className="wa-demo-card-meta">{demo.accentLabel[language]}</p>
              <h4>{demo.title[language]}</h4>
              <p>{demo.summary[language]}</p>
              <Link
                to={enableInquiryLinks ? demo.path : `/dev/web-atelier/demo/${demo.slug}`}
                className="wa-demo-card-link"
                onClick={() =>
                  trackEvent('inquiry_cta_click', {
                    source: `web-atelier-demo-card-${demo.slug}`,
                  })
                }
              >
                {hr ? 'Otvori demo pregled' : 'Open demo preview'}
              </Link>
            </div>
          </article>
        ))}
      </div>

      <p className="mx-auto mt-5 max-w-2xl text-center text-xs text-plum/65 dark:text-pearl/60">
        {hr ? (
          <>
            Nakon pregleda možeš nastaviti na{' '}
            <a className="underline" href="#web-atelier-configurator">
              konfigurator
            </a>{' '}
            ili{' '}
            {enableInquiryLinks ? (
              <Link className="underline" to="/web-atelier/upit">
                formu za upit
              </Link>
            ) : (
              <span>formu za upit</span>
            )}
            .
          </>
        ) : (
          <>
            After previewing, continue to the{' '}
            <a className="underline" href="#web-atelier-configurator">
              configurator
            </a>{' '}
            or{' '}
            {enableInquiryLinks ? (
              <Link className="underline" to="/web-atelier/upit">
                inquiry form
              </Link>
            ) : (
              <span>inquiry form</span>
            )}
            .
          </>
        )}
      </p>
    </div>
  )
}

export default WebAtelierDemoPortfolio
