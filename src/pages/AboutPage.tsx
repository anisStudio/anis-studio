import { Link } from 'react-router-dom'
import { ErrorBoundary } from '../ErrorBoundary'
import AboutSection from '../components/AboutSection'
import TestimonialsSection from '../sections/TestimonialsSection'
import { AnimatedPage } from '../components/AnimatedPage'
import { PageSEO } from '../components/PageSEO'

interface AboutPageProps {
  language: 'hr' | 'en'
}

export default function AboutPage({ language }: AboutPageProps) {
  const translations = {
    finalCta: {
      heading: {
        hr: 'Spremni za sljedeći korak?',
        en: 'Ready for the next step?'
      },
      subline: {
        hr: 'Javite nam se u par rečenica — dogovorimo kako zajedno ostvariti vašu ideju.',
        en: 'Send a short message — we will figure out how to bring your idea to life together.'
      },
      button: {
        hr: 'Pokreni projekt',
        en: "Let's start a project"
      }
    }
  }

  return (
    <AnimatedPage>
      <PageSEO
        title="O nama"
        description="Upoznajte Ani's Studio — kreativni studio iza personalizirane ručne izrade, 3D interijera i web rješenja. Misija, pristup i tim."
        canonical="/o-nama"
      />
      <main className="min-w-0 space-y-12 sm:space-y-14 lg:space-y-[4.25rem]">
      <ErrorBoundary name="ONama">
        <AboutSection language={language} showPageTitle />
      </ErrorBoundary>

      {/* Testimonials Section */}
      <ErrorBoundary name="Testimonials">
        <TestimonialsSection language={language} />
      </ErrorBoundary>

      {/* Final CTA — contact */}
      <ErrorBoundary name="AboutFinalCta">
        <section className="Section fade-in px-4 pb-12 sm:px-6 sm:pb-14 lg:pb-16" aria-labelledby="about-final-cta-heading">
          <div className="mx-auto max-w-xl">
            <div className="rounded-2xl border border-[rgba(110,68,255,0.12)] bg-white/50 p-6 text-center shadow-[0_8px_40px_rgba(46,36,71,0.06)] backdrop-blur-md dark:border-lavender/12 dark:bg-white/[0.04] dark:shadow-[0_12px_48px_rgba(0,0,0,0.25)] sm:p-8">
              <h2
                id="about-final-cta-heading"
                className="font-heading text-xl font-bold tracking-tight text-balance text-plum/95 dark:text-pearl sm:text-2xl"
              >
                {translations.finalCta.heading[language]}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-plum/78 dark:text-pearl/72 sm:mt-4 sm:text-[0.9375rem] sm:leading-relaxed">
                {translations.finalCta.subline[language]}
              </p>
              <Link
                to="/kontakt"
                className="btn btn-primary mt-6 inline-flex min-h-[48px] w-full max-w-sm items-center justify-center px-8 py-3 text-base font-semibold shadow-md transition-all duration-300 hover:shadow-lg sm:mt-7 sm:w-auto sm:px-10 sm:py-3.5"
              >
                {translations.finalCta.button[language]}
              </Link>
            </div>
          </div>
        </section>
      </ErrorBoundary>
    </main>
    </AnimatedPage>
  )
}

