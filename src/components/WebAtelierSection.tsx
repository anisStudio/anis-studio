import { Link } from 'react-router-dom'
import { trackEvent } from '../lib/analytics'
import {
  WEB_ATELIER_PACKAGE_DEFINITIONS,
  formatEur,
  packageMarketingBullets,
  packagePositioningLine,
} from '../lib/webAtelierConfigurator'
import { DecorativeSkyBackdrop } from './DecorativeSkyBackdrop'
import { DepartmentStepCard } from './DepartmentStepCard'
import { WebAtelierConfigurator } from './WebAtelierConfigurator'
import { WebAtelierDemoPortfolio } from './webAtelierDemos/WebAtelierDemoPortfolio'
import './interiors-panorama.css'
import './webAtelier/webAtelierPremium.css'

interface WebAtelierSectionProps {
  language: 'hr' | 'en'
  /** Public pages keep inquiry links. DEV preview passes false. */
  enableInquiryLinks?: boolean
}

export default function WebAtelierSection({
  language,
  enableInquiryLinks = true,
}: WebAtelierSectionProps) {
  const copy = {
    kicker: { hr: "Ani's Web Atelier", en: "Ani's Web Atelier" },
    h1: {
      hr: 'Web stranice za male obrte',
      en: 'Websites for small businesses',
    },
    lead: {
      hr: 'Predstavite svoju ponudu na računalu i mobitelu. Pogledajte primjere dizajna i procijenite opseg projekta u konfiguratoru.',
      en: 'Present your services on desktop and mobile. Explore design examples and estimate your project scope in the configurator.',
    },
    ctaPrimary: { hr: 'Pošalji upit', en: 'Send inquiry' },
    ctaSecondary: { hr: 'Procijeni projekt', en: 'Estimate your project' },
    openConfigurator: { hr: 'Otvori konfigurator', en: 'Open configurator' },
    ctaDemos: { hr: 'Pogledaj primjere', en: 'Explore demos' },
    panelTitle: {
      hr: 'Što dobivate u suradnji',
      en: 'What collaboration includes',
    },
    panelItems: [
      {
        hr: 'Jasan paket i opseg prije početka rada',
        en: 'A clear package and scope before work begins',
      },
      {
        hr: 'Stranica prilagođena vašoj ponudi i cilju',
        en: 'A page tailored to your offer and goals',
      },
      {
        hr: 'Informativna procjena u konfiguratoru — konačna ponuda nakon pregleda upita',
        en: 'An indicative configurator estimate — final quote after inquiry review',
      },
    ],
    servicesTitle: {
      hr: 'Paketi usluga',
      en: 'Service packages',
    },
    servicesIntro: {
      hr: 'Tri osnovna smjera. U svakom paketu: responzivni prikaz, osnovna SEO optimizacija i osnovni kontaktni obrazac. Opcionalni dodaci biraju se u konfiguratoru; hosting, domena i održavanje definiraju se ponudom.',
      en: 'Three base directions. Every package includes responsive layout, basic SEO, and a basic contact form. Optional add-ons are chosen in the configurator; hosting, domain, and maintenance are defined in the quote.',
    },
    from: { hr: 'od', en: 'from' },
    processTitle: {
      hr: 'Kako teče suradnja',
      en: 'How collaboration works',
    },
    processIntro: {
      hr: 'Kratak, predvidljiv tijek — od prvog kontakta do objave.',
      en: 'A short, predictable flow — from first contact to publish.',
    },
    steps: [
      {
        title: { hr: 'Upit', en: 'Inquiry' },
        desc: {
          hr: 'Opišite što trebate i za koga je stranica.',
          en: 'Describe what you need and who the site is for.',
        },
      },
      {
        title: { hr: 'Paket', en: 'Package' },
        desc: {
          hr: 'Start, Pro ili Premium prema opsegu.',
          en: 'Start, Pro, or Premium according to scope.',
        },
      },
      {
        title: { hr: 'Materijali', en: 'Materials' },
        desc: {
          hr: 'Logo, tekstovi, slike i smjer brenda.',
          en: 'Logo, copy, images, and brand direction.',
        },
      },
      {
        title: { hr: 'Pregled', en: 'Review' },
        desc: {
          hr: 'Korekcije dizajna prema broju uključenim u odabrani paket.',
          en: 'Design corrections according to the number included in your chosen package.',
        },
      },
      {
        title: { hr: 'Objava', en: 'Publish' },
        desc: {
          hr: 'Nakon odobrenja tehnički postavljamo stranicu na dogovoreni kompatibilni hosting klijenta. Hosting, domenu i vanjske servise klijent plaća izravno pružateljima.',
          en: 'After approval, we set up the site on the client’s agreed compatible hosting. The client pays hosting, the domain, and external services directly to providers.',
        },
      },
    ],
    journeyTitle: {
      hr: 'Od upita do projekta',
      en: 'From inquiry to project',
    },
    journeyIntro: {
      hr: 'Upit možete poslati i bez rezervacije termina. Projekt počinje nakon što prihvatite ponudu.',
      en: 'You can send an inquiry without booking a consultation. The project starts after you accept the quote.',
    },
    journey: [
      {
        image: '/images/koraci-interijeri/upit.webp',
        title: { hr: 'Upit za projekt', en: 'Project inquiry' },
        desc: {
          hr: 'Opis potrebe i preferirani paket. Dostupan u svakom trenutku.',
          en: 'Describe the need and preferred package. Available anytime.',
        },
      },
      {
        image: '/images/koraci-web-atelier/konzultacija.webp',
        title: { hr: 'Konzultacija (opcionalno)', en: 'Consultation (optional)' },
        desc: {
          hr: 'Ako vam treba razgovor o projektu, možete rezervirati termin.',
          en: 'If you would like to discuss your project, you can book a consultation.',
        },
      },
      {
        image: '/images/koraci-web-atelier/ponuda.webp',
        title: { hr: 'Ponuda i projekt', en: 'Offer and project' },
        desc: {
          hr: 'Konačna ponuda dolazi nakon pregleda. Projekt kreće tek nakon eksplicitnog prihvata.',
          en: 'A final quote follows review. A project starts only after explicit acceptance.',
        },
      },
    ],
    closingTitle: {
      hr: 'Spremni za sljedeći korak?',
      en: 'Ready for the next step?',
    },
    closingDesc: {
      hr: 'Pošaljite kratki upit s opisom projekta. Ako ste konfiguracijom odabrali paket, možete ga prenijeti u formu.',
      en: 'Send a short inquiry with your project outline. If you chose a package in the configurator, you can carry it into the form.',
    },
    estimateNote: {
      hr: 'Konfigurator daje samo informativnu procjenu. Konačna ponuda dolazi nakon ručne provjere upita.',
      en: 'The configurator provides an indicative estimate only. A final quote follows manual review of your inquiry.',
    },
    reviewTitle: {
      hr: 'Surađivali smo na web projektu?',
      en: 'Have we worked on a web project together?',
    },
    reviewText: {
      hr: 'Ostavite kratku recenziju i pomozite drugima steći dojam o suradnji.',
      en: 'Leave a short review and help others understand what working together is like.',
    },
    reviewButton: { hr: 'Ostavi recenziju', en: 'Leave a review' },
  }

  return (
    <section id="web-atelier" className="Section fade-in relative section-with-bg wa-prem">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <DecorativeSkyBackdrop priority="high" />
        <div className="absolute inset-0 section-bg-overlay-light dark:section-bg-overlay-dark" />
      </div>

      <div className="relative z-10 mx-auto w-full min-w-0 max-w-6xl px-1 sm:px-0">
        <div className="text-center">
          <header className="department-panorama wa-panorama mb-4">
            <h1 className="font-heading font-bold tracking-tight text-plum dark:text-pearl">
              {copy.h1[language]}
            </h1>
          </header>
          <p className="text-sm font-bold text-plum dark:text-pearl">{copy.kicker[language]}</p>
          <p className="mx-auto mt-3 max-w-2xl px-2 text-base leading-relaxed text-plum dark:text-pearl">
            {copy.lead[language]}
          </p>
          <div className="wa-prem-cta-row wa-prem-intro-actions justify-center">
            {enableInquiryLinks ? (
              <Link
                to="/web-atelier/upit"
                className="btn btn-primary"
                onClick={() => trackEvent('inquiry_cta_click', { source: 'web-atelier-hero-primary' })}
              >
                {copy.ctaPrimary[language]}
              </Link>
            ) : (
              <span className="btn btn-primary" aria-disabled="true">
                {copy.ctaPrimary[language]}
              </span>
            )}
            <a
              href="#web-atelier-demos"
              className="wa-prem-cta-secondary"
              onClick={() => trackEvent('inquiry_cta_click', { source: 'web-atelier-hero-demos' })}
            >
              {copy.ctaDemos[language]}
            </a>
            <a
              href="#web-atelier-configurator"
              className="wa-prem-cta-secondary"
              onClick={() => trackEvent('inquiry_cta_click', { source: 'web-atelier-hero-config' })}
            >
              {copy.ctaSecondary[language]}
            </a>
          </div>
        </div>

        <div className="wa-prem-section mx-auto max-w-6xl">
          <WebAtelierDemoPortfolio language={language} enableInquiryLinks={enableInquiryLinks} />
        </div>

        <aside className="wa-prem-hero-panel mx-auto mt-6 max-w-2xl" aria-labelledby="wa-hero-panel-title">
          <h2 id="wa-hero-panel-title" className="font-heading">{copy.panelTitle[language]}</h2>
          <ul className="wa-prem-hero-list">
            {copy.panelItems.map((item, index) => (
              <li key={item.hr}>
                <span aria-hidden="true">{index + 1}</span>
                <p className="m-0">{item[language]}</p>
              </li>
            ))}
          </ul>
        </aside>

        <section className="wa-prem-section" aria-labelledby="wa-services-title">
          <div className="wa-prem-section-head">
            <h2 id="wa-services-title">{copy.servicesTitle[language]}</h2>
            <p>{copy.servicesIntro[language]}</p>
          </div>
          <div className="wa-prem-service-grid">
            {WEB_ATELIER_PACKAGE_DEFINITIONS.map((pkg) => (
              <article key={pkg.id} className="wa-prem-service">
                <h3>{pkg.id.toUpperCase()}</h3>
                <p className="wa-prem-price">
                  {copy.from[language]} {formatEur(pkg.fromEur, language)}
                </p>
                <p>{packagePositioningLine(pkg.id, language)}</p>
                <ul>
                  {packageMarketingBullets(pkg.id, language).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="wa-prem-section" aria-labelledby="wa-process-title">
          <div className="wa-prem-section-head">
            <h2 id="wa-process-title">{copy.processTitle[language]}</h2>
            <p>{copy.processIntro[language]}</p>
          </div>
          <ol className="wa-prem-process m-0 p-0">
            {copy.steps.map((step) => (
              <li key={step.title.hr}>
                <strong>{step.title[language]}</strong>
                <span>{step.desc[language]}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="wa-prem-section flex justify-center px-2">
          <a
            href="#web-atelier-configurator"
            className="btn btn-primary min-h-[48px] w-full max-w-md items-center justify-center sm:w-auto"
            onClick={() => trackEvent('inquiry_cta_click', { source: 'web-atelier-open-configurator' })}
          >
            {copy.openConfigurator[language]}
          </a>
        </div>

        <div id="web-atelier-pricing" className="wa-prem-section mx-auto w-full max-w-6xl">
          <WebAtelierConfigurator language={language} enableInquiryCta={enableInquiryLinks} />
        </div>

        <section className="wa-prem-section" aria-labelledby="wa-journey-title">
          <div className="wa-prem-section-head">
            <h2 id="wa-journey-title">{copy.journeyTitle[language]}</h2>
            <p>{copy.journeyIntro[language]}</p>
          </div>
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
            {copy.journey.map((item, index) => (
              <DepartmentStepCard
                key={item.image}
                number={index + 1}
                image={item.image}
                title={item.title[language]}
                description={item.desc[language]}
                heading="h3"
              />
            ))}
          </div>
        </section>

        <div className="wa-prem-section wa-prem-closing fade-in">
          <h2>{copy.closingTitle[language]}</h2>
          <p>{copy.closingDesc[language]}</p>
          <div className="wa-prem-cta-row justify-center">
            {enableInquiryLinks ? (
              <Link
                to="/web-atelier/upit"
                className="btn btn-primary"
                onClick={() => trackEvent('inquiry_cta_click', { source: 'web-atelier-closing' })}
              >
                {copy.ctaPrimary[language]}
              </Link>
            ) : (
              <span className="btn btn-primary" aria-disabled="true">
                {copy.ctaPrimary[language]}
              </span>
            )}
            <a href="#web-atelier-configurator" className="wa-prem-cta-secondary">
              {copy.ctaSecondary[language]}
            </a>
          </div>
          <p className="wa-prem-note">{copy.estimateNote[language]}</p>
        </div>

        <div className="fade-in mx-auto mt-8 w-full max-w-xl px-2 sm:mt-9">
          <div className="rounded-2xl border border-[rgba(110,68,255,0.14)] bg-white/[0.48] px-5 py-4 text-center shadow-sm backdrop-blur-sm dark:border-lavender/14 dark:bg-white/[0.05] sm:px-6 sm:py-5">
            <p className="font-heading text-sm font-bold tracking-tight text-plum/88 dark:text-pearl/92 sm:text-base">
              {copy.reviewTitle[language]}
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-plum/72 dark:text-pearl/68 sm:text-[0.8125rem]">
              {copy.reviewText[language]}
            </p>
            {enableInquiryLinks ? (
              <Link
                to="/ostavi-recenziju?category=webAtelier"
                onClick={() =>
                  trackEvent('review_cta_click', {
                    category: 'webAtelier',
                    source: 'web-atelier-section',
                  })
                }
                className="public-action mt-4 inline-flex min-h-[44px] w-full max-w-[14rem] items-center justify-center rounded-xl px-4 py-2 text-xs font-semibold sm:inline-flex sm:w-auto sm:text-sm"
              >
                {copy.reviewButton[language]}
              </Link>
            ) : (
              <span className="mt-4 inline-flex min-h-[44px] w-full max-w-[14rem] items-center justify-center rounded-xl border border-amethyst/30 bg-white/65 px-4 py-2 text-xs font-semibold text-plum/88 dark:border-lavender/28 dark:bg-white/[0.08] dark:text-pearl sm:text-sm" aria-disabled="true">
                {copy.reviewButton[language]}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
