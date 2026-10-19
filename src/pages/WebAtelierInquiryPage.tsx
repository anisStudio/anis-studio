import { Link, useSearchParams } from 'react-router-dom'
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
  const hr = language === 'hr'

  const raw = searchParams.get('paket')
  const initialPaket: WebAtelierPaket | undefined =
    raw === 'start' || raw === 'pro' || raw === 'premium' ? raw : undefined
  const applyStoredConfigurator = searchParams.get('cfg') === '1'

  return (
    <AnimatedPage>
      <PageSEO
        title={hr ? 'Upit za web projekt — Web Atelier' : 'Web project inquiry — Web Atelier'}
        description={
          hr
            ? 'Pošaljite upit za web projekt u Ani\'s Web Atelierju. Upit nije rezervacija termina ni prihvat ponude.'
            : 'Send a web project inquiry to Ani\'s Web Atelier. An inquiry is not a booking or offer acceptance.'
        }
        noIndex
      />
      <main className="min-w-0 bg-pearl text-plum dark:bg-[#070812] dark:text-pearl">
        <ErrorBoundary name="WebAtelierUpit">
          <WebAtelierFormPageLayout language={language} title={title}>
            <div className="mx-auto min-w-0 max-w-4xl space-y-8">
              <section
                className="rounded-2xl border border-[rgba(110,68,255,0.16)] bg-white/70 px-4 py-4 shadow-sm backdrop-blur-sm dark:border-lavender/20 dark:bg-white/[0.05] sm:px-5 sm:py-5"
                aria-labelledby="wa-inquiry-journey-title"
              >
                <h2
                  id="wa-inquiry-journey-title"
                  className="font-heading text-base font-bold text-plum dark:text-pearl sm:text-lg"
                >
                  {hr ? 'Što slijedi — kratko i jasno' : 'What happens next — short and clear'}
                </h2>
                <ol className="mt-3 grid gap-3 text-sm leading-relaxed text-plum/80 dark:text-pearl/75 sm:grid-cols-3">
                  <li className="rounded-xl border border-[rgba(110,68,255,0.12)] bg-white/60 p-3 dark:bg-white/[0.04]">
                    <strong className="block text-plum dark:text-pearl">
                      {hr ? '1. Ovaj upit' : '1. This inquiry'}
                    </strong>
                    {hr
                      ? 'Opis projekta i preferirani paket. Dostupan 24/7. Nije plaćanje ni narudžba.'
                      : 'Project outline and preferred package. Available 24/7. Not payment or an order.'}
                  </li>
                  <li className="rounded-xl border border-[rgba(110,68,255,0.12)] bg-white/60 p-3 dark:bg-white/[0.04]">
                    <strong className="block text-plum dark:text-pearl">
                      {hr ? '2. Konzultacija (opcionalno)' : '2. Consultation (optional)'}
                    </strong>
                    {hr
                      ? 'Ispod možete rezervirati termin ako želite razgovor. To nije prihvat ponude.'
                      : 'Below you can book a slot if you want a call. That is not offer acceptance.'}
                  </li>
                  <li className="rounded-xl border border-[rgba(110,68,255,0.12)] bg-white/60 p-3 dark:bg-white/[0.04]">
                    <strong className="block text-plum dark:text-pearl">
                      {hr ? '3. Ponuda i projekt' : '3. Offer and project'}
                    </strong>
                    {hr
                      ? 'Konačna ponuda dolazi nakon pregleda. Projekt kreće tek nakon eksplicitnog prihvata.'
                      : 'A final quote follows review. A project starts only after explicit acceptance.'}
                  </li>
                </ol>
                <p className="mt-3 text-xs text-plum/65 dark:text-pearl/60">
                  {hr ? (
                    <>
                      Vratite se na{' '}
                      <Link className="font-semibold underline" to="/web-atelier">
                        Web Atelier
                      </Link>{' '}
                      ili{' '}
                      <a className="font-semibold underline" href="#web-atelier-booking">
                        rezervaciju termina
                      </a>
                      .
                    </>
                  ) : (
                    <>
                      Return to{' '}
                      <Link className="font-semibold underline" to="/web-atelier">
                        Web Atelier
                      </Link>{' '}
                      or jump to{' '}
                      <a className="font-semibold underline" href="#web-atelier-booking">
                        booking
                      </a>
                      .
                    </>
                  )}
                </p>
              </section>

              <WebProjectForm
                language={language}
                hidePageTitle
                initialPaket={initialPaket}
                applyStoredConfigurator={applyStoredConfigurator}
              />

              <div id="web-atelier-booking" className="scroll-mt-28">
                {/* Behind PublicServiceGuard; WA public remains OFF until launch. */}
                <PublicConsultationBooking department="web_atelier" language={language} />
              </div>
            </div>
          </WebAtelierFormPageLayout>
        </ErrorBoundary>
      </main>
    </AnimatedPage>
  )
}
