import { Link } from 'react-router-dom'
import { trackEvent } from '../../lib/analytics'
import { WEB_ATELIER_DEMOS, demoBannerText } from '../../lib/webAtelierDemos'
import './webAtelierDemos.css'

interface Props {
  language: 'hr' | 'en'
}

const visualClass: Record<string, string> = {
  stolarija: 'wa-carp-illustration',
  grooming: 'wa-groom-blob',
  cvjecarna: 'wa-flor-swatch',
}

export function WebAtelierDemoPortfolio({ language }: Props) {
  const hr = language === 'hr'

  return (
    <div className="wa-demo-portfolio" id="web-atelier-demos">
      <div className="mx-auto mb-6 max-w-3xl text-center sm:mb-8">
        <h3 className="font-heading text-xl font-bold text-balance text-plum dark:text-pearl sm:text-2xl">
          {hr ? 'Demo portfolio koncepata' : 'Demo concept portfolio'}
        </h3>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-plum/78 dark:text-pearl/72 sm:text-[0.9375rem]">
          {hr
            ? 'Tri fiktivna koncepta — START, PRO i PREMIUM — kako bi se vidio smjer studija. Nisu klijentski projekti.'
            : 'Three fictional concepts — START, PRO and PREMIUM — to show the studio’s direction. Not client projects.'}
        </p>
        <p className="mx-auto mt-3 text-xs font-semibold uppercase tracking-wide text-amethyst dark:text-lavender">
          {demoBannerText(language)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
        {WEB_ATELIER_DEMOS.map((demo) => (
          <article key={demo.slug} className="wa-demo-card fade-in">
            <div className={`wa-demo-card-visual ${visualClass[demo.slug] ?? ''}`} aria-hidden="true" />
            <div className="wa-demo-card-body">
              <p className="wa-demo-card-meta">{demo.accentLabel[language]}</p>
              <h4>{demo.title[language]}</h4>
              <p>{demo.summary[language]}</p>
              <Link
                to={demo.path}
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
            <Link className="underline" to="/web-atelier/upit">
              formu za upit
            </Link>
            .
          </>
        ) : (
          <>
            After previewing, continue to the{' '}
            <a className="underline" href="#web-atelier-configurator">
              configurator
            </a>{' '}
            or{' '}
            <Link className="underline" to="/web-atelier/upit">
              inquiry form
            </Link>
            .
          </>
        )}
      </p>
    </div>
  )
}

export default WebAtelierDemoPortfolio
