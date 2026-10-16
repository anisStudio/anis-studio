import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TableSkeleton } from '../components/Skeleton'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  WEB_ATELIER_PROJECT_STATUSES,
  fetchWebAtelierProjects,
  formatEuroCents,
  type WebAtelierProjectListItem,
  type WebAtelierProjectStatus,
} from '../lib/webAtelierOffers'

const STATUS_LABEL: Record<WebAtelierProjectStatus, string> = {
  preparing: 'Priprema',
  waiting_for_client: 'Čeka klijenta',
  ready_to_start: 'Spremno za start',
  scheduled: 'Zakazano',
  in_progress: 'U izradi',
  client_review: 'Pregled klijenta',
  revision: 'Revizija',
  final_approval: 'Završna potvrda',
  completed: 'Završeno',
  on_hold: 'Na čekanju',
  cancelled: 'Otkazano',
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function AdminWebAtelierProjectsPage() {
  const [rows, setRows] = useState<WebAtelierProjectListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<WebAtelierProjectStatus | 'all'>('all')

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Supabase nije konfiguriran. Dohvat podataka nije moguć.')
      setIsLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await fetchWebAtelierProjects()
        if (!cancelled) setRows(data)
      } catch {
        if (!cancelled) setError('Došlo je do greške pri dohvaćanju projekata.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = rows.filter((row) => status === 'all' || row.status === status)

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8 border-b pb-4">
          <h1 className="text-2xl font-semibold text-slate-900">Web Atelier projekti</h1>
          <p className="mt-1 text-sm text-slate-600">
            Projekt postoji samo za prihvaćenu službenu ponudu. Upit sam po sebi nije projekt.
          </p>
        </header>

        <div className="mb-6">
          <label className="text-sm text-slate-700">
            Status
            <select
              className="ml-2 rounded-lg border border-slate-200 px-2 py-1"
              value={status}
              onChange={(event) => setStatus(event.target.value as WebAtelierProjectStatus | 'all')}
            >
              <option value="all">Svi</option>
              {WEB_ATELIER_PROJECT_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {STATUS_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        {isLoading && <TableSkeleton rows={5} />}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-600">Nema projekata.</p>
          </div>
        )}
        {!isLoading && !error && filtered.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {['Broj', 'Naslov', 'Klijent', 'Ugovoreni iznos', 'Status', 'Datum'].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 text-sm">
                        <Link
                          className="font-medium text-violet-700 hover:underline"
                          to={`/admin/web-atelier-projects/${row.id}`}
                        >
                          {row.project_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">{row.title}</td>
                      <td className="px-4 py-3 text-sm text-slate-800">{row.client_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-800">
                        {formatEuroCents(row.agreed_total_cents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">{STATUS_LABEL[row.status]}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
