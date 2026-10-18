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
  allocateDepartmentCapacity,
  buildMonthCells,
  cancelReservationWithReason,
  createAvailabilityClosure,
  createManualBooking,
  formatZagrebDateTime,
  isSmartBookingMigrationPending,
  listBookingCalendar,
  listDepartmentMonthCapacity,
  listRescheduleHistory,
  releaseDepartmentCapacity,
  reopenAvailabilityClosure,
  rescheduleReservation,
  setClosureRecurrence as persistClosureRecurrence,
  setConsultationOutcome,
  slotTouchesZagrebDate,
  updateBookingSharedSettings,
  updateDepartmentMonthlyCapacitySettings,
  zagrebYearMonth,
  type BookingCalendarBundle,
  type BookingKind,
  type BookingSource,
  type CapacityAllocation,
  type ClosureRecurrence,
  type ConsultationOutcome,
  type DepartmentMonthCapacity,
} from '../lib/smartBooking'
import { isCroatianPublicHoliday } from '../lib/croatianHolidays'
import {
  adminCalendarToneClass,
  classifyAdminCalendarDay,
} from '../lib/adminAvailabilityDay'
import { studioAnniversaryForYear } from '../lib/studioAnniversary'
import {
  listCommunicationTemplates,
  upsertCommunicationTemplate,
  COMMUNICATION_CHANNELS,
  COMMUNICATION_CHANNEL_LABEL_HR,
  type CommunicationChannel,
  type CommunicationTemplate,
} from '../lib/webAtelierCommunications'

type DeptFilter = Department | 'all'

