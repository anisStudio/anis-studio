import { Link } from 'react-router-dom'
import { WebProjectForm } from '../components/WebProjectForm'
import { useAdminAuth } from '../providers/AdminAuthProvider'

const TEST_CONTACT_NAME = 'TESTNI UPIT — Web Atelier'
const TEST_NOTES =
  'TESTNI E2E UPIT — provjera Web Atelier sustava. Nije klijentski upit.'

export default function AdminWebAtelierTestPage() {
  const { user, isAdmin } = useAdminAuth()
  const adminEmail = user?.email?.trim() ?? ''
  const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? ''

  if (!isAdmin) {
    return null
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto max-w-4xl px-4 py-10">
        <header className="mb-8 border-b border-amber-200 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Privremeni admin test</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">TESTNI UPIT — Web Atelier</h1>
          <p className="mt-2 text-sm text-slate-700">
            Ovaj obrazac služi isključivo za provjeru sustava.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Koristi postojeći WebProjectForm, produkcijski Turnstile i Edge funkciju. Javni Web Atelier ostaje
            zatvoren. Ispuni preostala obavezna polja, potvrdi Turnstile i pošalji ručno — nema automatskog
            slanja.
          </p>
          {!turnstileSiteKey && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              Nedostaje VITE_TURNSTILE_SITE_KEY u frontend buildu. Turnstile se neće prikazati dok se site key
              ne doda u okruženje i frontend ponovno ne builda.
            </p>
          )}
          {!adminEmail && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              Admin email nije dostupan u sesiji. Ponovno se prijavi prije testa.
            </p>
          )}
          <p className="mt-3 text-sm text-slate-600">
            Pregled zaprimljenih upita:{' '}
            <Link className="font-medium text-violet-700 hover:underline" to="/admin/web-atelier-inquiries">
              /admin/web-atelier-inquiries
            </Link>
          </p>
        </header>

        <WebProjectForm
          language="hr"
          hidePageTitle
          initialContact={{
            fullNameOrCompany: TEST_CONTACT_NAME,
            email: adminEmail,
            extraNotes: TEST_NOTES,
          }}
        />
      </section>
    </main>
  )
}
