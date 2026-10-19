import { ErrorBoundary } from '../ErrorBoundary'
import { AnimatedPage } from '../components/AnimatedPage'
import { InteriorsFormPageLayout } from '../components/InteriorsFormPageLayout'
import { InteriorsCarpenterForm } from '../components/InteriorsCarpenterForm'
import { PageSEO } from '../components/PageSEO'
import { InteriorsSettingsLoading } from '../components/InteriorsSettingsLoading'
import { useSettings } from '../hooks/useSettings'

interface InterijeriStolariPageProps {
  language: 'hr' | 'en'
}

/** Visibility gated by PublicServiceGuard (service=interiors). */
export default function InterijeriStolariPage({ language }: InterijeriStolariPageProps) {
  const { settings, isLoading } = useSettings()
  const vrEnabled = settings?.interiors_vr_enabled ?? false

  const title =
    language === 'hr' ? 'Upit za stolare i studije' : 'Inquiry for carpenters & furniture studios'

  if (isLoading) {
    return (
      <InteriorsSettingsLoading
        language={language}
        seoTitle="Upit za stolare i studije — Interijeri"
      />
    )
  }

  return (
    <AnimatedPage>
      <PageSEO
        title="Upit za stolare i studije — Interijeri"
        description="Forma za upit za stolare i studije namještaja u Ani's Studio."
        noIndex
      />
      <main className="min-w-0">
        <ErrorBoundary name="InterijeriStolari">
          <InteriorsFormPageLayout language={language} title={title}>
            <InteriorsCarpenterForm language={language} vrEnabled={vrEnabled} />
          </InteriorsFormPageLayout>
        </ErrorBoundary>
      </main>
    </AnimatedPage>
  )
}
