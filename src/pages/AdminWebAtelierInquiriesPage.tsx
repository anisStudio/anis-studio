import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TableSkeleton } from '../components/Skeleton'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  fetchWebAtelierInquiries,
  WEB_ATELIER_RISKS,
  WEB_ATELIER_STATUSES,
  type WebAtelierInquiryListItem,
  type WebAtelierRisk,
  type WebAtelierStatus,
} from '../lib/webAtelierAdmin'

const STATUS_LABEL: Record<WebAtelierStatus, string> = {
  submitted: 'Zaprimljeno',
  under_review: 'U pregledu',
  accepted: 'Prihvaćeno',
  needs_info: 'Treba dopunu',
  declined: 'Odbijeno',
  spam: 'Spam',
}

const RISK_LABEL: Record<WebAtelierRisk, string> = {
  unreviewed: 'Neprovjereno',
  clear: 'U redu',
  suspected: 'Sumnjivo',
  blocked: 'Blokirano',
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminWebAtelierInquiriesPage() {
  const [rows, setRows] = useState<WebAtelierInquiryListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<WebAtelierStatus | 'all'>('all')
  const [risk, setRisk] = useState<WebAtelierRisk | 'all'>('all')
  const [archive, setArchive] = useState<'all' | 'active' | 'archived'>('active')

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
        const data = await fetchWebAtelierInquiries()
        if (!cancelled) setRows(data)
      } catch {
        console.error('Web Atelier inquiry list failed')
        if (!cancelled) setError('Došlo je do greške pri dohvaćanju upita. Pokušaj ponovo.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = rows.filter((row) => {
    if (status !== 'all' && row.status !== status) return false
    if (risk !== 'all' && row.risk_state !== risk) return false
    if (archive === 'active' && row.archived_at) return false
    if (archive === 'archived' && !row.archived_at) return false
    return true
  })

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8 border-b pb-4">
          <h1 className="text-2xl font-semibold text-slate-900">Web Atelier upiti</h1>
          <p className="mt-1 text-sm text-slate-600">
            Pregled zaprimljenih upita. Paket i budžet su informativne želje klijenta, ne ponuda.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap gap-3">
          <label className="text-sm text-slate-700">
            Status
            <select
              className="ml-2 rounded-lg border border-slate-200 px-2 py-1"
              value={status}
              onChange={(event) => setStatus(event.target.value as WebAtelierStatus | 'all')}
            >
              <option value="all">Svi</option>
              {WEB_ATELIER_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {STATUS_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Rizik
            <select
              className="ml-2 rounded-lg border border-slate-200 px-2 py-1"
              value={risk}
              onChange={(event) => setRisk(event.target.value as WebAtelierRisk | 'all')}
            >
              <option value="all">Svi</option>
              {WEB_ATELIER_RISKS.map((item) => (
                <option key={item} value={item}>
                  {RISK_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Arhiva
            <select
              className="ml-2 rounded-lg border border-slate-200 px-2 py-1"
              value={archive}
              onChange={(event) => setArchive(event.target.value as 'all' | 'active' | 'archived')}
            >
              <option value="active">Aktivni</option>
              <option value="archived">Arhivirani</option>
              <option value="all">Svi</option>
            </select>
          </label>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        {isLoading && <TableSkeleton rows={5} />}
        {!isLoading && !error && rows.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-600">Trenutno nema upita.</p>
          </div>
        )}
        {!isLoading && !error && rows.length > 0 && filtered.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-600">Nema upita za odabrane filtere.</p>
          </div>
        )}
        {!isLoading && !error && filtered.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {['Referenca', 'Ime', 'Email', 'Datum', 'Status', 'Rizik', 'Arhiva'].map((heading) => (
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
                          to={`/admin/web-atelier-inquiries/${row.id}`}
                        >
                          {row.reference_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">{row.contact_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-800">{row.email}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-slate-800">{STATUS_LABEL[row.status]}</td>
                      <td className="px-4 py-3 text-sm text-slate-800">{RISK_LABEL[row.risk_state]}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{row.archived_at ? 'Da' : 'Ne'}</td>
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
