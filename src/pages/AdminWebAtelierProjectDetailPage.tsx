import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  WEB_ATELIER_PROJECT_STATUSES,
  fetchWebAtelierProject,
  formatEuroCents,
  isProjectTransitionAllowed,
  updateWebAtelierProject,
  type WebAtelierProjectDetail,
  type WebAtelierProjectStatus,
} from '../lib/webAtelierOffers'
import {
  WEB_ATELIER_MATERIAL_KINDS,
  WEB_ATELIER_MATERIAL_KIND_LABEL_HR,
  WEB_ATELIER_MATERIAL_STATUSES,
  WEB_ATELIER_MATERIAL_STATUS_LABEL_HR,
  createWebAtelierMaterialRequirement,
  listWebAtelierMaterialRequirements,
  materialOverview,
  updateWebAtelierMaterialRequirement,
  type WebAtelierMaterialKind,
  type WebAtelierMaterialRequirement,
  type WebAtelierMaterialStatus,
} from '../lib/webAtelierMaterials'
import {
  createWebAtelierTrackingToken,
  defaultTrackingExpiryIso,
  listWebAtelierTrackingTokens,
  revokeWebAtelierTrackingToken,
  trackingLinkForDisplay,
  type WebAtelierTrackingTokenCreated,
  type WebAtelierTrackingTokenMeta,
} from '../lib/webAtelierTracking'

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

