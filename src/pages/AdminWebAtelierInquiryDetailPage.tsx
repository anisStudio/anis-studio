import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchWebAtelierInquiry,
  updateWebAtelierInquiry,
  WEB_ATELIER_RISKS,
  WEB_ATELIER_STATUSES,
  type WebAtelierInquiryDetail,
  type WebAtelierRisk,
  type WebAtelierStatus,
} from '../lib/webAtelierAdmin'
import { isSupabaseConfigured } from '../lib/supabase'

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

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function AdminWebAtelierInquiryDetailPage() {
  const { id = '' } = useParams()
  const [inquiry, setInquiry] = useState<WebAtelierInquiryDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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
        const data = await fetchWebAtelierInquiry(id)
        if (!cancelled) setInquiry(data)
      } catch {
        console.error('Web Atelier inquiry detail failed')
        if (!cancelled) setError('Došlo je do greške pri dohvaćanju upita.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  async function save(patch: Record<string, unknown>, apply: (current: WebAtelierInquiryDetail) => WebAtelierInquiryDetail) {
    if (!inquiry) return
    const previous = inquiry
    setInquiry(apply(inquiry))
    setIsSaving(true)
    setError(null)
    try {
      await updateWebAtelierInquiry(inquiry.id, patch)
    } catch {
      setInquiry(previous)
      setError('Promjena nije spremljena. Pokušaj ponovo.')
    } finally {
      setIsSaving(false)
    }
  }

  const snapshot = inquiry?.configurator_snapshot ?? null

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto max-w-3xl px-4 py-10">
        <Link className="text-sm font-medium text-violet-700 hover:underline" to="/admin/web-atelier-inquiries">
          Natrag na popis
        </Link>
        <header className="mb-8 mt-4 border-b pb-4">
          <h1 className="text-2xl font-semibold text-slate-900">
            {inquiry ? inquiry.reference_code : 'Web Atelier upit'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Paket i okvirni budžet su neobvezujuće želje klijenta. Nisu ponuda, cijena ni projekt.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        {isLoading && <p className="text-sm text-slate-600">Učitavam upit…</p>}
        {!isLoading && !inquiry && !error && (
          <div className="rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-slate-600">Upit nije pronađen.</p>
          </div>
        )}
        {inquiry && (
          <div className="space-y-8">
            <div className="flex flex-wrap gap-4">
              <label className="text-sm text-slate-700">
                Status
                <select
                  className="ml-2 rounded-lg border border-slate-200 px-2 py-1"
                  value={inquiry.status}
                  disabled={isSaving}
                  onChange={(event) => {
                    const status = event.target.value as WebAtelierStatus
                    void save({ status }, (current) => ({ ...current, status }))
                  }}
                >
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
                  value={inquiry.risk_state}
                  disabled={isSaving}
                  onChange={(event) => {
                    const risk_state = event.target.value as WebAtelierRisk
                    void save({ risk_state }, (current) => ({ ...current, risk_state }))
                  }}
                >
                  {WEB_ATELIER_RISKS.map((item) => (
                    <option key={item} value={item}>
                      {RISK_LABEL[item]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={isSaving}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => {
                  const archived_at = inquiry.archived_at ? null : new Date().toISOString()
                  void save({ archived_at }, (current) => ({ ...current, archived_at }))
                }}
              >
                {inquiry.archived_at ? 'Vrati iz arhive' : 'Arhiviraj'}
              </button>
            </div>

            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="font-medium text-slate-500">Informativna oznaka paketa</dt>
                <dd>{inquiry.package_preference ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Okvirni budžet, neobvezujuće</dt>
                <dd>{inquiry.budget_range}</dd>
              </div>
              {[
                ['Ime', inquiry.contact_name],
                ['Email', inquiry.email],
                ['Telefon', inquiry.phone],
                ['Postojeća stranica', inquiry.existing_website],
                ['Izvor', inquiry.referral],
                ['Jezik', inquiry.language],
                ['Tipovi projekta', inquiry.project_types],
                ['Drugi tip', inquiry.project_types_other],
                ['Ciljevi', inquiry.goals],
                ['Drugi cilj', inquiry.goals_other],
                ['Tekstovi', inquiry.content_ready],
                ['Vizuali', inquiry.visuals_ready],
                ['Linkovi', inquiry.content_links],
                ['Stil', inquiry.design_mood],
                ['Drugi stil', inquiry.design_mood_other],
                ['Inspiracija', inquiry.design_inspiration],
                ['Funkcionalnosti', inquiry.features],
                ['Druge funkcionalnosti', inquiry.features_other],
                ['Napomene o funkcionalnostima', inquiry.features_notes],
                ['Datum pokretanja', inquiry.launch_deadline],
                ['Fleksibilnost', inquiry.deadline_flexibility],
                ['Kontakt', inquiry.contact_preference],
                ['Vrijeme kontakta', inquiry.contact_time],
                ['Opis projekta', inquiry.extra_notes],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="font-medium text-slate-500">{label}</dt>
                  <dd className="whitespace-pre-wrap text-slate-900">{formatValue(value)}</dd>
                </div>
              ))}
            </dl>

            {snapshot && (
              <section>
                <h2 className="mb-3 text-lg font-semibold text-slate-900">Spremljeni snapshot</h2>
                <dl className="grid gap-3 text-sm">
                  {Object.entries(snapshot).map(([key, value]) => (
                    <div key={key}>
                      <dt className="font-medium text-slate-500">{key}</dt>
                      <dd className="whitespace-pre-wrap text-slate-900">{formatValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
