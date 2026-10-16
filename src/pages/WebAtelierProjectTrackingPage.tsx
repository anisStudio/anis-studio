import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageSEO } from '../components/PageSEO'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  fetchPublicProjectStatusByToken,
  isValidTrackingTokenFormat,
  type WebAtelierPublicProjectStatus,
} from '../lib/webAtelierTracking'

const SESSION_TOKEN_KEY = 'wa_tracking_token_v1'

/**
 * Minimal public status view. Outside Web Atelier PublicServiceGuard so tracking
 * works without launching the public Web Atelier surface. Auth = tracking token.
 *
 * Token URL mitigations (compatible with current SPA):
 * - noindex (do not list in search)
 * - Referrer-Policy: no-referrer (reduce leak via Referer)
 * - after capture, replace browser URL with /pracenje-projekta and keep token
 *   only in sessionStorage for this tab session (limits history/referrer exposure)
 */
export default function WebAtelierProjectTrackingPage() {
  const { token: tokenParam = '' } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<WebAtelierPublicProjectStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      setStatus(null)

      let token = tokenParam.trim()
      if (token && isValidTrackingTokenFormat(token)) {
        try {
          sessionStorage.setItem(SESSION_TOKEN_KEY, token)
        } catch {
          // sessionStorage may be unavailable; still proceed with path token once.
        }
        // Strip secret from the address bar / history entry for this navigation.
        navigate('/pracenje-projekta', { replace: true })
      } else if (!token) {
        try {
          token = sessionStorage.getItem(SESSION_TOKEN_KEY) ?? ''
        } catch {
          token = ''
        }
      }

      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setError('Servis trenutno nije dostupan.')
          setIsLoading(false)
        }
        return
      }
      if (!isValidTrackingTokenFormat(token)) {
        if (!cancelled) {
          setError('Link za praćenje nije valjan.')
          setIsLoading(false)
        }
        return
      }

      try {
        const data = await fetchPublicProjectStatusByToken(token)
        if (!cancelled) setStatus(data)
      } catch (caught) {
        if (cancelled) return
        try {
          sessionStorage.removeItem(SESSION_TOKEN_KEY)
        } catch {
          // ignore
        }
        const message = caught instanceof Error ? caught.message : ''
        if (message.includes('tracking_token_expired')) {
          setError('Link za praćenje je istekao.')
        } else if (message.includes('tracking_token_revoked')) {
          setError('Link za praćenje više nije aktivan.')
        } else {
          setError('Link za praćenje nije valjan.')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [tokenParam, navigate])

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <PageSEO
        title="Status projekta"
        description="Privatni pregled statusa Web Atelier projekta."
        noIndex
      />
      <HelmetReferrerNoReferrer />
      <section className="mx-auto max-w-lg px-4 py-16">
        <p className="text-sm font-medium text-violet-700">Ani's Studio · Web Atelier</p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-slate-900">
          Status projekta
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Pregled stanja projekta. Osobni podaci i financijski detalji nisu prikazani.
        </p>

        {isLoading && <p className="mt-8 text-sm text-slate-600">Učitavam status…</p>}

        {error && (
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">{error}</p>
          </div>
        )}

        {status && !error && (
          <div className="mt-8 space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Projekt</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{status.project_number}</p>
              <p className="text-sm text-slate-700">{status.title}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
              <p className="mt-1 text-xl font-semibold text-violet-800">{status.status_label_hr}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                {status.status_description_hr}
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Provjereno: {new Date(status.checked_at).toLocaleString('hr-HR')}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}

/** Page-scoped referrer policy without touching global index.html / CSS. */
function HelmetReferrerNoReferrer() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'referrer')
    meta.setAttribute('content', 'no-referrer')
    meta.setAttribute('data-wa-tracking-referrer', '1')
    document.head.appendChild(meta)
    return () => {
      meta.remove()
    }
  }, [])
  return null
}
