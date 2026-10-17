import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  DEPARTMENTS,
  DEPARTMENT_LABEL_HR,
  RESERVATION_STATUS_LABEL_HR,
  createAvailabilityWindow,
  listDepartmentAvailability,
  type AvailabilityBundle,
  type Department,
  type ReservationStatus,
} from '../lib/departmentAvailability'
import {
  BOOKING_KINDS,
  BOOKING_KIND_LABEL_HR,
  BOOKING_SOURCES,
  BOOKING_SOURCE_LABEL_HR,
  CONSULTATION_OUTCOMES,
  CONSULTATION_OUTCOME_LABEL_HR,
  buildMonthCells,
  cancelReservationWithReason,
  createAvailabilityClosure,
  createManualBooking,
  formatZagrebDateTime,
  isSmartBookingMigrationPending,
  listBookingCalendar,
  listRescheduleHistory,
  reopenAvailabilityClosure,
  rescheduleReservation,
  setConsultationOutcome,
  slotTouchesZagrebDate,
  updateBookingSharedSettings,
  zagrebYearMonth,
  type BookingCalendarBundle,
  type BookingKind,
  type BookingSource,
  type ConsultationOutcome,
} from '../lib/smartBooking'
import {
  listCommunicationTemplates,
  upsertCommunicationTemplate,
  COMMUNICATION_CHANNELS,
  COMMUNICATION_CHANNEL_LABEL_HR,
  type CommunicationChannel,
  type CommunicationTemplate,
} from '../lib/webAtelierCommunications'

type DeptFilter = Department | 'all'

function entityAdminLink(entityKind: string, entityId: string | null): string | null {
  if (!entityId) return null
  if (entityKind === 'web_atelier_inquiry') return `/admin/web-atelier-inquiries/${entityId}`
  if (entityKind === 'web_atelier_project') return `/admin/web-atelier-projects/${entityId}`
  if (entityKind === 'web_atelier_offer' || entityKind.startsWith('web_atelier_offer')) {
    return `/admin/web-atelier-offers/${entityId}`
  }
  return null
}

