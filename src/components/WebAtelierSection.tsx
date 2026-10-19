import { Link } from 'react-router-dom'
import { trackEvent } from '../lib/analytics'
import {
  WEB_ATELIER_PACKAGE_DEFINITIONS,
  formatEur,
  packageMarketingBullets,
  packagePositioningLine,
} from '../lib/webAtelierConfigurator'
import { DecorativeSkyBackdrop } from './DecorativeSkyBackdrop'
import { WebAtelierConfigurator } from './WebAtelierConfigurator'
import { WebAtelierDemoPortfolio } from './webAtelierDemos/WebAtelierDemoPortfolio'
import './webAtelier/webAtelierPremium.css'

interface WebAtelierSectionProps {
  language: 'hr' | 'en'
}

export default function WebAtelierSection({ language }: WebAtelierSectionProps) {
  const copy = {
    kicker: { hr: "Ani's Web Atelier", en: "Ani's Web Atelier" },
    h1: {
      hr: 'Web stranice koje jasno predstavljaju vaš obrt i pozivaju na kontakt',
      en: 'Websites that clearly present your craft and invite contact',
    },
    lead: {
      hr: 'Za male obrte, poduzetnike i brendove kojima treba uredna, profesionalna web prisutnost — bez tehničkog kaosa i bez pretjeranih obećanja.',
      en: 'For small businesses, entrepreneurs, and brands that need a tidy, professional web presence — without technical chaos or overstated promises.',
    },
    ctaPrimary: { hr: 'Pošalji upit', en: 'Send inquiry' },
    ctaSecondary: { hr: 'Pogledaj procjenu', en: 'See estimate' },
    ctaDemos: { hr: 'Demo koncepti', en: 'Demo concepts' },
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
          hr: 'Revizije prema odabranom paketu.',
          en: 'Revisions according to the selected package.',
        },
      },
      {
        title: { hr: 'Objava', en: 'Publish' },
        desc: {
          hr: 'Objava prema dogovoru. Hosting, domena i održavanje definiraju se ponudom.',
          en: 'Launch as agreed. Hosting, domain, and maintenance are defined in the quote.',
        },
      },
    ],
    journeyTitle: {
      hr: 'Tri različita koraka — ne miješaju se',
      en: 'Three distinct steps — not the same thing',
    },
    journeyIntro: {
      hr: 'Upit, konzultacija i prihvat ponude nisu isto. Možete poslati upit i bez rezervacije termina.',
      en: 'Inquiry, consultation, and offer acceptance are different. You can inquire without booking a slot.',
    },
    journey: [
      {
        title: { hr: '1. Upit za projekt', en: '1. Project inquiry' },
        desc: {
          hr: 'Opis potrebe i preferirani paket. Dostupan u svakom trenutku.',
          en: 'Describe the need and preferred package. Available anytime.',
        },
      },
      {
        title: { hr: '2. Konzultacija (opcionalno)', en: '2. Consultation (optional)' },
        desc: {
          hr: 'Termin za početak suradnje ako je potreban razgovor. Nije prihvat ponude.',
          en: 'A start-of-cooperation slot when a call helps. Not offer acceptance.',
        },
      },
      {
        title: { hr: '3. Ponuda i projekt', en: '3. Offer and project' },
        desc: {
          hr: 'Konačna ponuda dolazi nakon pregleda. Projekt kreće tek nakon eksplicitnog prihvata.',
          en: 'A final quote follows review. A project starts only after explicit acceptance.',
        },
      },
    ],
    demosAnchorNote: {
      hr: 'Ispod su demo koncepti (nisu klijentski radovi), zatim konfigurator procjene.',
      en: 'Below: demo concepts (not client work), then the estimate configurator.',
    },
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
        <div className="wa-prem-hero">
          <div>
            <p className="wa-prem-kicker">{copy.kicker[language]}</p>
            <h1>{copy.h1[language]}</h1>
            <p className="wa-prem-lead">{copy.lead[language]}</p>
            <div className="wa-prem-cta-row">
              <Link
                to="/web-atelier/upit"
                className="btn btn-primary"
                onClick={() => trackEvent('inquiry_cta_click', { source: 'web-atelier-hero-primary' })}
              >
                {copy.ctaPrimary[language]}
              </Link>
              <a
                href="#web-atelier-configurator"
                className="wa-prem-cta-secondary"
                onClick={() => trackEvent('inquiry_cta_click', { source: 'web-atelier-hero-config' })}
              >
                {copy.ctaSecondary[language]}
              </a>
              <a
                href="#web-atelier-demos"
                className="wa-prem-cta-secondary"
                onClick={() => trackEvent('inquiry_cta_click', { source: 'web-atelier-hero-demos' })}
              >
                {copy.ctaDemos[language]}
              </a>
            </div>
          </div>

          <aside className="wa-prem-hero-panel" aria-labelledby="wa-hero-panel-title">
            <h2 id="wa-hero-panel-title">{copy.panelTitle[language]}</h2>
            <ul className="wa-prem-hero-list">
              {copy.panelItems.map((item, index) => (
                <li key={item.hr}>
                  <span aria-hidden="true">{index + 1}</span>
                  <p className="m-0">{item[language]}</p>
                </li>
              ))}
            </ul>
          </aside>
        </div>

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

        <section className="wa-prem-section" aria-labelledby="wa-journey-title">
          <div className="wa-prem-section-head">
            <h2 id="wa-journey-title">{copy.journeyTitle[language]}</h2>
            <p>{copy.journeyIntro[language]}</p>
          </div>
          <div className="wa-prem-journey">
            {copy.journey.map((item) => (
              <article key={item.title.hr}>
                <h3>{item.title[language]}</h3>
                <p>{item.desc[language]}</p>
              </article>
            ))}
          </div>
          <p className="wa-prem-note text-center">{copy.demosAnchorNote[language]}</p>
        </section>

        <div className="wa-prem-section mx-auto max-w-6xl">
          <WebAtelierDemoPortfolio language={language} />
        </div>

        <div id="web-atelier-pricing" className="wa-prem-section mx-auto w-full max-w-6xl">
          <WebAtelierConfigurator language={language} />
        </div>

        <div className="wa-prem-section wa-prem-closing fade-in">
          <h2>{copy.closingTitle[language]}</h2>
          <p>{copy.closingDesc[language]}</p>
          <div className="wa-prem-cta-row justify-center">
            <Link
              to="/web-atelier/upit"
              className="btn btn-primary"
              onClick={() => trackEvent('inquiry_cta_click', { source: 'web-atelier-closing' })}
            >
              {copy.ctaPrimary[language]}
            </Link>
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
            <Link
              to="/ostavi-recenziju?category=webAtelier"
              onClick={() =>
                trackEvent('review_cta_click', {
                  category: 'webAtelier',
                  source: 'web-atelier-section',
                })
              }
              className="mt-4 inline-flex min-h-[44px] w-full max-w-[14rem] items-center justify-center rounded-xl border border-amethyst/30 bg-white/65 px-4 py-2 text-xs font-semibold text-plum/88 dark:border-lavender/28 dark:bg-white/[0.08] dark:text-pearl sm:text-sm"
            >
              {copy.reviewButton[language]}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
