import { Link } from 'react-router-dom'
import { ErrorBoundary } from '../ErrorBoundary'
import { AnimatedPage } from '../components/AnimatedPage'
import { InteriorsFormPageLayout } from '../components/InteriorsFormPageLayout'
import { InteriorsClientForm } from '../components/InteriorsClientForm'
import { PublicConsultationBooking } from '../components/PublicConsultationBooking'
import { INTERIORS_STOLAR_OPTIONS } from '../data/interiorsPublic'
import { PageSEO } from '../components/PageSEO'
import { InteriorsSettingsLoading } from '../components/InteriorsSettingsLoading'
import { useSettings } from '../hooks/useSettings'

interface InterijeriClientsPageProps {
  language: 'hr' | 'en'
}

const unavailableCopy = {
  title: {
    hr: 'Usluga je trenutno u pripremi',
    en: 'This service is currently in preparation',
  },
  text: {
    hr: 'Ova stranica trenutno nije javno dostupna. Za upite i dogovor možete nam se javiti putem kontakt stranice.',
    en: 'This page is not publicly available at the moment. For questions or project inquiries, you can contact us through the contact page.',
  },
  button: {
    hr: 'Kontakt',
    en: 'Contact',
  },
}

export default function InterijeriClientsPage({ language }: InterijeriClientsPageProps) {
  const { settings, isLoading } = useSettings()
  const interiorsVisible = settings?.interiors_public_visible ?? true
  const title = language === 'hr' ? 'Upit za klijente' : 'Client inquiry'

  if (isLoading) {
    return <InteriorsSettingsLoading language={language} seoTitle="Upit za klijente — Interijeri" />
  }

  if (!interiorsVisible) {
    return (
      <AnimatedPage>
        <PageSEO title="Upit za klijente — Interijeri" description="" noIndex />
        <main className="min-w-0">
          <section className="Section fade-in">
            <div className="mx-auto min-w-0 max-w-xl px-4 py-20 text-center sm:px-6 sm:py-24">
              <div className="mb-6 text-5xl" aria-hidden>🏠</div>
              <h1 className="mb-4 font-heading text-2xl font-bold tracking-tight text-balance text-plum/95 dark:text-pearl sm:text-3xl">
                {unavailableCopy.title[language]}
              </h1>
              <p className="mx-auto mb-8 max-w-md text-base leading-relaxed text-plum/78 dark:text-pearl/72">
                {unavailableCopy.text[language]}
              </p>
              <Link
                to="/kontakt"
                className="btn btn-primary inline-flex min-h-[48px] items-center justify-center px-8 py-3 text-base font-semibold"
              >
                {unavailableCopy.button[language]}
              </Link>
            </div>
          </section>
        </main>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage>
      <PageSEO
        title="Upit za klijente — Interijeri"
        description="Forma za upit za projekte uređenja interijera u Ani's Studio."
        noIndex
      />
      <main className="min-w-0">
        <ErrorBoundary name="InterijeriKlijenti">
          <InteriorsFormPageLayout language={language} title={title}>
            <InteriorsClientForm stolars={INTERIORS_STOLAR_OPTIONS} language={language} />
            <PublicConsultationBooking department="interiors" language={language} />
          </InteriorsFormPageLayout>
        </ErrorBoundary>
      </main>
    </AnimatedPage>
  )
}
