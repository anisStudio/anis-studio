import { Link } from 'react-router-dom'
import { useSettings } from '../hooks/useSettings'
import {
  DEPARTMENT_PREVIEW_LINKS,
  PUBLIC_SERVICE_LABEL,
  PUBLIC_SERVICE_SETTING_KEY,
  type PublicService,
} from '../lib/publicServiceAccess'
import { PageSEO } from '../components/PageSEO'

const DEPARTMENTS: PublicService[] = ['interiors', 'lrc', 'webAtelier']

function visibilityLabel(visible: boolean): { text: string; className: string } {
  if (visible) {
    return {
      text: 'Javno vidljivo',
      className: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    }
  }
  return {
    text: 'Skriveno od javnosti',
    className: 'bg-slate-100 text-slate-700 ring-slate-200',
  }
}

/**
 * Admin hub for opening real department pages (admin-aware PublicServiceGuard).
 * Visibility ≠ publishing code changes — see docs/admin-preview-and-publishing.md.
 */
export default function AdminSitePreviewPage() {
  const { settings, isLoading, error } = useSettings()

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageSEO title="Pregled stranice — Admin" description="" noIndex />

      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Pregled stranice</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          Otvorite stvarne stranice odjela radi pregleda i testiranja. Ako je odjel javno
          skriven, pristup i dalje zahtijeva potvrđenu administratorsku ulogu (
          <code className="rounded bg-slate-100 px-1 text-xs">is_admin</code>
          ). Ovo nije zamjena za Vercel Preview deployment razvojnih izmjena.
        </p>
      </header>

      <section className="mb-8 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
        <p className="font-medium">Produkcijski podaci</p>
        <p className="mt-1 leading-relaxed text-amber-900/90">
          Samo otvaranje stranice ne stvara upite, rezervacije ni narudžbe. Ako namjerno
          pošaljete obrazac ili rezervaciju, vrijede stvarna produkcijska pravila — nema
          lažnog sandbox načina rada.
        </p>
      </section>

      {isLoading ? (
        <p className="text-sm text-slate-500">Učitavanje statusa vidljivosti…</p>
      ) : null}

      {error !== null ? (
        <p className="mb-4 text-sm text-red-700">
          Postavke nisu učitane. Pregled skrivenih odjela i dalje može raditi ako ste
          administrator, ali status vidljivosti možda nije točan.
        </p>
      ) : null}

      <div className="space-y-6">
        {DEPARTMENTS.map((service) => {
          const key = PUBLIC_SERVICE_SETTING_KEY[service]
          const visible = settings?.[key] === true
          const badge = visibilityLabel(visible)
          const links = DEPARTMENT_PREVIEW_LINKS[service]

          return (
            <article
              key={service}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  {PUBLIC_SERVICE_LABEL[service]}
                </h2>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${badge.className}`}
                >
                  {badge.text}
                </span>
              </div>

              <p className="mb-4 text-sm text-slate-600">
                {visible
                  ? 'Javni posjetitelji mogu otvoriti ove rute. Administrator ih može pregledavati kao i inače.'
                  : 'Javni posjetitelji vide stranicu „u pripremi”. Vi možete otvoriti stvarne stranice ispod.'}
              </p>

              <ul className="grid gap-2 sm:grid-cols-2">
                {links.map((link) => (
                  <li key={link.path}>
                    <a
                      href={link.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-violet-700 transition-colors hover:border-violet-300 hover:bg-violet-50"
                    >
                      <span>{link.label}</span>
                      {link.createsProductionData ? (
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          stvarni upis
                        </span>
                      ) : null}
                    </a>
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>

      <section className="mt-10 space-y-3 border-t border-slate-200 pt-6 text-sm text-slate-600">
        <h2 className="text-base font-semibold text-slate-900">
          Vidljivost odjela vs. objavljivanje koda
        </h2>
        <p>
          <strong className="font-medium text-slate-800">Vidljivost</strong> — smiju li
          javni posjetitelji pristupiti odjelu (postavke u Admin → Postavke).
        </p>
        <p>
          <strong className="font-medium text-slate-800">Objavljivanje izmjena</strong> —
          kada novi kod ide na produkciju. Za razvojne izmjene koristite Vercel Preview na
          feature grani prije spajanja na <code className="text-xs">main</code>.
        </p>
        <p>
          Detalji:{' '}
          <Link
            to="/admin/settings"
            className="font-medium text-violet-700 underline underline-offset-2"
          >
            Postavke vidljivosti
          </Link>
          {' · '}
          <span className="text-slate-500">
            docs/admin-preview-and-publishing.md (u repou)
          </span>
        </p>
      </section>
    </div>
  )
}
