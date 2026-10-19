import { ErrorBoundary } from '../ErrorBoundary'
import { AnimatedPage } from '../components/AnimatedPage'
import { InteriorsFormPageLayout } from '../components/InteriorsFormPageLayout'
import { InteriorsClientForm } from '../components/InteriorsClientForm'
import { PublicConsultationBooking } from '../components/PublicConsultationBooking'
import { INTERIORS_STOLAR_OPTIONS } from '../data/interiorsPublic'
import { PageSEO } from '../components/PageSEO'

interface InterijeriClientsPageProps {
  language: 'hr' | 'en'
}

/** Visibility gated by PublicServiceGuard (service=interiors). */
export default function InterijeriClientsPage({ language }: InterijeriClientsPageProps) {
  const title = language === 'hr' ? 'Upit za klijente' : 'Client inquiry'

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
