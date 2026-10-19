// F2.6 — shared consultation booking on top of G–I capacity tables.
// Public RPCs expose slots only (no PII / closure reasons).
// Frontend degrades gracefully when migrations are not yet applied.

import type { Department, ReservationStatus } from './departmentAvailability.ts'

export const BOOKING_SOURCES = [
  'web',
  'phone',
  'facebook',
  'instagram',
  'whatsapp',
  'personal',
  'admin',
  'other',
] as const

export const BOOKING_KINDS = ['consultation', 'production'] as const
export const CONSULTATION_OUTCOMES = [
  'info_sufficient',
  'clarification_needed',
  'consultation_completed',
] as const

export type BookingSource = (typeof BOOKING_SOURCES)[number]
export type BookingKind = (typeof BOOKING_KINDS)[number]
export type ConsultationOutcome = (typeof CONSULTATION_OUTCOMES)[number]

export const BOOKING_SOURCE_LABEL_HR: Record<BookingSource, string> = {
  web: 'Web',
  phone: 'Telefon',
  facebook: 'Facebook',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  personal: 'Osobno',
  admin: 'Admin',
  other: 'Ostalo',
}

export const BOOKING_KIND_LABEL_HR: Record<BookingKind, string> = {
  consultation: 'Konzultacija / početak suradnje',
  production: 'Produkcijski kapacitet',
}

export const CONSULTATION_OUTCOME_LABEL_HR: Record<ConsultationOutcome, string> = {
  info_sufficient: 'Informacije dovoljne (bez poziva)',
  clarification_needed: 'Potrebna dopuna',
  consultation_completed: 'Konzultacija održana',
}

export interface BookingSharedSettings {
  shared_consultation_capacity: number
  default_slot_minutes: number
  notes: string | null
  booking_horizon_days?: number
  auto_weekly_enabled?: boolean
  auto_weekday_start_time?: string
  auto_weekday_end_time?: string
  updated_at?: string
}

export type ClosureRecurrence = 'none' | 'annual'

export interface AvailabilityClosure {
  id: string
  department: Department | null
  starts_at: string
  ends_at: string
  reason: string | null
  is_active: boolean
  recurrence?: ClosureRecurrence
  recurrence_end_date?: string | null
  created_at: string
}

export interface DepartmentMonthCapacity {
  department: Department
  planned_start_month: string
  max_accepted_projects: number
  used: number
  remaining: number
  is_full: boolean
}

export interface CapacityAllocation {
  id: string
  department: Department
  planned_start_month: string
  source_kind: 'manual' | 'web_atelier_project' | 'interiors_project'
  source_id: string | null
  status: 'active' | 'released'
  title: string
  notes: string | null
  is_override: boolean
  override_reason: string | null
  created_at: string
}

export interface BookingReservation {
  id: string
  department: Department
  window_id: string
  starts_at: string
  ends_at: string
  status: ReservationStatus
  entity_kind: string
  entity_id: string | null
  title: string
  notes: string | null
  booking_kind: BookingKind
  source: BookingSource | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  description: string | null
  consultation_outcome: ConsultationOutcome | null
  cancel_reason: string | null
  cancelled_at: string | null
  slot_released_at: string | null
  created_at: string
}

export interface BookingCalendarBundle {
  windows: Array<{
    id: string
    department: Department
    title: string
    starts_at: string
    ends_at: string
    capacity: number
    notes: string | null
    created_at: string
  }>
  reservations: BookingReservation[]
  closures: AvailabilityClosure[]
  settings: BookingSharedSettings
  month_capacity?: DepartmentMonthCapacity[]
}

export interface PublicConsultationSlot {
  window_id: string
  department: Department
  starts_at: string
  ends_at: string
  remaining: number
  source?: 'manual_window' | 'auto_weekly'
}

export interface PublicAvailabilityResponse {
  department: Department
  slots: PublicConsultationSlot[]
  timezone: string
  notice_hr: string
  notice_en: string
}

export interface PublicBookResult {
  reservation_id: string
  department: Department
  starts_at: string
  ends_at: string
  replay: boolean
  notice_hr?: string
  notice_en?: string
}

export class SmartBookingUnavailableError extends Error {
  constructor(message = 'Rezervacije trenutno nisu dostupne (migracija F2.6 nije aktivna).') {
    super(message)
    this.name = 'SmartBookingUnavailableError'
  }
}

