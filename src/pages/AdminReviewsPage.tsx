import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { TableSkeleton } from '../components/Skeleton'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  deleteTestimonialSubmission,
  derivePublicDisplayName,
  fetchTestimonialSubmissions,
  parseRating1to5,
  updateTestimonialSubmission,
  type NameDisplayPreference,
  type TestimonialSubmission,
  type TestimonialSubmissionCategory,
  type TestimonialSubmissionStatus,
} from '../lib/testimonials'

type FilterTab = 'pending' | 'approved' | 'rejected' | 'all'

const CATEGORY_OPTIONS: { value: TestimonialSubmissionCategory; label: string }[] = [
  { value: 'general', label: 'Općenito' },
  { value: 'lrc', label: 'LRC' },
  { value: 'interiors', label: 'Interijeri' },
  { value: 'webAtelier', label: 'Web Atelier' },
]

interface DraftFields {
  edited_text: string
  category: TestimonialSubmissionCategory
  public_display_name: string
  admin_note: string
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusLabelHr(status: TestimonialSubmissionStatus): string {
  switch (status) {
    case 'pending':
      return 'Na čekanju'
    case 'approved':
      return 'Objavljena'
    case 'rejected':
      return 'Odbijena'
    default:
      return status
  }
}

function namePreferenceLabel(pref: NameDisplayPreference): string {
  switch (pref) {
    case 'full_name':
      return 'Puno ime'
    case 'first_name_only':
      return 'Samo ime'
    case 'initials':
      return 'Inicijali'
    case 'anonymous':
      return 'Anonimno'
    default:
      return pref
  }
}

function submissionToDraft(s: TestimonialSubmission): DraftFields {
  const stored = s.public_display_name?.trim()
  return {
    edited_text: s.edited_text ?? '',
    category: s.category,
    public_display_name:
      stored && stored.length > 0
        ? stored
        : derivePublicDisplayName(s.submitted_name, s.name_display_preference),
    admin_note: s.admin_note ?? '',
  }
}

function resolvePublicDisplayNameForPersist(
  draftValue: string,
  submission: TestimonialSubmission
): string | null {
  const manual = draftValue.trim()
  if (manual !== '') return manual
  const derived = derivePublicDisplayName(
    submission.submitted_name,
    submission.name_display_preference
  ).trim()
  return derived === '' ? null : derived
}

function previewSnippet(s: TestimonialSubmission, max = 72): string {
  const t = (s.edited_text?.trim() || s.original_text || '').replace(/\s+/g, ' ').trim()
  if (!t) return '—'
  if (t.length <= max) return t
  return `${t.slice(0, max).trimEnd()}…`
}

interface ReviewDetailPanelProps {
  submission: TestimonialSubmission
  draft: DraftFields
  busy: boolean
  onDraftChange: (id: string, patch: Partial<DraftFields>) => void
  onSave: () => void
  onApprove: () => void
  onReject: () => void
  onDeletePermanent: () => void
}

function ReviewDetailPanel({
  submission: s,
  draft,
  busy,
  onDraftChange,
  onSave,
  onApprove,
  onReject,
  onDeletePermanent,
}: ReviewDetailPanelProps) {
  const submissionRating = parseRating1to5(s.rating)

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">
          Detaljni prikaz — {formatDate(s.created_at)}
        </p>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div className="text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Poslani podaci</p>
          <dl className="mt-2 space-y-1 text-slate-800">
            <div>
              <dt className="inline text-slate-500">Ime: </dt>
              <dd className="inline">{s.submitted_name || '—'}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Email: </dt>
              <dd className="inline break-all">{s.email || '—'}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Želja za prikaz imena: </dt>
              <dd className="inline">{namePreferenceLabel(s.name_display_preference)}</dd>
            </div>
            {s.location_display ? (
              <div>
                <dt className="inline text-slate-500">Lokacija za prikaz: </dt>
                <dd className="inline">{s.location_display}</dd>
              </div>
            ) : null}
            <div>
              <dt className="inline text-slate-500">Ocjena: </dt>
              <dd className="inline">
                {submissionRating != null ? (
                  <span className="font-semibold text-slate-900">{submissionRating}/5</span>
                ) : (
                  <span className="text-slate-400">nije unesena</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
        <div className="text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Originalni tekst</p>
          <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 text-slate-800">
            {s.original_text || '—'}
          </p>
          {s.edited_text ? (
            <p className="mt-3 text-xs text-slate-500">
              Postojeća javna verzija u bazi:{' '}
              <span className="font-medium text-slate-700">{s.edited_text}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-100 p-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Javna verzija recenzije</span>
          <p className="mb-1 text-xs text-slate-500">
            Ako ostane prazno, koristit će se originalni tekst.
          </p>
          <textarea
            rows={5}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            value={draft.edited_text}
            onChange={(e) => onDraftChange(s.id, { edited_text: e.target.value })}
            disabled={busy}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-800">Kategorija</span>
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={draft.category}
              onChange={(e) =>
                onDraftChange(s.id, {
                  category: e.target.value as TestimonialSubmissionCategory,
                })
              }
              disabled={busy}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-800">Javno ime za prikaz</span>
            <p className="mb-1 text-xs text-slate-500">
              Automatski prema odabiru klijenta. Možete ručno promijeniti prije objave.
            </p>
            <input
              type="text"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={draft.public_display_name}
              onChange={(e) => onDraftChange(s.id, { public_display_name: e.target.value })}
              disabled={busy}
              placeholder="Opcionalno"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-800">Interna napomena</span>
          <p className="text-xs text-slate-500">Nije javno. Opcionalno.</p>
          <textarea
            rows={3}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            value={draft.admin_note}
            onChange={(e) => onDraftChange(s.id, { admin_note: e.target.value })}
            disabled={busy}
          />
        </label>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:border-violet-200 hover:bg-slate-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Radim…' : 'Spremi izmjene'}
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Objavi recenziju
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-800 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Odbij recenziju
          </button>
          {s.status === 'rejected' ? (
            <button
              type="button"
              onClick={onDeletePermanent}
              disabled={busy}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Trajno izbriši
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function AdminReviewsPage() {
  const [filterTab, setFilterTab] = useState<FilterTab>('pending')
  const [submissions, setSubmissions] = useState<TestimonialSubmission[]>([])
  const [draftById, setDraftById] = useState<Record<string, DraftFields>>({})
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const sortedSubmissions = useMemo(
    () =>
      [...submissions].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [submissions]
  )

  const setDraftField = useCallback((id: string, patch: Partial<DraftFields>) => {
    setDraftById((prev) => {
      const cur = prev[id]
      if (!cur) return prev
      return { ...prev, [id]: { ...cur, ...patch } }
    })
  }, [])

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const statusArg: TestimonialSubmissionStatus | undefined =
        filterTab === 'all' ? undefined : filterTab
      const data = await fetchTestimonialSubmissions(statusArg)
      setSubmissions(data)
      const nextDrafts: Record<string, DraftFields> = {}
      for (const s of data) {
        nextDrafts[s.id] = submissionToDraft(s)
      }
      setDraftById(nextDrafts)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Došlo je do greške pri dohvaćanju recenzija. Pokušaj ponovo.'
      )
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [filterTab])

  useEffect(() => {
    setSelectedReviewId(null)
  }, [filterTab])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Supabase nije konfiguriran. Dohvat podataka nije moguć.')
      setIsLoading(false)
      return
    }
    void loadSubmissions()
  }, [loadSubmissions])

  /**
   * Kad odabrani red više nije u listi (npr. nakon objave/odbijanja u filtru jednog statusa),
   * odaberi prvu preostalu recenziju. Ne postavljaj automatski odabir pri prvom učitavanju
   * (dok je odabir null — detalj se otvara klikom na red).
   */
  useEffect(() => {
    if (sortedSubmissions.length === 0) {
      setSelectedReviewId(null)
      return
    }
    setSelectedReviewId((cur) => {
      if (!cur) return null
      if (sortedSubmissions.some((s) => s.id === cur)) return cur
      return sortedSubmissions[0]?.id ?? null
    })
  }, [sortedSubmissions])

  const selectedRow = useMemo(
    () => sortedSubmissions.find((s) => s.id === selectedReviewId) ?? null,
    [sortedSubmissions, selectedReviewId]
  )
  const selectedDraft = selectedReviewId ? draftById[selectedReviewId] : undefined
  const detailBusy = selectedReviewId ? actionId === selectedReviewId : false

  const handleSaveDraft = async (id: string) => {
    const draft = draftById[id]
    const row = submissions.find((s) => s.id === id)
    if (!draft || !row) return

    const edited_trim = draft.edited_text.trim()
    setActionId(id)
    try {
      const updated = await updateTestimonialSubmission(id, {
        edited_text: edited_trim === '' ? null : edited_trim,
        category: draft.category,
        public_display_name: resolvePublicDisplayNameForPersist(draft.public_display_name, row),
        admin_note: draft.admin_note.trim() === '' ? null : draft.admin_note,
      })
      setSubmissions((prev) => prev.map((s) => (s.id === id ? updated : s)))
      setDraftById((prev) => ({ ...prev, [id]: submissionToDraft(updated) }))
      toast.success('Izmjene spremljene.')
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Spremanje nije uspjelo. Pokušaj ponovo.'
      toast.error(msg)
      console.error(err)
    } finally {
      setActionId(null)
    }
  }

  const handleApprove = async (id: string) => {
    const draft = draftById[id]
    const row = submissions.find((s) => s.id === id)
    if (!draft || !row) return

    const edited_trim = draft.edited_text.trim()
    setActionId(id)
    try {
      const updated = await updateTestimonialSubmission(id, {
        status: 'approved',
        edited_text: edited_trim === '' ? null : edited_trim,
        category: draft.category,
        public_display_name: resolvePublicDisplayNameForPersist(draft.public_display_name, row),
        admin_note: draft.admin_note.trim() === '' ? null : draft.admin_note,
      })
      setSubmissions((prev) =>
        filterTab === 'all'
          ? prev.map((s) => (s.id === id ? updated : s))
          : prev.filter((s) => s.id !== id)
      )
      if (filterTab === 'all') {
        setDraftById((prev) => ({ ...prev, [id]: submissionToDraft(updated) }))
      } else {
        setDraftById((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      }
      toast.success('Recenzija je označena kao objavljena.')
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Objava nije uspjela. Pokušaj ponovo.'
      toast.error(msg)
      console.error(err)
    } finally {
      setActionId(null)
    }
  }

  const handleReject = async (id: string) => {
    setActionId(id)
    try {
      const updated = await updateTestimonialSubmission(id, {
        status: 'rejected',
      })
      setSubmissions((prev) =>
        filterTab === 'all'
          ? prev.map((s) => (s.id === id ? updated : s))
          : prev.filter((s) => s.id !== id)
      )
      if (filterTab === 'all') {
        setDraftById((prev) => ({ ...prev, [id]: submissionToDraft(updated) }))
      } else {
        setDraftById((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      }
      toast.success('Recenzija odbijena.')
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Odbijanje nije uspjelo. Pokušaj ponovo.'
      toast.error(msg)
      console.error(err)
    } finally {
      setActionId(null)
    }
  }

  const handlePermanentDelete = async (id: string) => {
    if (
      !window.confirm(
        'Ova radnja trajno briše odbijenu recenziju iz baze. Nastaviti?'
      )
    ) {
      return
    }
    setActionId(id)
    try {
      await deleteTestimonialSubmission(id)
      setSubmissions((prev) => prev.filter((s) => s.id !== id))
      setDraftById((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      if (selectedReviewId === id) {
        setSelectedReviewId(null)
      }
      toast.success('Recenzija trajno izbrisana.')
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Brisanje nije uspjelo. Pokušaj ponovo.'
      toast.error(msg)
      console.error(err)
    } finally {
      setActionId(null)
    }
  }

  const statusColors: Record<TestimonialSubmissionStatus, string> = {
    pending: 'bg-amber-100 text-amber-900 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    rejected: 'bg-red-50 text-red-900 border-red-200',
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8 border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-semibold text-slate-900">Moderacija recenzija</h1>
          <p className="mt-1 text-sm text-slate-600">
            Pristigle recenzije s javne prijave. Odobravate ih ovdje; javni prikaz na stranici u ovoj fazi
            nije povezan.
          </p>
        </header>

        <div className="mb-6 border-b border-slate-200">
          <nav className="-mb-px flex flex-wrap gap-4" aria-label="Status recenzija">
            {(
              [
                { key: 'pending' satisfies FilterTab, label: 'Na čekanju' },
                { key: 'approved' satisfies FilterTab, label: 'Objavljene' },
                { key: 'rejected' satisfies FilterTab, label: 'Odbijene' },
                { key: 'all' satisfies FilterTab, label: 'Sve' },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilterTab(key)}
                className={`
                  whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors
                  ${
                    filterTab === key
                      ? 'border-violet-600 text-violet-600'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }
                `}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {isLoading && <TableSkeleton rows={6} />}

        {!isLoading && !error && sortedSubmissions.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-600">Nema recenzija u ovom statusu.</p>
          </div>
        )}

        {!isLoading && !error && sortedSubmissions.length > 0 && (
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
            {/* Kompaktna lista */}
            <div className="min-w-0 shrink-0 lg:w-[min(100%,22rem)] xl:w-[26rem]">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Lista
              </h2>
              <ul className="max-h-[min(70vh,28rem)] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-2 lg:max-h-[min(80vh,36rem)]">
                {sortedSubmissions.map((s) => {
                  const isSel = s.id === selectedReviewId
                  const listRating = parseRating1to5(s.rating)
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedReviewId(s.id)}
                        className={`
                          w-full rounded-lg border px-3 py-2.5 text-left text-sm shadow-sm transition
                          ${
                            isSel
                              ? 'border-violet-400 bg-white ring-2 ring-violet-200'
                              : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/60'
                          }
                        `}
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium text-slate-800">{formatDate(s.created_at)}</span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusColors[s.status]}`}
                          >
                            {statusLabelHr(s.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-violet-800">
                          {CATEGORY_OPTIONS.find((o) => o.value === s.category)?.label ?? s.category}
                        </p>
                        <p className="truncate text-sm font-semibold text-slate-900">{s.submitted_name}</p>
                        <p className="truncate text-xs text-slate-600">{s.email}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-600">
                          {previewSnippet(s)}
                        </p>
                        {listRating != null ? (
                          <p className="mt-1 text-xs font-semibold text-amber-900/90">
                            Ocjena: {listRating}/5
                          </p>
                        ) : null}
                        <span className="mt-2 inline-block text-xs font-medium text-violet-600">
                          {isSel ? 'Odabrano' : 'Otvori'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Detaljni editor — samo jedna odabrana recenzija */}
            <div className="min-w-0 flex-1">
              {!selectedRow || !selectedDraft ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-600">
                  Odaberite recenziju u listi za prikaz detalja.
                </div>
              ) : (
                <ReviewDetailPanel
                  submission={selectedRow}
                  draft={selectedDraft}
                  busy={detailBusy}
                  onDraftChange={setDraftField}
                  onSave={() => void handleSaveDraft(selectedRow.id)}
                  onApprove={() => void handleApprove(selectedRow.id)}
                  onReject={() => void handleReject(selectedRow.id)}
                  onDeletePermanent={() => void handlePermanentDelete(selectedRow.id)}
                />
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
