import { ErrorBoundary } from '../ErrorBoundary'
import WebAtelierSection from '../components/WebAtelierSection'
import FAQSection from '../sections/FAQSection'
import { AnimatedPage } from '../components/AnimatedPage'
import { PageSEO } from '../components/PageSEO'

interface WebAtelierPageProps {
  language: 'hr' | 'en'
}

export default function WebAtelierPage({ language }: WebAtelierPageProps) {
  const description =
    language === 'hr'
      ? 'Anis Web Atelier — profesionalne web stranice za male obrte i poduzetnike. Informativna procjena, upit i opcionalna konzultacija. Javno lansiranje još nije aktivno.'
      : 'Anis Web Atelier — professional websites for small businesses and entrepreneurs. Indicative estimate, inquiry, and optional consultation. Public launch is not active yet.'

  return (
    <AnimatedPage>
      <PageSEO
        title={
          language === 'hr'
            ? "Ani's Web Atelier — web stranice za obrte i poduzetnike"
            : "Ani's Web Atelier — websites for small businesses"
        }
        description={description}
        canonical="/web-atelier"
        /* Hidden department: keep out of public indexes until launch. */
        noIndex
        ogDescription={description}
        ogImageAlt={
          language === 'hr'
            ? "Ani's Web Atelier — web dizajn za male biznise"
            : "Ani's Web Atelier — web design for small businesses"
        }
      />
      <main className="min-w-0 space-y-0">
        <ErrorBoundary name="WebAtelier">
          <WebAtelierSection language={language} />
        </ErrorBoundary>

        <ErrorBoundary name="FAQ">
          <div className="border-t border-[rgba(110,68,255,0.1)] dark:border-lavender/15">
            <FAQSection language={language} categories={['web']} />
          </div>
        </ErrorBoundary>
      </main>
    </AnimatedPage>
  )
}
