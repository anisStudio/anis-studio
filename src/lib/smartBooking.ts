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
  updated_at?: string
}

export interface AvailabilityClosure {
  id: string
  department: Department | null
  starts_at: string
  ends_at: string
  reason: string | null
  is_active: boolean
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
}

export interface PublicConsultationSlot {
  window_id: string
  department: Department
  starts_at: string
  ends_at: string
  remaining: number
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
      default_slot_minutes: 60,
      notes: null,
    },
  }
}

export async function updateBookingSharedSettings(input: {
  sharedConsultationCapacity?: number
  defaultSlotMinutes?: number
  notes?: string | null
}): Promise<BookingSharedSettings> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_update_booking_shared_settings', {
    p_shared_consultation_capacity: input.sharedConsultationCapacity ?? null,
    p_default_slot_minutes: input.defaultSlotMinutes ?? null,
    p_notes: input.notes ?? null,
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

export async function bookConsultationSlot(input: {
  department: Department
  windowId: string
  contactName: string
  contactEmail: string
  contactPhone: string
  description: string
  idempotencyKey: string
  clientFingerprint?: string | null
  entityKind?: string
  entityId?: string | null
}): Promise<PublicBookResult> {
  const client = await requireClient()
  const { data, error } = await client.rpc('public_book_consultation_slot', {
    p_department: input.department,
    p_window_id: input.windowId,
    p_contact_name: input.contactName,
    p_contact_email: input.contactEmail,
    p_contact_phone: input.contactPhone,
    p_description: input.description,
    p_idempotency_key: input.idempotencyKey,
    p_client_fingerprint: input.clientFingerprint ?? null,
    p_entity_kind: input.entityKind ?? 'booking_lead',
    p_entity_id: input.entityId ?? null,
  })
  if (error) {
    if (isMissingRpcError(error)) throw new SmartBookingUnavailableError()
    const msg = error.message ?? ''
    if (/booking_slot_unavailable|capacity_exceeded|stale|closed/i.test(msg)) {
      throw new Error(
        'Odabrani termin više nije dostupan. Osvježite kalendar i odaberite drugi termin.',
      )
    }
    if (/rate_limited/i.test(msg)) {
      throw new Error('Previše pokušaja. Pričekajte malo pa pokušajte ponovno.')
    }
    throw new Error(msg)
  }
  return data as PublicBookResult
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