function isMissingRpcError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    msg.includes('could not find the function') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  )
}

async function requireClient() {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase nije konfiguriran.')
  return supabase
}

export function isSmartBookingMigrationPending(error: unknown): boolean {
  if (error instanceof SmartBookingUnavailableError) return true
  if (error && typeof error === 'object' && 'message' in error) {
    return isMissingRpcError(error as { message?: string; code?: string })
  }
  return false
}

export async function listBookingCalendar(filter?: {
  department?: Department | null
  from?: string | null
  to?: string | null
}): Promise<BookingCalendarBundle> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_list_booking_calendar', {
    p_department: filter?.department ?? null,
    p_from: filter?.from ?? null,
    p_to: filter?.to ?? null,
  })
  if (error) {
    if (isMissingRpcError(error)) throw new SmartBookingUnavailableError()
    throw new Error(error.message)
  }
  const bundle = (data ?? {}) as BookingCalendarBundle
  return {
    windows: bundle.windows ?? [],
    reservations: bundle.reservations ?? [],
    closures: bundle.closures ?? [],
    settings: bundle.settings ?? {
      shared_consultation_capacity: 1,
      default_slot_minutes: 30,
      notes: null,
      booking_horizon_days: 90,
      auto_weekly_enabled: true,
      auto_weekday_start_time: '16:00:00',
      auto_weekday_end_time: '19:00:00',
    },
    month_capacity: bundle.month_capacity ?? [],
  }
}

export async function updateBookingSharedSettings(input: {
  sharedConsultationCapacity?: number
  defaultSlotMinutes?: number
  notes?: string | null
  bookingHorizonDays?: number
  autoWeeklyEnabled?: boolean
  autoWeekdayStartTime?: string | null
  autoWeekdayEndTime?: string | null
}): Promise<BookingSharedSettings> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_update_booking_shared_settings', {
    p_shared_consultation_capacity: input.sharedConsultationCapacity ?? null,
    p_default_slot_minutes: input.defaultSlotMinutes ?? null,
    p_notes: input.notes ?? null,
    p_booking_horizon_days: input.bookingHorizonDays ?? null,
    p_auto_weekly_enabled: input.autoWeeklyEnabled ?? null,
    p_auto_weekday_start_time: input.autoWeekdayStartTime ?? null,
    p_auto_weekday_end_time: input.autoWeekdayEndTime ?? null,
  })
  if (error) {
    if (isMissingRpcError(error)) throw new SmartBookingUnavailableError()
    throw new Error(error.message)
  }
  return data as BookingSharedSettings
}

export async function createAvailabilityClosure(input: {
  startsAt: string
  endsAt: string
  department?: Department | null
  reason?: string | null
  recurrence?: ClosureRecurrence
  recurrenceEndDate?: string | null
}): Promise<{
  closure_id: string
  conflicting_reservations: Array<{ id: string; title: string; starts_at: string }>
  has_conflicts: boolean
  warning: string | null
}> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_create_availability_closure', {
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_department: input.department ?? null,
    p_reason: input.reason ?? null,
    p_recurrence: input.recurrence ?? 'none',
    p_recurrence_end_date: input.recurrenceEndDate ?? null,
  })
  if (error) {
    if (isMissingRpcError(error)) throw new SmartBookingUnavailableError()
    throw new Error(error.message)
  }
  return data as {
    closure_id: string
    conflicting_reservations: Array<{ id: string; title: string; starts_at: string }>
    has_conflicts: boolean
    warning: string | null
  }
}

export async function setClosureRecurrence(input: {
  closureId: string
  recurrence: ClosureRecurrence
  recurrenceEndDate?: string | null
}): Promise<void> {
  const client = await requireClient()
  const { error } = await client.rpc('admin_set_closure_recurrence', {
    p_closure_id: input.closureId,
    p_recurrence: input.recurrence,
    p_recurrence_end_date: input.recurrenceEndDate ?? null,
  })
  if (error) {
    if (isMissingRpcError(error)) throw new SmartBookingUnavailableError()
    throw new Error(error.message)
  }
}

export async function listDepartmentMonthCapacity(input: {
  department: Department
  month: string
}): Promise<DepartmentMonthCapacity & { allocations: CapacityAllocation[] }> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_list_department_month_capacity', {
    p_department: input.department,
    p_month: input.month,
  })
  if (error) {
    if (isMissingRpcError(error)) throw new SmartBookingUnavailableError()
    throw new Error(error.message)
  }
  return data as DepartmentMonthCapacity & { allocations: CapacityAllocation[] }
}

