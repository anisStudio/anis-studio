import { useEffect, useState, type FormEvent } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  DEPARTMENTS,
  DEPARTMENT_LABEL_HR,
  RESERVATION_STATUS_LABEL_HR,
  createAvailabilityWindow,
  createDepartmentReservation,
  listDepartmentAvailability,
  updateDepartmentReservation,
  type AvailabilityBundle,
  type Department,
  type ReservationStatus,
} from '../lib/departmentAvailability'
import {
  listCommunicationTemplates,
  upsertCommunicationTemplate,
  COMMUNICATION_CHANNELS,
  COMMUNICATION_CHANNEL_LABEL_HR,
  type CommunicationChannel,
  type CommunicationTemplate,
} from '../lib/webAtelierCommunications'

export default function AdminAvailabilityPage() {
  const [department, setDepartment] = useState<Department>('web_atelier')
  const [bundle, setBundle] = useState<AvailabilityBundle>({ windows: [], reservations: [] })
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [winTitle, setWinTitle] = useState('')
  const [winStart, setWinStart] = useState('')
  const [winEnd, setWinEnd] = useState('')
  const [winCapacity, setWinCapacity] = useState(1)

  const [resWindowId, setResWindowId] = useState('')
  const [resTitle, setResTitle] = useState('')
  const [resStart, setResStart] = useState('')
  const [resEnd, setResEnd] = useState('')
  const [resStatus, setResStatus] = useState<ReservationStatus>('draft')

  const [tplName, setTplName] = useState('')
  const [tplChannel, setTplChannel] = useState<CommunicationChannel>('email')
  const [tplSubject, setTplSubject] = useState('')
  const [tplBody, setTplBody] = useState('')

  async function reload() {
    const [availability, tpls] = await Promise.all([
      listDepartmentAvailability({ department }),
      listCommunicationTemplates('web_atelier'),
    ])
    setBundle(availability)
    setTemplates(tpls)
    if (!resWindowId && availability.windows[0]) {
      setResWindowId(availability.windows[0].id)
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Supabase nije konfiguriran.')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        setError(null)
        await reload()
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Podaci nisu učitani.')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department])

  async function addWindow(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createAvailabilityWindow({
        department,
        title: winTitle,
        startsAt: new Date(winStart).toISOString(),
        endsAt: new Date(winEnd).toISOString(),
        capacity: winCapacity,
      })
      setWinTitle('')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Prozor nije spremljen.')
    } finally {
      setBusy(false)
    }
  }

  async function addReservation(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createDepartmentReservation({
        windowId: resWindowId,
        title: resTitle,
        startsAt: new Date(resStart).toISOString(),
        endsAt: new Date(resEnd).toISOString(),
        status: resStatus,
      })
      setResTitle('')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Rezervacija nije spremljena.')
    } finally {
      setBusy(false)
    }
  }

  async function setReservationStatus(id: string, status: ReservationStatus) {
    setBusy(true)
    setError(null)
    try {
      await updateDepartmentReservation(id, { status })
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Status nije promijenjen.')
    } finally {
      setBusy(false)
    }
  }

  async function addTemplate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await upsertCommunicationTemplate({
        department: 'web_atelier',
        channel: tplChannel,
        name: tplName,
        subjectTemplate: tplSubject || null,
        bodyTemplate: tplBody,
      })
      setTplName('')
      setTplSubject('')
      setTplBody('')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Predložak nije spremljen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Kapacitet i predlošci</h1>
      <p className="mt-2 text-sm text-slate-600">
        Zajednički raspored odjela (V1). Prihvat ponude ne rezervira automatski termin.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {DEPARTMENTS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDepartment(d)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              department === d
                ? 'bg-violet-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {DEPARTMENT_LABEL_HR[d]}
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <form onSubmit={addWindow} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Novi prozor kapaciteta</h2>
          <input
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Naslov"
            value={winTitle}
            onChange={(e) => setWinTitle(e.target.value)}
          />
          <label className="block text-xs text-slate-600">
            Početak
            <input
              required
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={winStart}
              onChange={(e) => setWinStart(e.target.value)}
            />
          </label>
          <label className="block text-xs text-slate-600">
            Kraj
            <input
              required
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={winEnd}
              onChange={(e) => setWinEnd(e.target.value)}
            />
          </label>
          <label className="block text-xs text-slate-600">
            Kapacitet
            <input
              required
              type="number"
              min={1}
              max={100}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={winCapacity}
              onChange={(e) => setWinCapacity(Number(e.target.value))}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-violet-700 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Spremi prozor
          </button>
        </form>

        <form
          onSubmit={addReservation}
          className="space-y-2 rounded-xl border border-slate-200 bg-white p-4"
        >
          <h2 className="font-semibold text-slate-900">Nova rezervacija</h2>
          <select
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={resWindowId}
            onChange={(e) => setResWindowId(e.target.value)}
          >
            <option value="">— odaberi prozor —</option>
            {bundle.windows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title} (kap. {w.capacity})
              </option>
            ))}
          </select>
          <input
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Naslov rezervacije"
            value={resTitle}
            onChange={(e) => setResTitle(e.target.value)}
          />
          <input
            required
            type="datetime-local"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={resStart}
            onChange={(e) => setResStart(e.target.value)}
          />
          <input
            required
            type="datetime-local"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={resEnd}
            onChange={(e) => setResEnd(e.target.value)}
          />
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={resStatus}
            onChange={(e) => setResStatus(e.target.value as ReservationStatus)}
          >
            <option value="draft">Nacrt</option>
            <option value="confirmed">Potvrđeno</option>
          </select>
          <button
            type="submit"
            disabled={busy || !resWindowId}
            className="rounded-lg bg-violet-700 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Spremi rezervaciju
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold text-slate-900">Prozori — {DEPARTMENT_LABEL_HR[department]}</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {bundle.windows.length === 0 ? (
            <li className="text-slate-500">Nema prozora.</li>
          ) : (
            bundle.windows.map((w) => (
              <li key={w.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="font-medium">{w.title}</div>
                <div className="text-slate-600">
                  {new Date(w.starts_at).toLocaleString('hr-HR')} →{' '}
                  {new Date(w.ends_at).toLocaleString('hr-HR')} · kapacitet {w.capacity}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold text-slate-900">Rezervacije</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {bundle.reservations.length === 0 ? (
            <li className="text-slate-500">Nema rezervacija.</li>
          ) : (
            bundle.reservations.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3"
              >
                <div>
                  <div className="font-medium">{r.title}</div>
                  <div className="text-slate-600">
                    {RESERVATION_STATUS_LABEL_HR[r.status]} ·{' '}
                    {new Date(r.starts_at).toLocaleString('hr-HR')} →{' '}
                    {new Date(r.ends_at).toLocaleString('hr-HR')}
                  </div>
                </div>
                <div className="flex gap-2">
                  {r.status !== 'confirmed' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setReservationStatus(r.id, 'confirmed')}
                      className="rounded-lg border border-violet-200 px-3 py-1 text-violet-700"
                    >
                      Potvrdi
                    </button>
                  ) : null}
                  {r.status !== 'cancelled' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setReservationStatus(r.id, 'cancelled')}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-slate-700"
                    >
                      Otkaži
                    </button>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-10 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Predlošci komunikacije (Web Atelier)</h2>
        <form onSubmit={addTemplate} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Naziv predloška"
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
          />
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={tplChannel}
            onChange={(e) => setTplChannel(e.target.value as CommunicationChannel)}
          >
            {COMMUNICATION_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {COMMUNICATION_CHANNEL_LABEL_HR[c]}
              </option>
            ))}
          </select>
          <input
            className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Predmet (opcionalno)"
            value={tplSubject}
            onChange={(e) => setTplSubject(e.target.value)}
          />
          <textarea
            required
            rows={3}
            className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Tekst predloška"
            value={tplBody}
            onChange={(e) => setTplBody(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-violet-700 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Spremi predložak
          </button>
        </form>
        <ul className="mt-4 space-y-2 text-sm">
          {templates.map((t) => (
            <li key={t.id} className="rounded border border-slate-100 bg-slate-50 p-2">
              <span className="font-medium">{t.name}</span>
              <span className="text-slate-600">
                {' '}
                · {COMMUNICATION_CHANNEL_LABEL_HR[t.channel]}
                {t.is_active ? '' : ' · neaktivan'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
