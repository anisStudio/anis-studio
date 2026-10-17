import { useSearchParams } from 'react-router-dom'
import { ErrorBoundary } from '../ErrorBoundary'
import { AnimatedPage } from '../components/AnimatedPage'
import { WebAtelierFormPageLayout } from '../components/WebAtelierFormPageLayout'
import { WebProjectForm, type WebAtelierPaket } from '../components/WebProjectForm'
import { PublicConsultationBooking } from '../components/PublicConsultationBooking'
import { PageSEO } from '../components/PageSEO'

interface WebAtelierInquiryPageProps {
  language: 'hr' | 'en'
}

export default function WebAtelierInquiryPage({ language }: WebAtelierInquiryPageProps) {
  const [searchParams] = useSearchParams()
  const title = language === 'hr' ? 'Upit za web projekt' : 'Web project inquiry'

  const raw = searchParams.get('paket')
  const initialPaket: WebAtelierPaket | undefined =
    raw === 'start' || raw === 'pro' || raw === 'premium' ? raw : undefined
  const applyStoredConfigurator = searchParams.get('cfg') === '1'

  return (
    <AnimatedPage>
      <PageSEO
        title="Upit za web projekt — Web Atelier"
        description="Forma za upit za izradu web stranice ili digitalnog projekta u Ani's Web Atelierju."
        noIndex
      />
      <main className="min-w-0 bg-pearl text-plum dark:bg-[#070812] dark:text-pearl">
        <ErrorBoundary name="WebAtelierUpit">
          <WebAtelierFormPageLayout language={language} title={title}>
            <div className="mx-auto min-w-0 max-w-4xl">
              <WebProjectForm
                language={language}
                hidePageTitle
                initialPaket={initialPaket}
                applyStoredConfigurator={applyStoredConfigurator}
              />
              {/* Behind PublicServiceGuard; WA public remains OFF until F2.11. */}
              <PublicConsultationBooking department="web_atelier" language={language} />
            </div>
          </WebAtelierFormPageLayout>
        </ErrorBoundary>
      </main>
    </AnimatedPage>
  )
}
