// F2.4 H — admin-only financial tracking.
// Parra remains authoritative for invoices. This module stores manual references
// and payment schedules only. Never generates fiscal documents or Stripe charges.

export const PAYMENT_SCHEDULE_STATUSES = [
  'planned',
  'due',
  'paid',
  'waived',
  'cancelled',
] as const
export const FINANCIAL_DOC_KINDS = [
  'parra_invoice',
  'parra_proforma',
  'credit_note',
  'other',
] as const
export const PAYMENT_METHODS = ['bank_transfer', 'cash', 'card', 'other'] as const

export type PaymentScheduleStatus = (typeof PAYMENT_SCHEDULE_STATUSES)[number]
export type FinancialDocKind = (typeof FINANCIAL_DOC_KINDS)[number]
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_SCHEDULE_STATUS_LABEL_HR: Record<PaymentScheduleStatus, string> = {
  planned: 'Planirano',
  due: 'Dospjelo',
  paid: 'Plaćeno',
  waived: 'Otpisano',
  cancelled: 'Otkazano',
}

export const FINANCIAL_DOC_KIND_LABEL_HR: Record<FinancialDocKind, string> = {
  parra_invoice: 'Parra račun',
  parra_proforma: 'Parra predračun',
  credit_note: 'Storno / kreditna',
  other: 'Ostalo',
}

export const PAYMENT_METHOD_LABEL_HR: Record<PaymentMethod, string> = {
  bank_transfer: 'Virman',
  cash: 'Gotovina',
  card: 'Kartica',
  other: 'Ostalo',
}

export interface PaymentSchedule {
  id: string
  project_id: string
  label: string
  due_date: string | null
  amount_cents: number
  currency: string
  status: PaymentScheduleStatus
  notes: string | null
  position: number
  created_at: string
}

export interface FinancialDocument {
  id: string
  project_id: string
  doc_kind: FinancialDocKind
  external_reference: string
  issued_on: string | null
  amount_cents: number | null
  currency: string
  notes: string | null
  created_at: string
}

export interface PaymentRecord {
  id: string
  project_id: string
  schedule_id: string | null
  document_id: string | null
  amount_cents: number
  currency: string
  paid_on: string
  method: PaymentMethod
  external_reference: string | null
  notes: string | null
  created_at: string
}

export interface ProjectFinanceBundle {
  schedules: PaymentSchedule[]
  documents: FinancialDocument[]
  payments: PaymentRecord[]
}

async function requireClient() {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase nije konfiguriran.')
  return supabase
}

/** Accepts number or locale decimal string (comma or dot). */
export function eurosToCents(euros: string | number): number {
  const n = typeof euros === 'number' ? euros : Number(String(euros).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) throw new Error('Neispravan iznos.')
  return Math.round(n * 100)
}

export function formatEuroCents(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0
  return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(safe / 100)
}

export async function listWebAtelierFinance(projectId: string): Promise<ProjectFinanceBundle> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_list_web_atelier_finance', {
    p_project_id: projectId,
  })
  if (error) throw new Error(error.message)
  const bundle = (data ?? {}) as ProjectFinanceBundle
  return {
    schedules: bundle.schedules ?? [],
    documents: bundle.documents ?? [],
    payments: bundle.payments ?? [],
  }
}

export async function createPaymentSchedule(input: {
  projectId: string
  label: string
  dueDate?: string | null
  amountCents: number
  notes?: string | null
  position?: number
}): Promise<string> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_create_web_atelier_payment_schedule', {
    p_project_id: input.projectId,
    p_label: input.label,
    p_due_date: input.dueDate ?? null,
    p_amount_cents: input.amountCents,
    p_notes: input.notes ?? null,
    p_position: input.position ?? 0,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function updatePaymentSchedule(
  scheduleId: string,
  patch: Partial<{
    label: string
    due_date: string | null
    amount_cents: number
    status: Exclude<PaymentScheduleStatus, 'paid'>
    notes: string | null
    position: number
  }>,
): Promise<void> {
  const client = await requireClient()
  const { error } = await client.rpc('admin_update_web_atelier_payment_schedule', {
    p_schedule_id: scheduleId,
    p_patch: patch,
  })
  if (error) throw new Error(error.message)
}

export async function createFinancialDocument(input: {
  projectId: string
  docKind: FinancialDocKind
  externalReference: string
  issuedOn?: string | null
  amountCents?: number | null
  notes?: string | null
}): Promise<string> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_create_web_atelier_financial_document', {
    p_project_id: input.projectId,
    p_doc_kind: input.docKind,
    p_external_reference: input.externalReference,
    p_issued_on: input.issuedOn ?? null,
    p_amount_cents: input.amountCents ?? null,
    p_notes: input.notes ?? null,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function recordPayment(input: {
  projectId: string
  amountCents: number
  paidOn: string
  method: PaymentMethod
  scheduleId?: string | null
  documentId?: string | null
  externalReference?: string | null
  notes?: string | null
  markSchedulePaid?: boolean
}): Promise<string> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_record_web_atelier_payment', {
    p_project_id: input.projectId,
    p_amount_cents: input.amountCents,
    p_paid_on: input.paidOn,
    p_method: input.method,
    p_schedule_id: input.scheduleId ?? null,
    p_document_id: input.documentId ?? null,
    p_external_reference: input.externalReference ?? null,
    p_notes: input.notes ?? null,
    p_mark_schedule_paid: input.markSchedulePaid ?? true,
  })
  if (error) throw new Error(error.message)
  return data as string
}
