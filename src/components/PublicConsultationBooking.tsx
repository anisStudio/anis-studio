import { useEffect, useId, useState, type FormEvent } from 'react'
import type { Department } from '../lib/departmentAvailability'
import {
  bookConsultationSlot,
  buildMonthCells,
  formatZagrebDateTime,
  isSmartBookingMigrationPending,
  listPublicConsultationAvailability,
  slotTouchesZagrebDate,
  zagrebYearMonth,
  type PublicConsultationSlot,
} from '../lib/smartBooking'
import { TurnstileWidget } from './TurnstileWidget'

interface PublicConsultationBookingProps {
  department: Department
  language: 'hr' | 'en'
  /** Optional inquiry id to link when entity kind supports it. */
  linkedEntityKind?: string
  linkedEntityId?: string | null
  /** Pre-fill contact fields from a sibling form when available. */
  preset?: {
    contactName?: string
    contactEmail?: string
    contactPhone?: string
    description?: string
  }
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `xxxxxxxx-xxxx-4xxx-yxxx-${Date.now().toString(16)}`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function PublicConsultationBooking({
  department,
  language,
  linkedEntityKind,
  linkedEntityId,
  preset,
}: PublicConsultationBookingProps) {
  const formId = useId()
  const [yearMonth, setYearMonth] = useState(() => zagrebYearMonth())
  const [slots, setSlots] = useState<PublicConsultationSlot[]>([])
  const [notice, setNotice] = useState('')
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [contactName, setContactName] = useState(preset?.contactName ?? '')
  const [contactEmail, setContactEmail] = useState(preset?.contactEmail ?? '')
  const [contactPhone, setContactPhone] = useState(preset?.contactPhone ?? '')
  const [description, setDescription] = useState(preset?.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [idempotencyKey] = useState(() => newIdempotencyKey())
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileReset, setTurnstileReset] = useState(0)
  const turnstileSiteKey =
    (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? ''

  const copy = {
    title: {
      hr: 'Rezervacija termina za početak suradnje',
      en: 'Book a start-of-cooperation slot',
    },
    intro: {
      hr: 'Rezervirajte termin za početak suradnje. Ako ste dovoljno detaljno opisali projekt, dogovor možemo dovršiti bez dodatnog razgovora.',
      en: 'Book a slot to start cooperation. If your project details are sufficient, we can finalize without an extra call.',
    },
    disclaimer: {
      hr: 'Rezervacija nije prihvat ponude, faktura ni jamstvo završetka projekta. Telefonski razgovor nije obavezan ako su detalji dovoljni.',
      en: 'A booking is not offer acceptance, an invoice, or a project completion guarantee. A phone call is not mandatory when details are sufficient.',
    },
    pickDate: { hr: 'Odaberite dostupni dan', en: 'Pick an available day' },
    pickSlot: { hr: 'Dostupni termini', en: 'Available slots' },
    noSlots: { hr: 'Nema slobodnih termina u ovom mjesecu.', en: 'No open slots this month.' },
    name: { hr: 'Ime i prezime', en: 'Full name' },
    email: { hr: 'E-mail', en: 'Email' },
    phone: { hr: 'Telefon', en: 'Phone' },
    description: {
      hr: 'Kratki opis potrebe / projekta',
      en: 'Short description of your need / project',
    },
    submit: { hr: 'Rezerviraj termin', en: 'Book slot' },
    prev: { hr: 'Prethodni mjesec', en: 'Previous month' },
    next: { hr: 'Sljedeći mjesec', en: 'Next month' },
    pending: {
      hr: 'Kalendar rezervacija bit će dostupan nakon aktivacije sustava.',
      en: 'The booking calendar will be available after system activation.',
    },
    captcha: {
      hr: 'Potvrdite da niste robot.',
      en: 'Please confirm you are not a robot.',
    },
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        setError(null)
        const from = new Date(Date.UTC(yearMonth.year, yearMonth.month - 1, 1, 0, 0, 0))
        const to = new Date(Date.UTC(yearMonth.year, yearMonth.month, 1, 0, 0, 0))
        const data = await listPublicConsultationAvailability({
          department,
          from: from.toISOString(),
          to: to.toISOString(),
        })
        if (cancelled) return
        setSlots(data.slots)
        setNotice(language === 'hr' ? data.notice_hr : data.notice_en)
        setUnavailable(false)
      } catch (caught) {
        if (cancelled) return
        if (isSmartBookingMigrationPending(caught)) {
          setUnavailable(true)
          setSlots([])
          return
        }
        setError(caught instanceof Error ? caught.message : 'Kalendar nije učitan.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [department, yearMonth.year, yearMonth.month, language])

  const cells = buildMonthCells(yearMonth.year, yearMonth.month)
  const availableDates = new Set(
    cells
      .filter((c) => c.isoDate)
      .filter((c) => slots.some((s) => slotTouchesZagrebDate(s.starts_at, s.ends_at, c.isoDate!)))
      .map((c) => c.isoDate!),
  )

  const daySlots = selectedDate
    ? slots.filter((s) => slotTouchesZagrebDate(s.starts_at, s.ends_at, selectedDate))
    : []

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selectedWindowId) {
      setError(language === 'hr' ? 'Odaberite termin.' : 'Please select a slot.')
      return
    }
    if (!turnstileSiteKey) {
      setError(
        language === 'hr'
          ? 'Rezervacije nisu konfigurirane (nedostaje Turnstile).'
          : 'Booking is not configured (missing Turnstile).',
      )
      return
    }
    if (!turnstileToken) {
      setError(copy.captcha[language])
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await bookConsultationSlot({
        department,
        windowId: selectedWindowId,
        contactName,
        contactEmail,
        contactPhone,
        description,
        idempotencyKey,
        turnstileToken,
        language,
        entityKind: linkedEntityKind,
        entityId: linkedEntityId,
      })
      setSuccess(
        language === 'hr'
          ? `${result.notice_hr ?? 'Termin je rezerviran.'} ${formatZagrebDateTime(result.starts_at, 'hr')}`
          : `${result.notice_en ?? 'Slot booked.'} ${formatZagrebDateTime(result.starts_at, 'en')}`,
      )
      setTurnstileToken('')
      setTurnstileReset((n) => n + 1)
      // Refresh slots
      const from = new Date(Date.UTC(yearMonth.year, yearMonth.month - 1, 1))
      const to = new Date(Date.UTC(yearMonth.year, yearMonth.month, 1))
      const data = await listPublicConsultationAvailability({
        department,
        from: from.toISOString(),
        to: to.toISOString(),
      })
      setSlots(data.slots)
      setSelectedWindowId(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Rezervacija nije uspjela.')
      setTurnstileToken('')
      setTurnstileReset((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  if (unavailable) {
    return (
      <section className="mt-8 rounded-2xl border border-slate-200/80 bg-white/70 p-5 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-pearl/70">
        <h2 className="font-heading text-lg font-semibold text-plum dark:text-pearl">
          {copy.title[language]}
        </h2>
        <p className="mt-2">{copy.pending[language]}</p>
      </section>
    )
  }

  const monthLabel = new Intl.DateTimeFormat(language === 'hr' ? 'hr-HR' : 'en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Zagreb',
  }).format(new Date(Date.UTC(yearMonth.year, yearMonth.month - 1, 15, 12)))

  return (
    <section
      className="mt-8 rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6"
      aria-labelledby={`${formId}-title`}
    >
      <h2
        id={`${formId}-title`}
        className="font-heading text-lg font-semibold text-plum dark:text-pearl sm:text-xl"
      >
        {copy.title[language]}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-plum/80 dark:text-pearl/75">
        {notice || copy.intro[language]}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-pearl/55">
        {copy.disclaimer[language]}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-white/15"
          onClick={() =>
            setYearMonth((ym) =>
              ym.month === 1
                ? { year: ym.year - 1, month: 12 }
                : { year: ym.year, month: ym.month - 1 },
            )
          }
        >
          {copy.prev[language]}
        </button>
        <div className="text-sm font-medium capitalize text-plum dark:text-pearl">{monthLabel}</div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-white/15"
          onClick={() =>
            setYearMonth((ym) =>
              ym.month === 12
                ? { year: ym.year + 1, month: 1 }
                : { year: ym.year, month: ym.month + 1 },
            )
          }
        >
          {copy.next[language]}
        </button>
      </div>

      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
        {copy.pickDate[language]}
      </p>
      <div
        className="mt-2 grid grid-cols-7 gap-1 text-center text-xs"
        role="grid"
        aria-label={copy.pickDate[language]}
      >
        {(language === 'hr'
          ? ['Po', 'Ut', 'Sr', 'Če', 'Pe', 'Su', 'Ne']
          : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
        ).map((d) => (
          <div key={d} className="py-1 font-medium text-slate-500">
            {d}
          </div>
        ))}
        {cells.map((cell) => {
          if (!cell.isoDate || cell.day == null) {
            return <div key={cell.key} className="aspect-square" />
          }
          const open = availableDates.has(cell.isoDate)
          const selected = selectedDate === cell.isoDate
          return (
            <button
              key={cell.key}
              type="button"
              disabled={!open}
              aria-pressed={selected}
              onClick={() => {
                setSelectedDate(cell.isoDate)
                setSelectedWindowId(null)
              }}
              className={`aspect-square rounded-lg text-sm ${
                selected
                  ? 'bg-violet-700 text-white'
                  : open
                    ? 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-100'
                    : 'cursor-not-allowed bg-slate-50 text-slate-300 dark:bg-white/5 dark:text-pearl/25'
              }`}
            >
              {cell.day}
            </button>
          )
        })}
      </div>

      {selectedDate ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {copy.pickSlot[language]}
          </p>
          {daySlots.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{copy.noSlots[language]}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {daySlots.map((slot) => (
                <li key={slot.window_id}>
                  <button
                    type="button"
                    aria-pressed={selectedWindowId === slot.window_id}
                    onClick={() => setSelectedWindowId(slot.window_id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                      selectedWindowId === slot.window_id
                        ? 'border-violet-600 bg-violet-50 dark:bg-violet-950/40'
                        : 'border-slate-200 hover:border-violet-300 dark:border-white/15'
                    }`}
                  >
                    {formatZagrebDateTime(slot.starts_at, language)} →{' '}
                    {formatZagrebDateTime(slot.ends_at, language)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-600 dark:text-pearl/65 sm:col-span-2">
          {copy.name[language]}
          <input
            required
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-white/20 dark:bg-black/20"
          />
        </label>
        <label className="block text-xs text-slate-600 dark:text-pearl/65">
          {copy.email[language]}
          <input
            required
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-white/20 dark:bg-black/20"
          />
        </label>
        <label className="block text-xs text-slate-600 dark:text-pearl/65">
          {copy.phone[language]}
          <input
            required
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-white/20 dark:bg-black/20"
          />
        </label>
        <label className="block text-xs text-slate-600 dark:text-pearl/65 sm:col-span-2">
          {copy.description[language]}
          <textarea
            required
            minLength={10}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-white/20 dark:bg-black/20"
          />
        </label>
        {turnstileSiteKey ? (
          <div className="sm:col-span-2">
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              resetSignal={turnstileReset}
              onToken={setTurnstileToken}
            />
          </div>
        ) : null}
        {error ? (
          <p className="sm:col-span-2 text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="sm:col-span-2 text-sm text-emerald-700" role="status">
            {success}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || !selectedWindowId}
          className="sm:col-span-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {copy.submit[language]}
        </button>
      </form>
    </section>
  )
}

export default PublicConsultationBooking
