import { ErrorBoundary } from '../ErrorBoundary'
import InteriorsSection from '../components/InteriorsSection'
import FAQSection, { FAQ_ITEMS } from '../sections/FAQSection'
import { AnimatedPage } from '../components/AnimatedPage'
import { PageSEO } from '../components/PageSEO'

interface InterijeriPageProps {
  language: 'hr' | 'en'
}

const interiorsItems = FAQ_ITEMS.filter((item) => item.category === 'interiors')

const interiorsFaqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: interiorsItems.map((item) => ({
    '@type': 'Question',
    name: item.question.hr,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer.hr.replace(/\n+/g, ' ').trim(),
    },
  })),
}

/** Visibility gated by PublicServiceGuard (service=interiors). */
export default function InterijeriPage({ language }: InterijeriPageProps) {
  return (
    <AnimatedPage>
      <PageSEO
        title="3D vizualizacija interijera i kuhinja"
        description="3D vizualizacija interijera, kuhinja i prostora prije izvedbe. Realistični prikazi rasporeda, materijala i atmosfere — za privatne klijente koji uređuju dom i za stolare kojima treba profesionalan prikaz za prezentaciju. Fotorealistični render dostupan kao dodatna opcija."
        canonical="/interijeri"
        jsonLd={interiorsFaqJsonLd}
      />
      <main className="min-w-0">
        <ErrorBoundary name="Interijeri">
          <InteriorsSection language={language} />
        </ErrorBoundary>

        <ErrorBoundary name="FAQ">
          <div className="border-t border-[rgba(110,68,255,0.12)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35)] dark:border-lavender/12 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <FAQSection language={language} categories={['interiors']} />
          </div>
        </ErrorBoundary>
      </main>
    </AnimatedPage>
  )
}
