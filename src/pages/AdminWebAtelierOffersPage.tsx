import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TableSkeleton } from '../components/Skeleton'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  WEB_ATELIER_OFFER_STATUSES,
  fetchWebAtelierOffers,
  formatEuroCents,
  type WebAtelierOfferListItem,
  type WebAtelierOfferStatus,
} from '../lib/webAtelierOffers'

const STATUS_LABEL: Record<WebAtelierOfferStatus, string> = {
  draft: 'Nacrt',
  sent: 'Poslana',
  accepted: 'Prihvaćena',
  rejected: 'Odbijena',
  expired: 'Istekla',
  superseded: 'Zamijenjena',
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminWebAtelierOffersPage() {
  const [rows, setRows] = useState<WebAtelierOfferListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<WebAtelierOfferStatus | 'all'>('all')

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
        const data = await fetchWebAtelierOffers()
        if (!cancelled) setRows(data)
      } catch {
        if (!cancelled) setError('Došlo je do greške pri dohvaćanju ponuda.')
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
          <h1 className="text-2xl font-semibold text-slate-900">Web Atelier ponude</h1>
          <p className="mt-1 text-sm text-slate-600">
            Službena ponuda nije račun i nije projekt. Projekt nastaje tek nakon izričitog
            prihvaćanja. Informativne cijene START 300 €, PRO 500 €, PREMIUM 800 € vrijede do
            izdavanja ponude.
          </p>
        </header>

        <div className="mb-6">
          <label className="text-sm text-slate-700">
            Status
            <select
              className="ml-2 rounded-lg border border-slate-200 px-2 py-1"
              value={status}
              onChange={(event) => setStatus(event.target.value as WebAtelierOfferStatus | 'all')}
            >
              <option value="all">Svi</option>
              {WEB_ATELIER_OFFER_STATUSES.map((item) => (
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
            <p className="text-slate-600">Nema ponuda.</p>
            <p className="mt-2 text-sm text-slate-500">
              Nacrt se kreira s detalja pregledanog upita.
            </p>
          </div>
        )}
        {!isLoading && !error && filtered.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {['Broj', 'Klijent', 'Iznos', 'Status', 'Verzija', 'Vrijedi do'].map((heading) => (
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
                          to={`/admin/web-atelier-offers/${row.id}`}
                        >
                          {row.offer_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">
                        {row.client_name}
                        <div className="text-xs text-slate-500">{row.client_email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">
                        {formatEuroCents(row.total_cents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">{STATUS_LABEL[row.status]}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">v{row.version}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(row.valid_until)}</td>
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