export default function AdminWebAtelierProjectDetailPage() {
  const { id = '' } = useParams()
  const [project, setProject] = useState<WebAtelierProjectDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState('')

  const [tokens, setTokens] = useState<WebAtelierTrackingTokenMeta[]>([])
  const [tokenLabel, setTokenLabel] = useState('')
  const [tokenDays, setTokenDays] = useState(30)
  const [createdToken, setCreatedToken] = useState<WebAtelierTrackingTokenCreated | null>(null)

  const [materials, setMaterials] = useState<WebAtelierMaterialRequirement[]>([])
  const [matKind, setMatKind] = useState<WebAtelierMaterialKind>('logo')
  const [matTitle, setMatTitle] = useState('')
  const [matRequired, setMatRequired] = useState(true)
  const [matDeadline, setMatDeadline] = useState('')

  async function reload() {
    const data = await fetchWebAtelierProject(id)
    setProject(data)
    setNotes(data?.notes ?? '')
    if (data) {
      const [tokenRows, materialRows] = await Promise.all([
        listWebAtelierTrackingTokens(data.id),
        listWebAtelierMaterialRequirements(data.id),
      ])
      setTokens(tokenRows)
      setMaterials(materialRows)
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Supabase nije konfiguriran.')
      setIsLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        await reload()
      } catch {
        if (!cancelled) setError('Projekt nije dohvaćen.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function save(patch: { notes?: string | null; status?: WebAtelierProjectStatus }) {
    if (!project) return
    setBusy(true)
    setError(null)
    try {
      await updateWebAtelierProject(project.id, patch)
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Promjena nije spremljena.')
    } finally {
      setBusy(false)
    }
  }

  async function createToken() {
    if (!project) return
    setBusy(true)
    setError(null)
    setCreatedToken(null)
    try {
      const created = await createWebAtelierTrackingToken({
        projectId: project.id,
        expiresAt: defaultTrackingExpiryIso(tokenDays),
        label: tokenLabel || null,
      })
      setCreatedToken(created)
      setTokenLabel('')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Token nije kreiran.')
    } finally {
      setBusy(false)
    }
  }

  async function revokeToken(tokenId: string) {
    setBusy(true)
    setError(null)
    try {
      await revokeWebAtelierTrackingToken(tokenId)
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Opoziv nije uspio.')
    } finally {
      setBusy(false)
    }
  }

  async function addMaterial() {
    if (!project) return
    setBusy(true)
    setError(null)
    try {
      await createWebAtelierMaterialRequirement(project.id, {
        kind: matKind,
        title: matTitle,
        is_required: matRequired,
        deadline: matDeadline || null,
      })
      setMatTitle('')
      setMatDeadline('')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Zahtjev nije dodan.')
    } finally {
      setBusy(false)
    }
  }

  async function setMaterialStatus(requirementId: string, status: WebAtelierMaterialStatus) {
    setBusy(true)
    setError(null)
    try {
      await updateWebAtelierMaterialRequirement(requirementId, { status })
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Status materijala nije spremljen.')
    } finally {
      setBusy(false)
    }
  }

  const overview = materialOverview(materials)

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto max-w-3xl px-4 py-10">
        <Link className="text-sm font-medium text-violet-700 hover:underline" to="/admin/web-atelier-projects">
          Natrag na projekte
        </Link>
        <header className="mb-8 mt-4 border-b pb-4">
          <h1 className="text-2xl font-semibold text-slate-900">
            {project ? project.project_number : 'Projekt'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Projekt postoji samo nakon prihvaćene službene ponude. Ugovoreni iznos je nepromjenjiv.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        {isLoading && <p className="text-sm text-slate-600">Učitavam projekt…</p>}
        {!isLoading && !project && !error && <p className="text-slate-600">Projekt nije pronađen.</p>}

        {project && (
          <div className="space-y-8">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="font-medium text-slate-500">Naslov</dt>
                <dd>{project.title}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Klijent</dt>
                <dd>
                  {project.client_name} ({project.client_email})
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Ugovoreni iznos</dt>
                <dd>{formatEuroCents(project.agreed_total_cents)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Status</dt>
                <dd>{STATUS_LABEL[project.status]}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-3 text-sm">
              {project.inquiry_id && (
                <Link className="text-violet-700 hover:underline" to={`/admin/web-atelier-inquiries/${project.inquiry_id}`}>
                  Upit
                </Link>
              )}
              <Link className="text-violet-700 hover:underline" to={`/admin/web-atelier-offers/${project.offer_id}`}>
                Ponuda
              </Link>
            </div>

            <label className="block text-sm">
              Status
              <select
                className="ml-2 rounded-lg border border-slate-200 px-2 py-1"
                value={project.status}
                disabled={busy}
                onChange={(event) => {
                  const status = event.target.value as WebAtelierProjectStatus
                  if (!isProjectTransitionAllowed(project.status, status)) {
                    setError(`Prijelaz ${project.status} → ${status} nije dopušten.`)
                    return
                  }
                  void save({ status })
                }}
              >
                {WEB_ATELIER_PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Bilješke
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
              onClick={() => void save({ notes: notes || null })}
            >
              Spremi bilješke
            </button>

            <section className="border-t pt-6">
              <h2 className="mb-2 text-lg font-semibold">Praćenje projekta (klijent)</h2>
              <p className="mb-4 text-sm text-slate-600">
                Token omogućuje samo minimalni javni status. Link se ne šalje automatski — kopirajte
                ga ručno. Plaintext se prikaže samo jednom.
              </p>

              <div className="mb-4 flex flex-wrap items-end gap-3 text-sm">
                <label>
                  Oznaka
                  <input
                    className="mt-1 block rounded-lg border border-slate-200 px-2 py-1"
                    value={tokenLabel}
                    onChange={(event) => setTokenLabel(event.target.value)}
                    placeholder="npr. klijent v1"
                  />
                </label>
                <label>
                  Trajanje (dani)
                  <input
                    type="number"
                    min={1}
                    max={90}
                    className="mt-1 block w-24 rounded-lg border border-slate-200 px-2 py-1"
                    value={tokenDays}
                    onChange={(event) => setTokenDays(Number(event.target.value) || 30)}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg bg-violet-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                  onClick={() => void createToken()}
                >
                  Kreiraj token
                </button>
              </div>

              {createdToken && (
                <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm">
                  <p className="font-medium text-violet-900">Novi token (kopiraj sada — više se neće prikazati):</p>
                  <code className="mt-1 block break-all text-xs text-violet-950">{createdToken.token}</code>
                  <p className="mt-2 break-all text-xs text-violet-800">
                    {trackingLinkForDisplay(
                      typeof window !== 'undefined' ? window.location.origin : '',
                      createdToken.token,
                    )}
                  </p>
                </div>
              )}

              <ul className="space-y-2 text-sm text-slate-700">
                {tokens.length === 0 && <li className="text-slate-500">Nema tokena.</li>}
                {tokens.map((token) => (
                  <li key={token.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-2">
                    <span className="font-mono text-xs">{token.token_prefix}…</span>
                    <span>{token.label || '—'}</span>
                    <span className="text-slate-500">
                      {token.is_active ? 'aktivan' : token.revoked_at ? 'opozvan' : 'istekao'}
                    </span>
                    <span className="text-slate-500">
                      do {new Date(token.expires_at).toLocaleString('hr-HR')}
                    </span>
                    <span className="text-slate-500">uporaba: {token.use_count}</span>
                    {token.is_active && (
                      <button
                        type="button"
                        disabled={busy}
                        className="text-red-700 hover:underline disabled:opacity-50"
                        onClick={() => void revokeToken(token.id)}
                      >
                        Opusti
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="border-t pt-6">
              <h2 className="mb-2 text-lg font-semibold">Materijali (admin checklist)</h2>
              <p className="mb-2 text-sm text-slate-600">
                Pregled traženih materijala. Klijentski upload još nije omogućen.
              </p>
              <p className="mb-4 text-sm text-amber-800">
                Privatni storage path je planiran po zahtjevu; anonimni upload nije dopušten.
              </p>
              <p className="mb-4 text-sm text-slate-600">
                Ukupno {overview.total} · obavezno na čekanju {overview.required_pending} ·
                primljeno {overview.received}
              </p>

              <div className="mb-4 flex flex-wrap items-end gap-3 text-sm">
                <label>
                  Vrsta
                  <select
                    className="mt-1 block rounded-lg border border-slate-200 px-2 py-1"
                    value={matKind}
                    onChange={(event) => setMatKind(event.target.value as WebAtelierMaterialKind)}
                  >
                    {WEB_ATELIER_MATERIAL_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {WEB_ATELIER_MATERIAL_KIND_LABEL_HR[kind]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex-1">
                  Naslov
                  <input
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1"
                    value={matTitle}
                    onChange={(event) => setMatTitle(event.target.value)}
                    placeholder="npr. Logo u SVG/PNG"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={matRequired}
                    onChange={(event) => setMatRequired(event.target.checked)}
                  />
                  Obavezno
                </label>
                <label>
                  Rok
                  <input
                    type="date"
                    className="mt-1 block rounded-lg border border-slate-200 px-2 py-1"
                    value={matDeadline}
                    onChange={(event) => setMatDeadline(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !matTitle.trim()}
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-50"
                  onClick={() => void addMaterial()}
                >
                  Dodaj
                </button>
              </div>

              <ul className="space-y-3 text-sm">
                {materials.length === 0 && <li className="text-slate-500">Nema zahtjeva za materijale.</li>}
                {materials.map((item) => (
                  <li key={item.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-slate-500">
                        {WEB_ATELIER_MATERIAL_KIND_LABEL_HR[item.kind]}
                      </span>
                      <span className="text-slate-500">
                        {item.is_required ? 'obavezno' : 'opcionalno'}
                      </span>
                      {item.deadline && (
                        <span className="text-slate-500">rok {item.deadline}</span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">{item.planned_storage_path}</p>
                    <label className="mt-2 block">
                      Status
                      <select
                        className="ml-2 rounded border border-slate-200 px-2 py-1"
                        value={item.status}
                        disabled={busy}
                        onChange={(event) =>
                          void setMaterialStatus(
                            item.id,
                            event.target.value as WebAtelierMaterialStatus,
                          )
                        }
                      >
                        {WEB_ATELIER_MATERIAL_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {WEB_ATELIER_MATERIAL_STATUS_LABEL_HR[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold">Događaji</h2>
              <ul className="space-y-2 text-sm text-slate-700">
                {project.events.map((event) => (
                  <li key={event.id}>
                    {event.event_type}
                    {event.from_status && event.to_status
                      ? `: ${event.from_status} → ${event.to_status}`
                      : ''}
                    <span className="ml-2 text-slate-500">
                      {new Date(event.created_at).toLocaleString('hr-HR')}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </section>
    </main>
  )
}
