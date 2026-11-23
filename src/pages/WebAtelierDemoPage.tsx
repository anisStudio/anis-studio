import { Link, useParams } from 'react-router-dom'
import { AnimatedPage } from '../components/AnimatedPage'
import { PageSEO } from '../components/PageSEO'
import { FloristDemo } from '../components/webAtelierDemos/cvjecarna/FloristDemo'
import { GroomingDemo } from '../components/webAtelierDemos/grooming/GroomingDemo'
import { InteriorsStudioDemo } from '../components/webAtelierDemos/interijeri/InteriorsStudioDemo'
import { WebAtelierDemoChrome } from '../components/webAtelierDemos/WebAtelierDemoChrome'
import { getWebAtelierDemo } from '../lib/webAtelierDemos'

interface Props {
  language: 'hr' | 'en'
  /** Public demo route keeps inquiry links. DEV preview passes false. */
  enableInquiryLinks?: boolean
}

export default function WebAtelierDemoPage({ language, enableInquiryLinks = true }: Props) {
  const { slug } = useParams<{ slug: string }>()
  const demo = getWebAtelierDemo(slug)

  if (!demo) {
    const title = language === 'hr' ? 'Demo nije pronađen' : 'Demo not found'
    const body =
      language === 'hr'
        ? 'Traženi demo koncept ne postoji. Vrati se na Web Atelier portfolio.'
        : 'That demo concept does not exist. Return to the Web Atelier portfolio.'
    return (
      <AnimatedPage>
        <PageSEO title={title} description={body} noIndex />
        <main className="min-w-0 px-4 py-16 text-center">
          <h1 className="font-heading text-2xl font-bold text-plum dark:text-pearl">{title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-plum/75 dark:text-pearl/70">{body}</p>
          <Link
            to={
              enableInquiryLinks
                ? '/web-atelier#web-atelier-demos'
                : '/dev/web-atelier#web-atelier-demos'
            }
            className="btn btn-primary mt-6 inline-flex min-h-[48px] items-center px-6"
          >
            {language === 'hr' ? 'Natrag na portfolio' : 'Back to portfolio'}
          </Link>
        </main>
      </AnimatedPage>
    )
  }

  const description = `${demo.summary[language]} ${demo.packageNote[language]}`

  return (
    <AnimatedPage>
      <PageSEO
        title={demo.title[language]}
        description={description}
        noIndex
      />
      <main className="min-w-0">
        <WebAtelierDemoChrome
          language={language}
          demo={demo}
          enableInquiryLinks={enableInquiryLinks}
        />
        {demo.slug === 'cvjecarna' && <FloristDemo language={language} demo={demo} />}
        {demo.slug === 'grooming' && <GroomingDemo language={language} demo={demo} />}
        {demo.slug === 'interijeri' && <InteriorsStudioDemo language={language} demo={demo} />}
      </main>
    </AnimatedPage>
  )
}