export default function AdminAvailabilityPage() {
  const [deptFilter, setDeptFilter] = useState<DeptFilter>('all')
  const [f26, setF26] = useState(true)
  const [bundle, setBundle] = useState<BookingCalendarBundle | AvailabilityBundle>({
    windows: [],
    reservations: [],
  })
  const [closures, setClosures] = useState<BookingCalendarBundle['closures']>([])
  const [settingsCapacity, setSettingsCapacity] = useState(1)
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [yearMonth, setYearMonth] = useState(() => zagrebYearMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const [winTitle, setWinTitle] = useState('')
  const [winStart, setWinStart] = useState('')
  const [winEnd, setWinEnd] = useState('')
  const [winCapacity, setWinCapacity] = useState(1)
  const [winDepartment, setWinDepartment] = useState<Department>('web_atelier')

  const [closureStart, setClosureStart] = useState('')
  const [closureEnd, setClosureEnd] = useState('')
  const [closureDept, setClosureDept] = useState<Department | ''>('')
  const [closureReason, setClosureReason] = useState('')

  const [manWindowId, setManWindowId] = useState('')
  const [manName, setManName] = useState('')
  const [manEmail, setManEmail] = useState('')
  const [manPhone, setManPhone] = useState('')
  const [manDesc, setManDesc] = useState('')
  const [manSource, setManSource] = useState<BookingSource>('phone')
  const [manKind, setManKind] = useState<BookingKind>('consultation')
  const [manStart, setManStart] = useState('')
  const [manEnd, setManEnd] = useState('')

  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [resWindowId, setResWindowId] = useState('')
  const [resStart, setResStart] = useState('')
  const [resEnd, setResEnd] = useState('')
  const [resReason, setResReason] = useState('')
  const [history, setHistory] = useState<
    Array<{ id: string; previous_starts_at: string; new_starts_at: string; reason: string | null }>
  >([])

  const [tplName, setTplName] = useState('')
  const [tplChannel, setTplChannel] = useState<CommunicationChannel>('email')
  const [tplSubject, setTplSubject] = useState('')
  const [tplBody, setTplBody] = useState('')

  const departmentParam = deptFilter === 'all' ? null : deptFilter

  async function reload() {
    const tpls = await listCommunicationTemplates('web_atelier')
    setTemplates(tpls)

    if (f26) {
      try {
        const from = new Date(Date.UTC(yearMonth.year, yearMonth.month - 1, 1)).toISOString()
        const to = new Date(Date.UTC(yearMonth.year, yearMonth.month, 1)).toISOString()
        const data = await listBookingCalendar({
          department: departmentParam,
          from,
          to,
        })
        setBundle(data)
        setClosures(data.closures)
        setSettingsCapacity(data.settings.shared_consultation_capacity)
        setF26(true)
        return
      } catch (caught) {
        if (!isSmartBookingMigrationPending(caught)) throw caught
        setF26(false)
      }
    }

    const legacy = await listDepartmentAvailability({ department: departmentParam })
    setBundle(legacy)
    setClosures([])
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
  }, [deptFilter, yearMonth.year, yearMonth.month, f26])

  const reservations = bundle.reservations as BookingCalendarBundle['reservations'] | AvailabilityBundle['reservations']
  const windows = bundle.windows

  const cells = useMemo(
    () => buildMonthCells(yearMonth.year, yearMonth.month),
    [yearMonth.year, yearMonth.month],
  )

  const monthLabel = new Intl.DateTimeFormat('hr-HR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Zagreb',
  }).format(new Date(Date.UTC(yearMonth.year, yearMonth.month - 1, 15, 12)))

  async function addWindow(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createAvailabilityWindow({
        department: winDepartment,
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

  async function addClosure(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setWarning(null)
    try {
      const result = await createAvailabilityClosure({
        startsAt: new Date(closureStart).toISOString(),
        endsAt: new Date(closureEnd).toISOString(),
        department: closureDept || null,
        reason: closureReason || null,
      })
      if (result.has_conflicts) {
        setWarning(
          result.warning ??
            `Zatvaranje spremljeno, ali postoji ${result.conflicting_reservations.length} potvrđenih rezervacija — nisu automatski pomaknute.`,
        )
      }
      setClosureReason('')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Zatvaranje nije spremljeno.')
    } finally {
      setBusy(false)
    }
  }

  async function addManual(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createManualBooking({
        windowId: manWindowId,
        startsAt: new Date(manStart).toISOString(),
        endsAt: new Date(manEnd).toISOString(),
        contactName: manName,
        contactEmail: manEmail || null,
        contactPhone: manPhone || null,
        description: manDesc || null,
        source: manSource,
        bookingKind: manKind,
        status: 'confirmed',
      })
      setManName('')
      setManDesc('')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ručna rezervacija nije spremljena.')
    } finally {
      setBusy(false)
    }
  }

  async function saveCapacity(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const s = await updateBookingSharedSettings({
        sharedConsultationCapacity: settingsCapacity,
      })
      setSettingsCapacity(s.shared_consultation_capacity)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kapacitet nije spremljen.')
    } finally {
      setBusy(false)
    }
  }

  async function doCancel(id: string) {
    const reason = window.prompt('Razlog otkazivanja (obavezno):')
    if (!reason?.trim()) return
    setBusy(true)
    setError(null)
    try {
      await cancelReservationWithReason(id, reason.trim())
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Otkazivanje nije uspjelo.')
    } finally {
      setBusy(false)
    }
  }

  async function doOutcome(id: string, outcome: ConsultationOutcome, release: boolean) {
    setBusy(true)
    setError(null)
    try {
      await setConsultationOutcome({ reservationId: id, outcome, releaseSlot: release })
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ishod nije spremljen.')
    } finally {
      setBusy(false)
    }
  }

  async function openReschedule(id: string) {
    setRescheduleId(id)
    setBusy(true)
    try {
      const h = await listRescheduleHistory(id)
      setHistory(h)
    } catch {
      setHistory([])
    } finally {
      setBusy(false)
    }
  }

  async function submitReschedule(e: FormEvent) {
    e.preventDefault()
    if (!rescheduleId) return
    setBusy(true)
    setError(null)
    try {
      await rescheduleReservation({
        reservationId: rescheduleId,
        windowId: resWindowId,
        startsAt: new Date(resStart).toISOString(),
        endsAt: new Date(resEnd).toISOString(),
        reason: resReason || null,
      })
      setRescheduleId(null)
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Premještanje nije uspjelo.')
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

  const dayReservations = selectedDate
    ? reservations.filter((r) => slotTouchesZagrebDate(r.starts_at, r.ends_at, selectedDate))
    : []
  const dayClosures = selectedDate
    ? closures.filter((c) => slotTouchesZagrebDate(c.starts_at, c.ends_at, selectedDate))
    : []

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Pametne rezervacije i kapacitet</h1>
      <p className="mt-2 text-sm text-slate-600">
        Zajednički konzultacijski kapacitet (web_atelier / interiors / lrc). Prihvat ponude ne
        rezervira automatski termin. F2.6 ne šalje automatske e-mailove ni SMS.
      </p>
      {!f26 ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          F2.6 migracija još nije aktivna u bazi — prikazan je G–I legacy način. Kalendar zatvaranja
          i javne rezervacije čekaju SQL aktivaciju.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {(['all', ...DEPARTMENTS] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDeptFilter(d)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              deptFilter === d
                ? 'bg-violet-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {d === 'all' ? 'Svi odjeli' : DEPARTMENT_LABEL_HR[d]}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      {warning ? (
        <p className="mt-4 text-sm text-amber-800" role="status">
          {warning}
        </p>
      ) : null}

      {f26 ? (
        <form
          onSubmit={saveCapacity}
          className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
        >
          <label className="text-xs text-slate-600">
            Zajednički kapacitet konzultacija
            <input
              type="number"
              min={1}
              max={50}
              className="mt-1 block w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settingsCapacity}
              onChange={(e) => setSettingsCapacity(Number(e.target.value))}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Spremi kapacitet
          </button>
          <p className="text-xs text-slate-500">
            Default: 1 potvrđeni termin konzultacije istovremeno preko svih odjela.
          </p>
        </form>
      ) : null}

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Kalendar — {monthLabel}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border px-3 py-1 text-sm"
              onClick={() =>
                setYearMonth((ym) =>
                  ym.month === 1
                    ? { year: ym.year - 1, month: 12 }
                    : { year: ym.year, month: ym.month - 1 },
                )
              }
            >
              ←
            </button>
            <button
              type="button"
              className="rounded-lg border px-3 py-1 text-sm"
              onClick={() =>
                setYearMonth((ym) =>
                  ym.month === 12
                    ? { year: ym.year + 1, month: 1 }
                    : { year: ym.year, month: ym.month + 1 },
                )
              }
            >
              →
            </button>
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
          <li>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> Dostupan
            prozor
          </li>
          <li>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-violet-600" /> Rezervacija
          </li>
          <li>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-rose-500" /> Zatvoreno
          </li>
          <li>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /> Produkcija
          </li>
        </ul>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs">
          {['Po', 'Ut', 'Sr', 'Če', 'Pe', 'Su', 'Ne'].map((d) => (
            <div key={d} className="py-1 font-medium text-slate-500">
              {d}
            </div>
          ))}
          {cells.map((cell) => {
            if (!cell.isoDate || cell.day == null) {
              return <div key={cell.key} className="min-h-[3.5rem]" />
            }
            const hasWin = windows.some((w) =>
              slotTouchesZagrebDate(w.starts_at, w.ends_at, cell.isoDate!),
            )
            const hasRes = reservations.some(
              (r) =>
                r.status !== 'cancelled' &&
                slotTouchesZagrebDate(r.starts_at, r.ends_at, cell.isoDate!),
            )
            const hasClose = closures.some((c) =>
              slotTouchesZagrebDate(c.starts_at, c.ends_at, cell.isoDate!),
            )
            const selected = selectedDate === cell.isoDate
            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelectedDate(cell.isoDate)}
                className={`min-h-[3.5rem] rounded-lg border p-1 text-left ${
                  selected ? 'border-violet-600 ring-1 ring-violet-400' : 'border-slate-100'
                } ${hasClose ? 'bg-rose-50' : hasRes ? 'bg-violet-50' : hasWin ? 'bg-emerald-50' : 'bg-slate-50'}`}
              >
                <div className="font-medium">{cell.day}</div>
                <div className="mt-0.5 flex gap-0.5">
                  {hasWin ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
                  {hasRes ? <span className="h-1.5 w-1.5 rounded-full bg-violet-600" /> : null}
                  {hasClose ? <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> : null}
                </div>
              </button>
            )
          })}
        </div>

        {selectedDate ? (
          <div className="mt-4 space-y-2 text-sm">
            <h3 className="font-medium text-slate-900">Dan {selectedDate}</h3>
            {dayClosures.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2"
              >
                <div>
                  Zatvoreno ({c.department ? DEPARTMENT_LABEL_HR[c.department] : 'svi odjeli'})
                  {c.reason ? ` — ${c.reason}` : ''}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => void reopenAvailabilityClosure(c.id).then(reload)}
                >
                  Ponovno otvori
                </button>
              </div>
            ))}
            {dayReservations.length === 0 ? (
              <p className="text-slate-500">Nema rezervacija za ovaj dan.</p>
            ) : (
              dayReservations.map((r) => {
                const rich = r as BookingCalendarBundle['reservations'][number]
                const link = entityAdminLink(rich.entity_kind, rich.entity_id)
                return (
                  <div
                    key={r.id}
                    className="rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div className="font-medium">{r.title}</div>
                    <div className="text-slate-600">
                      {DEPARTMENT_LABEL_HR[r.department]} ·{' '}
                      {RESERVATION_STATUS_LABEL_HR[r.status as ReservationStatus]} ·{' '}
                      {formatZagrebDateTime(r.starts_at)} → {formatZagrebDateTime(r.ends_at)}
                    </div>
                    {'booking_kind' in rich && rich.booking_kind ? (
                      <div className="text-xs text-slate-500">
                        {BOOKING_KIND_LABEL_HR[rich.booking_kind]}
                        {rich.source ? ` · ${BOOKING_SOURCE_LABEL_HR[rich.source]}` : ''}
                        {rich.contact_email ? ` · ${rich.contact_email}` : ''}
                        {rich.slot_released_at ? ' · slot oslobođen' : ''}
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {link ? (
                        <Link to={link} className="text-xs text-violet-700 underline">
                          Povezani zapis
                        </Link>
                      ) : null}
                      {f26 && r.status !== 'cancelled' ? (
                        <>
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-xs"
                            onClick={() => void openReschedule(r.id)}
                          >
                            Premjesti
                          </button>
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-xs"
                            onClick={() => void doCancel(r.id)}
                          >
                            Otkaži
                          </button>
                          {CONSULTATION_OUTCOMES.map((o) => (
                            <button
                              key={o}
                              type="button"
                              className="rounded border px-2 py-1 text-xs"
                              onClick={() =>
                                void doOutcome(r.id, o, o === 'info_sufficient')
                              }
                            >
                              {CONSULTATION_OUTCOME_LABEL_HR[o]}
                            </button>
                          ))}
                        </>
                      ) : null}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : null}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <form onSubmit={addWindow} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Novi prozor dostupnosti</h2>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={winDepartment}
            onChange={(e) => setWinDepartment(e.target.value as Department)}
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {DEPARTMENT_LABEL_HR[d]}
              </option>
            ))}
          </select>
          <input
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Naslov"
            value={winTitle}
            onChange={(e) => setWinTitle(e.target.value)}
          />
          <input
            required
            type="datetime-local"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={winStart}
            onChange={(e) => setWinStart(e.target.value)}
          />
          <input
            required
            type="datetime-local"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={winEnd}
            onChange={(e) => setWinEnd(e.target.value)}
          />
          <input
            required
            type="number"
            min={1}
            max={100}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={winCapacity}
            onChange={(e) => setWinCapacity(Number(e.target.value))}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-violet-700 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Spremi prozor
          </button>
        </form>

        {f26 ? (
          <form
            onSubmit={addClosure}
            className="space-y-2 rounded-xl border border-slate-200 bg-white p-4"
          >
            <h2 className="font-semibold text-slate-900">Zatvaranje (odmor / blokada)</h2>
            <p className="text-xs text-slate-500">
              Postojeće rezervacije se ne brišu i ne premještaju automatski — prikazuje se upozorenje.
            </p>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={closureDept}
              onChange={(e) => setClosureDept(e.target.value as Department | '')}
            >
              <option value="">Svi odjeli (globalno)</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {DEPARTMENT_LABEL_HR[d]}
                </option>
              ))}
            </select>
            <input
              required
              type="datetime-local"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={closureStart}
              onChange={(e) => setClosureStart(e.target.value)}
            />
            <input
              required
              type="datetime-local"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={closureEnd}
              onChange={(e) => setClosureEnd(e.target.value)}
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Razlog (samo admin)"
              value={closureReason}
              onChange={(e) => setClosureReason(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-rose-700 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Zatvori razdoblje
            </button>
          </form>
        ) : null}

        {f26 ? (
          <form
            onSubmit={addManual}
            className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2"
          >
            <h2 className="font-semibold text-slate-900">Ručna rezervacija (telefon / društvene mreže)</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <select
                required
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={manWindowId}
                onChange={(e) => setManWindowId(e.target.value)}
              >
                <option value="">— prozor —</option>
                {windows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {DEPARTMENT_LABEL_HR[w.department]} · {w.title}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={manSource}
                onChange={(e) => setManSource(e.target.value as BookingSource)}
              >
                {BOOKING_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {BOOKING_SOURCE_LABEL_HR[s]}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={manKind}
                onChange={(e) => setManKind(e.target.value as BookingKind)}
              >
                {BOOKING_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {BOOKING_KIND_LABEL_HR[k]}
                  </option>
                ))}
              </select>
              <input
                required
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ime klijenta"
                value={manName}
                onChange={(e) => setManName(e.target.value)}
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="E-mail"
                value={manEmail}
                onChange={(e) => setManEmail(e.target.value)}
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Telefon"
                value={manPhone}
                onChange={(e) => setManPhone(e.target.value)}
              />
              <input
                required
                type="datetime-local"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={manStart}
                onChange={(e) => setManStart(e.target.value)}
              />
              <input
                required
                type="datetime-local"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={manEnd}
                onChange={(e) => setManEnd(e.target.value)}
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                placeholder="Opis (opcionalno)"
                value={manDesc}
                onChange={(e) => setManDesc(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={busy || !manWindowId}
              className="rounded-lg bg-violet-700 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Spremi ručnu rezervaciju
            </button>
          </form>
        ) : null}
      </section>

      {rescheduleId ? (
        <form
          onSubmit={submitReschedule}
          className="mt-6 space-y-2 rounded-xl border border-violet-200 bg-violet-50 p-4"
        >
          <h2 className="font-semibold text-slate-900">Premještanje rezervacije</h2>
          <select
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={resWindowId}
            onChange={(e) => setResWindowId(e.target.value)}
          >
            <option value="">— prozor —</option>
            {windows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title}
              </option>
            ))}
          </select>
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
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Razlog (nakon dogovora s klijentom)"
            value={resReason}
            onChange={(e) => setResReason(e.target.value)}
          />
          {history.length > 0 ? (
            <ul className="text-xs text-slate-600">
              {history.map((h) => (
                <li key={h.id}>
                  {formatZagrebDateTime(h.previous_starts_at)} →{' '}
                  {formatZagrebDateTime(h.new_starts_at)}
                  {h.reason ? ` (${h.reason})` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-violet-700 px-4 py-2 text-sm text-white"
            >
              Spremi premještanje
            </button>
            <button
              type="button"
              className="rounded-lg border px-4 py-2 text-sm"
              onClick={() => setRescheduleId(null)}
            >
              Odustani
            </button>
          </div>
        </form>
      ) : null}

      <section className="mt-8">
        <h2 className="font-semibold text-slate-900">Prozori dostupnosti</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {windows.length === 0 ? (
            <li className="text-slate-500">Nema prozora.</li>
          ) : (
            windows.map((w) => (
              <li key={w.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="font-medium">
                  {DEPARTMENT_LABEL_HR[w.department]} · {w.title}
                </div>
                <div className="text-slate-600">
                  {formatZagrebDateTime(w.starts_at)} → {formatZagrebDateTime(w.ends_at)} · kap.{' '}
                  {w.capacity}
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