export async function updateDepartmentMonthlyCapacitySettings(input: {
  department: Department
  maxAcceptedProjects: number
}): Promise<DepartmentMonthCapacity & { allocations?: CapacityAllocation[] }> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_update_department_monthly_capacity_settings', {
    p_department: input.department,
    p_max_accepted_projects: input.maxAcceptedProjects,
  })
  if (error) {
    if (isMissingRpcError(error)) throw new SmartBookingUnavailableError()
    throw new Error(error.message)
  }
  return data as DepartmentMonthCapacity & { allocations?: CapacityAllocation[] }
}

export async function allocateDepartmentCapacity(input: {
  department: Department
  plannedStartMonth: string
  title: string
  sourceKind?: CapacityAllocation['source_kind']
  sourceId?: string | null
  notes?: string | null
  isOverride?: boolean
  overrideReason?: string | null
}): Promise<{ allocation_id: string; is_override: boolean }> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_allocate_department_capacity', {
    p_department: input.department,
    p_planned_start_month: input.plannedStartMonth,
    p_title: input.title,
    p_source_kind: input.sourceKind ?? 'manual',
    p_source_id: input.sourceId ?? null,
    p_notes: input.notes ?? null,
    p_is_override: input.isOverride ?? false,
    p_override_reason: input.overrideReason ?? null,
  })
  if (error) {
    if (isMissingRpcError(error)) throw new SmartBookingUnavailableError()
    throw new Error(error.message)
  }
  return data as { allocation_id: string; is_override: boolean }
}

export async function releaseDepartmentCapacity(
  allocationId: string,
  reason?: string | null,
): Promise<void> {
  const client = await requireClient()
  const { error } = await client.rpc('admin_release_department_capacity', {
    p_allocation_id: allocationId,
    p_reason: reason ?? null,
  })
  if (error) {
    if (isMissingRpcError(error)) throw new SmartBookingUnavailableError()
    throw new Error(error.message)
  }
}

export async function reopenAvailabilityClosure(closureId: string): Promise<void> {
  const client = await requireClient()
  const { error } = await client.rpc('admin_reopen_availability_closure', {
    p_closure_id: closureId,
  })
  if (error) {
    if (isMissingRpcError(error)) throw new SmartBookingUnavailableError()
    throw new Error(error.message)
  }
}

export async function createManualBooking(input: {
  windowId: string
  startsAt: string
  endsAt: string
  contactName: string
  contactEmail?: string | null
  contactPhone?: string | null
  description?: string | null
  source?: BookingSource
  bookingKind?: BookingKind
  status?: ReservationStatus
  notes?: string | null
  monthCapacityOverride?: boolean
  monthCapacityOverrideReason?: string | null
}): Promise<string> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_create_manual_booking', {
    p_window_id: input.windowId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_contact_name: input.contactName,
    p_contact_email: input.contactEmail ?? null,
    p_contact_phone: input.contactPhone ?? null,
    p_description: input.description ?? null,
    p_source: input.source ?? 'admin',
    p_booking_kind: input.bookingKind ?? 'consultation',
    p_status: input.status ?? 'confirmed',
    p_notes: input.notes ?? null,
    p_entity_kind: 'booking_lead',
    p_entity_id: null,
    p_month_capacity_override: input.monthCapacityOverride ?? false,
    p_month_capacity_override_reason: input.monthCapacityOverrideReason ?? null,
  })
  if (error) {
    if (isMissingRpcError(error)) throw new SmartBookingUnavailableError()
    throw new Error(error.message)
  }
  return data as string
}

export async function rescheduleReservation(input: {
  reservationId: string
  windowId: string
  startsAt: string
  endsAt: string
  reason?: string | null
}): Promise<void> {
  const client = await requireClient()
  const { error } = await client.rpc('admin_reschedule_reservation', {
    p_reservation_id: input.reservationId,
    p_window_id: input.windowId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_reason: input.reason ?? null,
  })
  if (error) {
    if (isMissingRpcError(error)) throw new SmartBookingUnavailableError()
    throw new Error(error.message)
  }
}

