// F2.4 I — shared department availability windows + reservations (V1).
// Offer acceptance never auto-reserves capacity.

export const DEPARTMENTS = ['web_atelier', 'interiors', 'lrc'] as const
export const RESERVATION_STATUSES = ['draft', 'confirmed', 'cancelled'] as const
export const RESERVATION_ENTITY_KINDS = [
  'web_atelier_project',
  'interiors_project',
  'lrc_inquiry',
  'unlinked',
] as const

export type Department = (typeof DEPARTMENTS)[number]
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]
export type ReservationEntityKind = (typeof RESERVATION_ENTITY_KINDS)[number]

export const DEPARTMENT_LABEL_HR: Record<Department, string> = {
  web_atelier: 'Web Atelier',
  interiors: 'Interijeri',
  lrc: 'LRC',
}

export const RESERVATION_STATUS_LABEL_HR: Record<ReservationStatus, string> = {
  draft: 'Nacrt',
  confirmed: 'Potvrđeno',
  cancelled: 'Otkazano',
}

export interface AvailabilityWindow {
  id: string
  department: Department
  title: string
  starts_at: string
  ends_at: string
  capacity: number
  notes: string | null
  created_at: string
}

export interface DepartmentReservation {
  id: string
  department: Department
  window_id: string
  starts_at: string
  ends_at: string
  status: ReservationStatus
  entity_kind: ReservationEntityKind
  entity_id: string | null
  title: string
  notes: string | null
  created_at: string
}

export interface AvailabilityBundle {
  windows: AvailabilityWindow[]
  reservations: DepartmentReservation[]
}

async function requireClient() {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase nije konfiguriran.')
  return supabase
}

export async function listDepartmentAvailability(filter?: {
  department?: Department | null
  from?: string | null
  to?: string | null
}): Promise<AvailabilityBundle> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_list_department_availability', {
    p_department: filter?.department ?? null,
    p_from: filter?.from ?? null,
    p_to: filter?.to ?? null,
  })
  if (error) throw new Error(error.message)
  const bundle = (data ?? {}) as AvailabilityBundle
  return {
    windows: bundle.windows ?? [],
    reservations: bundle.reservations ?? [],
  }
}

export async function createAvailabilityWindow(input: {
  department: Department
  title: string
  startsAt: string
  endsAt: string
  capacity: number
  notes?: string | null
}): Promise<string> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_create_department_availability_window', {
    p_department: input.department,
    p_title: input.title,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_capacity: input.capacity,
    p_notes: input.notes ?? null,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function createDepartmentReservation(input: {
  windowId: string
  startsAt: string
  endsAt: string
  title: string
  status?: ReservationStatus
  entityKind?: ReservationEntityKind
  entityId?: string | null
  notes?: string | null
}): Promise<string> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_create_department_reservation', {
    p_window_id: input.windowId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_title: input.title,
    p_status: input.status ?? 'draft',
    p_entity_kind: input.entityKind ?? 'unlinked',
    p_entity_id: input.entityId ?? null,
    p_notes: input.notes ?? null,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function updateDepartmentReservation(
  reservationId: string,
  patch: Partial<{
    starts_at: string
    ends_at: string
    status: ReservationStatus
    title: string
    notes: string | null
    entity_kind: ReservationEntityKind
    entity_id: string | null
  }>,
): Promise<void> {
  const client = await requireClient()
  const { error } = await client.rpc('admin_update_department_reservation', {
    p_reservation_id: reservationId,
    p_patch: patch,
  })
  if (error) throw new Error(error.message)
}

/** Pure helper for UI / unit tests: intervals overlap when each starts before the other ends. */
export function intervalsOverlap(
  aStart: string | Date,
  aEnd: string | Date,
  bStart: string | Date,
  bEnd: string | Date,
): boolean {
  const as = new Date(aStart).getTime()
  const ae = new Date(aEnd).getTime()
  const bs = new Date(bStart).getTime()
  const be = new Date(bEnd).getTime()
  if (![as, ae, bs, be].every(Number.isFinite)) return false
  return as < be && bs < ae
}
