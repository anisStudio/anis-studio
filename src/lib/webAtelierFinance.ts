// F2.4 H — admin-only financial tracking + receipt confirmation.
// Parra remains authoritative for invoices. Planned installments + optional Parra
// document references live here. Receipt confirmation is NOT a payment ledger entry
// and never writes web_atelier_payment_records.

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
export const PAYMENT_PLAN_KINDS = ['full', 'advance_balance', 'custom'] as const
export const RECEIPT_STATUSES = ['awaiting', 'confirmed', 'cancelled', 'waived'] as const

export type PaymentScheduleStatus = (typeof PAYMENT_SCHEDULE_STATUSES)[number]
export type FinancialDocKind = (typeof FINANCIAL_DOC_KINDS)[number]
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
export type PaymentPlanKind = (typeof PAYMENT_PLAN_KINDS)[number]
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number]

export const PAYMENT_SCHEDULE_STATUS_LABEL_HR: Record<PaymentScheduleStatus, string> = {
  planned: 'Planirano',
  due: 'Dospjelo',
  paid: 'Plaćeno (stara evidencija)',
  waived: 'Otpisano',
  cancelled: 'Otkazano',
}

export const RECEIPT_STATUS_LABEL_HR: Record<'awaiting' | 'confirmed', string> = {
  awaiting: 'Čeka potvrdu',
  confirmed: 'Primitak potvrđen',
}

export const RECEIPT_STATUS_LABEL_EN: Record<'awaiting' | 'confirmed', string> = {
  awaiting: 'Awaiting confirmation',
  confirmed: 'Receipt confirmed',
}

export const PAYMENT_PLAN_KIND_LABEL_HR: Record<PaymentPlanKind, string> = {
  full: 'Jednokratno — 100%',
  advance_balance: 'Avans + ostatak',
  custom: 'Rate po dogovoru',
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
  receipt_confirmed_at?: string | null
  receipt_confirmed_by?: string | null
  receipt_status?: ReceiptStatus
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

/** Legacy ledger rows — kept for compatibility; not written by receipt confirmation. */
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

export interface ReceiptEvent {
  id: string
  schedule_id: string
  event_type: 'confirmed' | 'corrected'
  reason: string | null
  actor_id: string | null
  created_at: string
}

export interface ProjectFinanceBundle {
  schedules: PaymentSchedule[]
  documents: FinancialDocument[]
  payments: PaymentRecord[]
  receipt_events: ReceiptEvent[]
}

export interface PaymentPlanItemInput {
  label: string
  dueDate?: string | null
  amountCents: number
}

async function requireClient() {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase nije konfiguriran.')
  return supabase
}

/** Accepts number or locale decimal string (comma or dot). Integer cents via banker's-safe round. */
export function eurosToCents(euros: string | number): number {
  const n = typeof euros === 'number' ? euros : Number(String(euros).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) throw new Error('Neispravan iznos.')
  return Math.round(n * 100)
}

export function formatEuroCents(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0
  return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(safe / 100)
}

export function sumCents(amounts: readonly number[]): number {
  return amounts.reduce((acc, value) => {
    if (!Number.isInteger(value)) throw new Error('Iznosi moraju biti cijeli centi.')
    return acc + value
  }, 0)
}

export function validatePaymentPlanTotals(
  planKind: PaymentPlanKind,
  items: readonly PaymentPlanItemInput[],
  agreedTotalCents: number,
): void {
  if (!Number.isInteger(agreedTotalCents) || agreedTotalCents < 0) {
    throw new Error('Dogovoreni iznos projekta nije valjan.')
  }
  if (planKind === 'full' && items.length !== 1) {
    throw new Error('Cjelokupna uplata zahtijeva jednu stavku.')
  }
  if (planKind === 'advance_balance' && items.length !== 2) {
    throw new Error('Avans + ostatak zahtijeva dvije stavke.')
  }
  if (planKind === 'custom' && items.length < 1) {
    throw new Error('Dodaj barem jednu ratu.')
  }
  const total = sumCents(items.map((item) => item.amountCents))
  if (total !== agreedTotalCents) {
    throw new Error(
      `Zbroj rata (${formatEuroCents(total)}) mora biti jednak dogovorenom iznosu (${formatEuroCents(agreedTotalCents)}).`,
    )
  }
}

export function buildFullPaymentPlan(agreedTotalCents: number): PaymentPlanItemInput[] {
  return [{ label: 'Cjelokupna uplata', amountCents: agreedTotalCents, dueDate: null }]
}

export function scheduleReceiptStatus(schedule: PaymentSchedule): 'awaiting' | 'confirmed' {
  if (schedule.receipt_confirmed_at) return 'confirmed'
  if (schedule.receipt_status === 'confirmed') return 'confirmed'
  return 'awaiting'
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
    receipt_events: bundle.receipt_events ?? [],
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

export async function savePaymentPlan(input: {
  projectId: string
  planKind: PaymentPlanKind
  items: PaymentPlanItemInput[]
  agreedTotalCents: number
}): Promise<void> {
  validatePaymentPlanTotals(input.planKind, input.items, input.agreedTotalCents)
  const client = await requireClient()
  const { error } = await client.rpc('admin_save_web_atelier_payment_plan', {
    p_project_id: input.projectId,
    p_plan_kind: input.planKind,
    p_items: input.items.map((item) => ({
      label: item.label,
      due_date: item.dueDate ?? null,
      amount_cents: item.amountCents,
    })),
  })
  if (error) throw new Error(error.message)
}

export async function confirmPaymentReceipt(scheduleId: string): Promise<{
  schedule_id: string
  already_confirmed: boolean
  receipt_confirmed_at: string | null
}> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_confirm_web_atelier_payment_receipt', {
    p_schedule_id: scheduleId,
  })
  if (error) throw new Error(error.message)
  return data as {
    schedule_id: string
    already_confirmed: boolean
    receipt_confirmed_at: string | null
  }
}

export async function correctPaymentReceipt(
  scheduleId: string,
  reason: string,
): Promise<void> {
  const client = await requireClient()
  const { error } = await client.rpc('admin_correct_web_atelier_payment_receipt', {
    p_schedule_id: scheduleId,
    p_reason: reason,
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