export async function cancelReservationWithReason(
  reservationId: string,
  reason: string,
): Promise<void> {
  const client = await requireClient()
  const { error } = await client.rpc('admin_cancel_reservation_with_reason', {
    p_reservation_id: reservationId,
    p_reason: reason,
  })
  if (error) {
    if (isMissingRpcError(error)) throw new SmartBookingUnavailableError()
    throw new Error(error.message)
  }
}

export async function setConsultationOutcome(input: {
  reservationId: string
  outcome: ConsultationOutcome | null
  releaseSlot?: boolean
}): Promise<void> {
  const client = await requireClient()
  const { error } = await client.rpc('admin_set_consultation_outcome', {
    p_reservation_id: input.reservationId,
    p_outcome: input.outcome,
    p_release_slot: input.releaseSlot ?? false,
  })
  if (error) {
    if (isMissingRpcError(error)) throw new SmartBookingUnavailableError()
    throw new Error(error.message)
  }
}

export async function listRescheduleHistory(reservationId: string): Promise<
  Array<{
    id: string
    previous_starts_at: string
    previous_ends_at: string
    new_starts_at: string
    new_ends_at: string
    reason: string | null
    created_at: string
  }>
> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_list_reservation_reschedule_history', {
    p_reservation_id: reservationId,
  })
  if (error) {
    if (isMissingRpcError(error)) throw new SmartBookingUnavailableError()
    throw new Error(error.message)
  }
  return (data ?? []) as Array<{
    id: string
    previous_starts_at: string
    previous_ends_at: string
    new_starts_at: string
    new_ends_at: string
    reason: string | null
    created_at: string
  }>
}

export async function listPublicConsultationAvailability(input: {
  department: Department
  from: string
  to: string
}): Promise<PublicAvailabilityResponse> {
  const client = await requireClient()
  const { data, error } = await client.rpc('public_list_consultation_availability', {
    p_department: input.department,
    p_from: input.from,
    p_to: input.to,
  })
  if (error) {
    if (isMissingRpcError(error)) throw new SmartBookingUnavailableError()
    throw new Error(error.message)
  }
  const payload = (data ?? {}) as PublicAvailabilityResponse
  return {
    department: payload.department ?? input.department,
    slots: payload.slots ?? [],
    timezone: payload.timezone ?? 'Europe/Zagreb',
    notice_hr:
      payload.notice_hr ??
      'Rezervirajte termin za početak suradnje. Ako ste dovoljno detaljno opisali projekt, dogovor možemo dovršiti bez dodatnog razgovora.',
    notice_en:
      payload.notice_en ??
      'Book a slot to start cooperation. If your project details are sufficient, we can finalize without an extra call.',
  }
}

export type BookingClientErrorCode =
  | 'captcha_failed'
  | 'rate_limited'
  | 'invalid_payload'
  | 'unavailable'
  | 'slot_unavailable'

export class BookingClientError extends Error {
  readonly code: BookingClientErrorCode
  readonly language: 'hr' | 'en'

  constructor(code: BookingClientErrorCode, language: 'hr' | 'en' = 'hr') {
    super(bookingErrorMessage(code, language))
    this.name = 'BookingClientError'
    this.code = code
    this.language = language
  }
}

export function bookingErrorMessage(code: BookingClientErrorCode, language: 'hr' | 'en'): string {
  const hr: Record<BookingClientErrorCode, string> = {
    captcha_failed: 'Provjera sigurnosti nije uspjela. Osvježite stranicu i pokušajte ponovno.',
    rate_limited: 'Previše pokušaja. Pričekajte malo pa pokušajte ponovno.',
    invalid_payload: 'Provjerite unesene podatke i pokušajte ponovno.',
    unavailable: 'Rezervacije trenutno nisu dostupne. Pokušajte kasnije.',
    slot_unavailable:
      'Odabrani termin više nije dostupan. Osvježite kalendar i odaberite drugi termin.',
  }
  const en: Record<BookingClientErrorCode, string> = {
    captcha_failed: 'Security check failed. Refresh the page and try again.',
    rate_limited: 'Too many attempts. Please wait a moment and try again.',
    invalid_payload: 'Please check your details and try again.',
    unavailable: 'Booking is temporarily unavailable. Please try again later.',
    slot_unavailable: 'That slot is no longer available. Refresh and pick another time.',
  }
  return language === 'en' ? en[code] : hr[code]
}

/**
 * Public booking via Edge Function only (server-side Turnstile).
 * Direct anon RPC to public_book_consultation_slot is revoked after hardening migration.
 */
