import { WebAtelierConfigurator } from '../components/WebAtelierConfigurator'
import { PageSEO } from '../components/PageSEO'

interface WebAtelierDevPreviewPageProps {
  language: 'hr' | 'en'
}

/**
 * Local development preview only. App imports this when import.meta.env.DEV is true.
 * Public configurator presentation only: no inquiry, payment, or database call.
 */
export default function WebAtelierDevPreviewPage({ language }: WebAtelierDevPreviewPageProps) {
  return (
    <main className="min-w-0">
      <PageSEO title="Lokalni pregled konfiguratora" description="" noIndex />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <p className="mb-4 text-center text-xs text-plum/60 dark:text-pearl/55">
          {language === 'hr'
            ? 'Lokalni razvojni pregled. Nije javna stranica i ne šalje upit.'
            : 'Local development preview. Not a public page and it does not send an inquiry.'}
        </p>
        <WebAtelierConfigurator language={language} enableInquiryCta={false} />
      </div>
    </main>
  )
}