function closureTouchesZagrebDate(
  c: BookingCalendarBundle['closures'][number],
  isoDate: string,
): boolean {
  if (c.recurrence === 'annual') {
    const start = new Date(c.starts_at)
    const end = new Date(c.ends_at)
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Zagreb',
      month: '2-digit',
      day: '2-digit',
    })
    const startMd = fmt.format(start)
    const endMd = fmt.format(new Date(end.getTime() - 1))
    const md = isoDate.slice(5)
    if (c.recurrence_end_date && isoDate > c.recurrence_end_date) return false
    if (startMd <= endMd) return md >= startMd && md <= endMd
    return md >= startMd || md <= endMd
  }
  return slotTouchesZagrebDate(c.starts_at, c.ends_at, isoDate)
}

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
  const [slotMinutes, setSlotMinutes] = useState(30)
  const [horizonDays, setHorizonDays] = useState(90)
  const [autoWeekly, setAutoWeekly] = useState(true)
  const [autoStart, setAutoStart] = useState('16:00')
  const [autoEnd, setAutoEnd] = useState('19:00')
  const [monthCapacity, setMonthCapacity] = useState<DepartmentMonthCapacity[]>([])
  const [capacityDetail, setCapacityDetail] = useState<
    (DepartmentMonthCapacity & { allocations: CapacityAllocation[] }) | null
  >(null)
  const [capTitle, setCapTitle] = useState('')
  const [capOverride, setCapOverride] = useState(false)
  const [capOverrideReason, setCapOverrideReason] = useState('')
  const [capMaxByDept, setCapMaxByDept] = useState<Record<Department, number>>({
    web_atelier: 3,
    interiors: 3,
    lrc: 3,
  })
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
  const [closureRecurrence, setClosureRecurrence] = useState<ClosureRecurrence>('none')

  const [manWindowId, setManWindowId] = useState('')
  const [manName, setManName] = useState('')
  const [manEmail, setManEmail] = useState('')
  const [manPhone, setManPhone] = useState('')
  const [manDesc, setManDesc] = useState('')
  const [manSource, setManSource] = useState<BookingSource>('phone')
  const [manKind, setManKind] = useState<BookingKind>('consultation')
  const [manStart, setManStart] = useState('')
  const [manEnd, setManEnd] = useState('')
  const [manMonthOverride, setManMonthOverride] = useState(false)
  const [manMonthOverrideReason, setManMonthOverrideReason] = useState('')

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
        setSlotMinutes(data.settings.default_slot_minutes ?? 30)
        setHorizonDays(data.settings.booking_horizon_days ?? 90)
        setAutoWeekly(data.settings.auto_weekly_enabled ?? true)
        setAutoStart((data.settings.auto_weekday_start_time ?? '16:00:00').slice(0, 5))
        setAutoEnd((data.settings.auto_weekday_end_time ?? '19:00:00').slice(0, 5))
        setMonthCapacity(data.month_capacity ?? [])
        if (data.month_capacity?.length) {
          setCapMaxByDept((prev) => {
            const next = { ...prev }
            for (const row of data.month_capacity ?? []) {
              next[row.department] = row.max_accepted_projects
            }
            return next
          })
        }
        if (departmentParam) {
          const monthIso = `${yearMonth.year}-${String(yearMonth.month).padStart(2, '0')}-01`
          try {
            setCapacityDetail(
              await listDepartmentMonthCapacity({ department: departmentParam, month: monthIso }),
            )
          } catch {
            setCapacityDetail(null)
          }
        } else {
          setCapacityDetail(null)
        }
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
        recurrence: closureRecurrence,
      })
      if (result.has_conflicts) {
        setWarning(
          result.warning ??
            `Zatvaranje spremljeno, ali postoji ${result.conflicting_reservations.length} potvrđenih rezervacija — nisu automatski pomaknute.`,
        )
      }
      setClosureReason('')
      setClosureRecurrence('none')
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
        monthCapacityOverride: manMonthOverride,
        monthCapacityOverrideReason: manMonthOverride ? manMonthOverrideReason : null,
      })
      setManName('')
      setManDesc('')
      setManMonthOverride(false)
      setManMonthOverrideReason('')
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
        defaultSlotMinutes: slotMinutes,
        bookingHorizonDays: horizonDays,
        autoWeeklyEnabled: autoWeekly,
        autoWeekdayStartTime: `${autoStart}:00`,
        autoWeekdayEndTime: `${autoEnd}:00`,
      })
      setSettingsCapacity(s.shared_consultation_capacity)
      setSlotMinutes(s.default_slot_minutes)
      setHorizonDays(s.booking_horizon_days ?? horizonDays)
      setAutoWeekly(s.auto_weekly_enabled ?? autoWeekly)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Postavke nisu spremljene.')
    } finally {
      setBusy(false)
    }
  }

  async function addCapacityAllocation(e: FormEvent) {
    e.preventDefault()
    if (!departmentParam) {
      setError('Odaberite odjel za registraciju mjesečnog kapaciteta.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const monthIso = `${yearMonth.year}-${String(yearMonth.month).padStart(2, '0')}-01`
      await allocateDepartmentCapacity({
        department: departmentParam,
        plannedStartMonth: monthIso,
        title: capTitle,
        isOverride: capOverride,
        overrideReason: capOverride ? capOverrideReason : null,
      })
      setCapTitle('')
      setCapOverride(false)
      setCapOverrideReason('')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Alokacija nije spremljena.')
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
    ? closures.filter((c) => closureTouchesZagrebDate(c, selectedDate))
    : []
  const anniversary = studioAnniversaryForYear(yearMonth.year)
  const monthIso = `${yearMonth.year}-${String(yearMonth.month).padStart(2, '0')}-01`
  const selectedDeptFull =
    departmentParam != null &&
    monthCapacity.some((m) => m.department === departmentParam && m.is_full)

  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4 sm:py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">Dostupnost</h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-600 sm:text-sm">
            Auto termini pon–pet 16–19 (Zagreb), blagdani HR, mjesečni projektni kapacitet (≠
            istovremene konzultacije). Upiti 24/7; rezervacije termina po pravilima.
          </p>
        </div>
        {anniversary ? (
          <p
            className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs text-sky-900"
            title={anniversary.labelEn}
          >
            {anniversary.labelHr} · 1.10.
          </p>
        ) : null}
      </header>
      {!f26 ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          F2.6 migracija još nije aktivna u bazi — prikazan je G–I legacy način. Kalendar zatvaranja
          i javne rezervacije čekaju SQL aktivaciju.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(['all', ...DEPARTMENTS] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDeptFilter(d)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium sm:text-sm ${
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
          className="mt-4 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="text-xs text-slate-600">
            Istovremene konzultacije (svi odjeli)
            <input
              type="number"
              min={1}
              max={50}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              value={settingsCapacity}
              onChange={(e) => setSettingsCapacity(Number(e.target.value))}
            />
          </label>
          <label className="text-xs text-slate-600">
            Trajanje termina (min)
            <input
              type="number"
              min={15}
              max={180}
              step={15}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(Number(e.target.value))}
            />
          </label>
          <label className="text-xs text-slate-600">
            Horizont (dani)
            <input
              type="number"
              min={14}
              max={366}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              value={horizonDays}
              onChange={(e) => setHorizonDays(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={autoWeekly}
              onChange={(e) => setAutoWeekly(e.target.checked)}
            />
            Auto pon–pet
          </label>
          <label className="text-xs text-slate-600">
            Početak (Zagreb)
            <input
              type="time"
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              value={autoStart}
              onChange={(e) => setAutoStart(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            Kraj (Zagreb)
            <input
              type="time"
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              value={autoEnd}
              onChange={(e) => setAutoEnd(e.target.value)}
            />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Spremi tjedne postavke
            </button>
          </div>
          <p className="text-[11px] text-slate-500 sm:col-span-2 lg:col-span-4">
            Istovremeni konzultacijski kapacitet ≠ mjesečni limit prihvaćenih projekata (default 3 /
            odjel).
          </p>
        </form>
      ) : null}

      {f26 && monthCapacity.length > 0 ? (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Mjesečni projektni kapacitet — {monthLabel}
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Web Atelier: automatski pri kreiranju projekta iz prihvaćene ponude. Interijeri / LRC:
            ručna registracija dolje (upiti i konzultacije se ne broje).
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-3">
            {monthCapacity.map((row) => (
              <li
                key={row.department}
                className={`rounded-md border px-2 py-1.5 text-xs ${
                  row.is_full
                    ? 'border-amber-300 bg-amber-50 text-amber-950'
                    : 'border-slate-100 bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-medium">{DEPARTMENT_LABEL_HR[row.department]}</div>
                <div>
                  {row.used}/{row.max_accepted_projects} prihvaćeno · ostalo {row.remaining}
                  {row.is_full ? ' · PUN (nove konzultacije za mjesec off)' : ''}
                </div>
                <label className="mt-1 flex items-center gap-1">
                  max
                  <input
                    type="number"
                    min={0}
                    max={50}
                    className="w-14 rounded border px-1 py-0.5"
                    value={capMaxByDept[row.department]}
                    onChange={(e) =>
                      setCapMaxByDept((prev) => ({
                        ...prev,
                        [row.department]: Number(e.target.value),
                      }))
                    }
                  />
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded border px-1.5 py-0.5"
                    onClick={() =>
                      void updateDepartmentMonthlyCapacitySettings({
                        department: row.department,
                        maxAcceptedProjects: capMaxByDept[row.department],
                      }).then(reload)
                    }
                  >
                    OK
                  </button>
                </label>
              </li>
            ))}
          </ul>
          {departmentParam ? (
            <form onSubmit={addCapacityAllocation} className="mt-3 grid gap-2 sm:grid-cols-4">
              <input
                required
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm sm:col-span-2"
                placeholder="Naslov prihvaćenog projekta (LRC/manual)"
                value={capTitle}
                onChange={(e) => setCapTitle(e.target.value)}
              />
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={capOverride}
                  onChange={(e) => setCapOverride(e.target.checked)}
                />
                Override (audit)
              </label>
              <input
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Razlog overridea"
                disabled={!capOverride}
                value={capOverrideReason}
                onChange={(e) => setCapOverrideReason(e.target.value)}
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50 sm:col-span-4 sm:w-fit"
              >
                Registriraj kapacitet ({monthIso})
              </button>
            </form>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              Odaberite odjel za ručnu registraciju prihvaćenog projekta.
            </p>
          )}
          {capacityDetail?.allocations?.length ? (
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {capacityDetail.allocations.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {a.title}
                    {a.is_override ? ' · override' : ''} · {a.source_kind}
                  </span>
                  <button
                    type="button"
                    className="rounded border px-1.5 py-0.5"
                    disabled={busy}
                    onClick={() =>
                      void releaseDepartmentCapacity(a.id, 'admin release').then(reload)
                    }
                  >
                    Oslobodi
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {selectedDeptFull ? (
            <p className="mt-2 text-xs text-amber-800" role="status">
              Odjel je pun za ovaj mjesec — postojeće rezervacije ostaju; nove konzultacije su
              blokirane (osim admin overridea).
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Kalendar — {monthLabel}</h2>
          <div className="flex gap-1.5">
            <button
              type="button"
              className="rounded-md border px-2.5 py-1 text-sm"
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
              className="rounded-md border px-2.5 py-1 text-sm"
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
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
          <li>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" /> Dostupno
            (auto / prozor)
          </li>
          <li>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-600" /> Rezervacija
          </li>
          <li>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" /> Zatvoreno /
            blagdan
          </li>
          <li>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" /> Mjesec pun
          </li>
          <li>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-500" /> Obljetnica
          </li>
          <li>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-orange-400" /> Godišnje
          </li>
          <li>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-400" /> Izvan
            horizonta / vikend
          </li>
        </ul>
        <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-xs sm:gap-1">
          {['Po', 'Ut', 'Sr', 'Če', 'Pe', 'Su', 'Ne'].map((d) => (
            <div key={d} className="py-1 font-medium text-slate-500">
              {d}
            </div>
          ))}
          {cells.map((cell) => {
            if (!cell.isoDate || cell.day == null) {
              return <div key={cell.key} className="min-h-[2.75rem] sm:min-h-[3.25rem]" />
            }
            const hasWin = windows.some((w) =>
              slotTouchesZagrebDate(w.starts_at, w.ends_at, cell.isoDate!),
            )
            const hasRes = reservations.some(
              (r) =>
                r.status !== 'cancelled' &&
                slotTouchesZagrebDate(r.starts_at, r.ends_at, cell.isoDate!),
            )
            const hasClose = closures.some((c) => closureTouchesZagrebDate(c, cell.isoDate!))
            const hasAnnual = closures.some(
              (c) => c.recurrence === 'annual' && closureTouchesZagrebDate(c, cell.isoDate!),
            )
            const isAnniv = cell.isoDate.endsWith('-10-01') && yearMonth.year >= 2025
            const monthFullHint =
              departmentParam != null &&
              monthCapacity.some((m) => m.department === departmentParam && m.is_full)
            const tone = classifyAdminCalendarDay({
              isoDate: cell.isoDate,
              hasLegacyWindow: hasWin,
              hasReservation: hasRes,
              hasClosure: hasClose,
              monthCapacityFull: monthFullHint,
              autoWeeklyEnabled: f26 && autoWeekly,
              bookingHorizonDays: horizonDays,
            })
            const selected = selectedDate === cell.isoDate
            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelectedDate(cell.isoDate)}
                className={`min-h-[2.75rem] rounded-md border p-1 text-left sm:min-h-[3.25rem] ${
                  selected ? 'border-violet-600 ring-1 ring-violet-400' : 'border-slate-100'
                } ${adminCalendarToneClass(tone)}`}
              >
                <div className="font-medium">{cell.day}</div>
                <div className="mt-0.5 flex flex-wrap gap-0.5">
                  {tone === 'available' ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  ) : null}
                  {hasRes ? <span className="h-1.5 w-1.5 rounded-full bg-violet-600" /> : null}
                  {tone === 'closed' ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  ) : null}
                  {hasAnnual ? <span className="h-1.5 w-1.5 rounded-full bg-orange-400" /> : null}
                  {isAnniv ? <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> : null}
                </div>
              </button>
            )
          })}
        </div>

        {selectedDate ? (
          <div className="mt-4 space-y-2 text-sm">
            <h3 className="font-medium text-slate-900">Dan {selectedDate}</h3>
            {selectedDate && isCroatianPublicHoliday(selectedDate) ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs">
                Hrvatski blagdan / neradni dan — nove rezervacije blokirane.
              </div>
            ) : null}
            {selectedDate?.endsWith('-10-01') && anniversary ? (
              <div className="rounded-md border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
                {anniversary.labelHr} (nije automatsko zatvaranje).
              </div>
            ) : null}
            {dayClosures.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2"
              >
                <div>
                  Zatvoreno ({c.department ? DEPARTMENT_LABEL_HR[c.department] : 'svi odjeli'})
                  {c.reason ? ` — ${c.reason}` : ''}
                  {c.recurrence === 'annual' ? ' · godišnje' : ' · jednokratno'}
                </div>
                <div className="flex flex-wrap gap-1">
                  {c.recurrence !== 'annual' ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() =>
                        void persistClosureRecurrence({
                          closureId: c.id,
                          recurrence: 'annual',
                        }).then(reload)
                      }
                    >
                      Omogući godišnje
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() =>
                        void persistClosureRecurrence({
                          closureId: c.id,
                          recurrence: 'none',
                        }).then(reload)
                      }
                    >
                      Samo jednokratno
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => void reopenAvailabilityClosure(c.id).then(reload)}
                  >
                    Ponovno otvori
                  </button>
                </div>
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
          <h2 className="text-sm font-semibold text-slate-900">Novi prozor dostupnosti</h2>
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
            <h2 className="text-sm font-semibold text-slate-900">Zatvaranje (odmor / blokada)</h2>
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
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={closureRecurrence === 'annual'}
                onChange={(e) => setClosureRecurrence(e.target.checked ? 'annual' : 'none')}
              />
              Ponavljaj godišnje (inače jednokratno — postojeća zatvaranja ostaju one-time)
            </label>
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
            <h2 className="text-sm font-semibold text-slate-900">
              Ručna rezervacija (telefon / društvene mreže)
            </h2>
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
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={manMonthOverride}
                  onChange={(e) => setManMonthOverride(e.target.checked)}
                />
                Override mjesečnog projektnog kapaciteta
              </label>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                placeholder="Razlog overridea (obavezno ako je uključeno)"
                disabled={!manMonthOverride}
                value={manMonthOverrideReason}
                onChange={(e) => setManMonthOverrideReason(e.target.value)}
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
        <h2 className="text-sm font-semibold text-slate-900">Prozori dostupnosti</h2>
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