export async function bookConsultationSlot(input: {
  department: Department
  windowId: string
  contactName: string
  contactEmail: string
  contactPhone: string
  description: string
  idempotencyKey: string
  turnstileToken: string
  language?: 'hr' | 'en'
  entityKind?: string
  entityId?: string | null
}): Promise<PublicBookResult> {
  const language = input.language ?? 'hr'
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!supabaseUrl || !anonKey) {
    throw new SmartBookingUnavailableError()
  }
  if (!input.turnstileToken.trim()) {
    throw new BookingClientError('captcha_failed', language)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/functions/v1/book-consultation-slot`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          department: input.department,
          windowId: input.windowId,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          description: input.description,
          idempotencyKey: input.idempotencyKey,
          turnstileToken: input.turnstileToken,
          language,
          entityKind: input.entityKind ?? 'booking_lead',
          entityId: input.entityId ?? null,
        }),
        signal: controller.signal,
      },
    )

    let payload: Record<string, unknown> = {}
    try {
      payload = (await response.json()) as Record<string, unknown>
    } catch {
      payload = {}
    }

    if (response.ok) {
      if (
        typeof payload.reservationId === 'string' &&
        typeof payload.startsAt === 'string' &&
        typeof payload.endsAt === 'string'
      ) {
        return {
          reservation_id: payload.reservationId,
          department: (payload.department as Department) ?? input.department,
          starts_at: payload.startsAt,
          ends_at: payload.endsAt,
          replay: payload.replay === true,
          notice_hr: typeof payload.noticeHr === 'string' ? payload.noticeHr : undefined,
          notice_en: typeof payload.noticeEn === 'string' ? payload.noticeEn : undefined,
        }
      }
      throw new BookingClientError('unavailable', language)
    }

    const code = payload.error
    if (
      code === 'captcha_failed' ||
      code === 'rate_limited' ||
      code === 'invalid_payload' ||
      code === 'unavailable' ||
      code === 'slot_unavailable'
    ) {
      throw new BookingClientError(code, language)
    }
    if (response.status === 404 || response.status === 503) {
      throw new SmartBookingUnavailableError(
        language === 'en'
          ? 'Booking is not activated yet. Please try again later.'
          : 'Rezervacije još nisu aktivirane. Pokušajte kasnije.',
      )
    }
    throw new BookingClientError('unavailable', language)
  } catch (caught) {
    if (caught instanceof BookingClientError || caught instanceof SmartBookingUnavailableError) {
      throw caught
    }
    throw new BookingClientError('unavailable', language)
  } finally {
    clearTimeout(timer)
  }
}

/** Zagreb calendar helpers for month grids (Europe/Zagreb). */
export function formatZagrebDateTime(iso: string, locale: 'hr' | 'en' = 'hr'): string {
  return new Intl.DateTimeFormat(locale === 'hr' ? 'hr-HR' : 'en-GB', {
    timeZone: 'Europe/Zagreb',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function zagrebYearMonth(reference: Date = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zagreb',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(reference)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  return { year, month }
}

export function buildMonthCells(year: number, month: number): Array<{
  key: string
  day: number | null
  isoDate: string | null
}> {
  // month is 1–12. Build grid Mon–Sun using UTC noon anchors to avoid DST edge flips.
  const first = new Date(Date.UTC(year, month - 1, 1, 12))
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12)).getUTCDate()
  const weekday = first.getUTCDay() // 0 Sun
  const mondayOffset = (weekday + 6) % 7
  const cells: Array<{ key: string; day: number | null; isoDate: string | null }> = []
  for (let i = 0; i < mondayOffset; i += 1) {
    cells.push({ key: `pad-${i}`, day: null, isoDate: null })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ key: isoDate, day, isoDate })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `tail-${cells.length}`, day: null, isoDate: null })
  }
  return cells
}

export function slotTouchesZagrebDate(slotStartIso: string, slotEndIso: string, isoDate: string): boolean {
  // Compare calendar dates in Zagreb for the slot interval vs YYYY-MM-DD.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zagreb',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const start = fmt.format(new Date(slotStartIso))
  const endExclusive = new Date(slotEndIso)
  // Use last instant inside the interval for end calendar day.
  const end = fmt.format(new Date(endExclusive.getTime() - 1))
  return isoDate >= start && isoDate <= end
}
