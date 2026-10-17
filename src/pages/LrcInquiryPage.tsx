import { ErrorBoundary } from '../ErrorBoundary'
import { AnimatedPage } from '../components/AnimatedPage'
import { LrcFormPageLayout } from '../components/LrcFormPageLayout'
import LRCInquiryForm from '../components/LRCInquiryForm'
import { PublicConsultationBooking } from '../components/PublicConsultationBooking'
import { useSettings } from '../hooks/useSettings'
import { PageSEO } from '../components/PageSEO'

interface LrcInquiryPageProps {
  language?: 'hr' | 'en'
}

export default function LrcInquiryPage({ language = 'hr' }: LrcInquiryPageProps) {
  const { settings, isLoading, error } = useSettings()
  const isFormEnabled =
    error === null &&
    settings !== null &&
    settings.is_lrc_form_enabled === true

  const title =
    language === 'hr' ? 'Personaliziraj svoj proizvod' : 'Customize your product'

  const disabledTitle = {
    hr: 'LRC radionice',
    en: 'LRC Workshops'
  }
  const disabledMessage = {
    hr: 'Trenutno nema otvorenih prijava za LRC radionice.',
    en: 'Currently there are no open applications for LRC workshops.'
  }
  const disabledAdditional = {
    hr: 'Ako želite da vam javimo kad otvorimo nove termine, javite nam se na info.anilrc@gmail.com ili nas pratite na društvenim mrežama.',
    en: 'If you would like us to notify you when we open new dates, contact us at info.anilrc@gmail.com or follow us on social media.'
  }

  return (
    <AnimatedPage>
      <PageSEO
        title="Upit za LRC radionicu"
        description="Forma za prijavu i personalizaciju LRC proizvoda u Ani's Studio."
        noIndex
      />
      <main className="min-w-0 bg-pearl text-plum dark:bg-[#070812] dark:text-pearl">
        <ErrorBoundary name="LrcUpit">
          {isLoading ? (
            <section className="Section fade-in relative section-with-bg">
              <div className="flex min-h-[40vh] items-center justify-center px-4 py-10 sm:py-12">
                <p className="text-center text-sm leading-relaxed text-[--color-ink-muted] dark:text-pearl/70 sm:text-base">
                  {language === 'hr' ? 'Učitavanje postavki prijava...' : 'Loading application settings...'}
                </p>
              </div>
            </section>
          ) : !isFormEnabled ? (
            <LrcFormPageLayout language={language} title={disabledTitle[language]}>
              <div className="mx-auto max-w-2xl rounded-2xl border border-[rgba(110,68,255,0.2)] bg-white/80 p-6 text-center shadow-lg backdrop-blur-sm dark:border-lavender/20 dark:bg-white/8 sm:p-8">
                <p className="mb-3 text-base leading-relaxed text-plum/85 dark:text-pearl/85 sm:text-lg">
                  {disabledMessage[language]}
                </p>
                <p className="text-sm leading-relaxed text-[--color-ink-muted] dark:text-pearl/70 sm:text-base">
                  {disabledAdditional[language]}
                </p>
              </div>
            </LrcFormPageLayout>
          ) : (
            <LrcFormPageLayout language={language} title={title}>
              <div className="mx-auto min-w-0 max-w-4xl">
                <LRCInquiryForm language={language} />
                <PublicConsultationBooking department="lrc" language={language} />
              </div>
            </LrcFormPageLayout>
          )}
        </ErrorBoundary>
      </main>
    </AnimatedPage>
  )
}
