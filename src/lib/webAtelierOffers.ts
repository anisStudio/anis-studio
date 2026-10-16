// Official Web Atelier offer / project workflow (client-side).
// Inquiry is never a purchase. An offer is never an invoice. A project exists
// only after an explicit acceptance record bound to a SENT snapshot.

export const WEB_ATELIER_OFFER_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'superseded',
] as const

export const WEB_ATELIER_PROJECT_STATUSES = [
  'preparing',
  'waiting_for_client',
  'ready_to_start',
  'scheduled',
  'in_progress',
  'client_review',
  'revision',
  'final_approval',
  'completed',
  'on_hold',
  'cancelled',
] as const

export const WEB_ATELIER_OFFER_ITEM_TYPES = ['service', 'addon', 'discount', 'other'] as const
export const WEB_ATELIER_PACKAGE_TIERS = ['start', 'pro', 'premium'] as const
export const WEB_ATELIER_EVIDENCE_CHANNELS = [
  'email',
  'signed_document',
  'written_message',
  'meeting_minutes',
  'other',
] as const
export const WEB_ATELIER_DELIVERY_CHANNELS = [
  'email_manual',
  'meeting',
  'courier',
  'other',
] as const

export type WebAtelierOfferStatus = (typeof WEB_ATELIER_OFFER_STATUSES)[number]
export type WebAtelierProjectStatus = (typeof WEB_ATELIER_PROJECT_STATUSES)[number]
export type WebAtelierOfferItemType = (typeof WEB_ATELIER_OFFER_ITEM_TYPES)[number]
export type WebAtelierPackageTier = (typeof WEB_ATELIER_PACKAGE_TIERS)[number]
export type WebAtelierEvidenceChannel = (typeof WEB_ATELIER_EVIDENCE_CHANNELS)[number]
export type WebAtelierDeliveryChannel = (typeof WEB_ATELIER_DELIVERY_CHANNELS)[number]

/** Informative list prices in EUR. Official until an administrator issues an offer. */
export const WEB_ATELIER_INFORMATIVE_PRICES_EUR: Record<WebAtelierPackageTier, number> = {
  start: 300,
  pro: 500,
  premium: 800,
}

export const WEB_ATELIER_INFORMATIVE_PRICES_CENTS: Record<WebAtelierPackageTier, number> = {
  start: 30_000,
  pro: 50_000,
  premium: 80_000,
}

export interface WebAtelierOfferItemInput {
  item_type: WebAtelierOfferItemType
  description: string
  details?: string | null
  quantity: number
  unit_price_cents: number
}

export interface WebAtelierOfferLine extends WebAtelierOfferItemInput {
  position: number
  line_total_cents: number
}

export interface WebAtelierOfferTotals {
  subtotal_cents: number
  discount_cents: number
  total_cents: number
}

export interface WebAtelierScopeInput {
  summary: string
  deliverables: string[]
  exclusions?: string[]
  assumptions?: string[]
  timeline_note?: string
  revision_rounds?: number
}

export interface WebAtelierOfferListItem {
  id: string
  offer_number: string
  inquiry_id: string | null
  version: number
  status: WebAtelierOfferStatus
  title: string
  package_tier: WebAtelierPackageTier | null
  client_name: string
  client_email: string
  total_cents: number
  valid_until: string | null
  sent_at: string | null
  delivered_at: string | null
  accepted_at: string | null
  created_at: string
}

export interface WebAtelierOfferDetail extends WebAtelierOfferListItem {
  supersedes_offer_id: string | null
  superseded_by_offer_id: string | null
  terms_note: string | null
  scope_version_id: string | null
  currency: string
  subtotal_cents: number
  discount_cents: number
  snapshot: Record<string, unknown> | null
  snapshot_sha256: string | null
  delivery_channel: WebAtelierDeliveryChannel | null
  delivery_reference: string | null
  rejected_at: string | null
  expired_at: string | null
  superseded_at: string | null
  items: WebAtelierOfferLine[]
}

export interface WebAtelierProjectListItem {
  id: string
  project_number: string
  inquiry_id: string | null
  offer_id: string
  title: string
  client_name: string
  client_email: string
  agreed_total_cents: number
  status: WebAtelierProjectStatus
  created_at: string
}

export interface WebAtelierProjectEvent {
  id: string
  event_type: string
  from_status: string | null
  to_status: string | null
  note: string | null
  created_at: string
}

export interface WebAtelierProjectDetail extends WebAtelierProjectListItem {
  approval_id: string
  scope_version_id: string
  notes: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  events: WebAtelierProjectEvent[]
}

export interface WebAtelierApprovalRecord {
  id: string
  offer_id: string
  decision: 'accepted' | 'rejected'
  offer_number: string
  offer_version: number
  offer_snapshot_sha256: string
  method: 'admin_recorded'
  decided_by_name: string
  decided_at: string
  evidence_channel: WebAtelierEvidenceChannel
  evidence_reference: string
  evidence_retention_note: string
  note: string | null
}

const OFFER_LIST_COLUMNS =
  'id, offer_number, inquiry_id, version, status, title, package_tier, client_name, client_email, total_cents, valid_until, sent_at, delivered_at, accepted_at, created_at'

const OFFER_DETAIL_COLUMNS = `${OFFER_LIST_COLUMNS}, supersedes_offer_id, superseded_by_offer_id, terms_note, scope_version_id, currency, subtotal_cents, discount_cents, snapshot, snapshot_sha256, delivery_channel, delivery_reference, rejected_at, expired_at, superseded_at`

const ITEM_COLUMNS =
  'id, offer_id, position, item_type, description, details, quantity, unit_price_cents, line_total_cents'

const PROJECT_LIST_COLUMNS =
  'id, project_number, inquiry_id, offer_id, title, client_name, client_email, agreed_total_cents, status, created_at'

const PROJECT_DETAIL_COLUMNS = `${PROJECT_LIST_COLUMNS}, approval_id, scope_version_id, notes, started_at, completed_at, cancelled_at`

async function adminClient() {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('supabase_unavailable')
  return supabase
}

function rpcError(error: { message?: string } | null): never {
  const message = error?.message ?? 'rpc_failed'
  throw new Error(message)
}

export function eurosToCents(euros: number): number {
  if (!Number.isFinite(euros) || euros < 0) throw new Error('invalid_euros')
  return Math.round(euros * 100)
}

export function formatEuroCents(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0
  return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(safe / 100)
}

export function lineTotalCents(quantity: number, unitPriceCents: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('items_quantity_invalid')
  if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) throw new Error('items_price_invalid')
  return Math.round(quantity * unitPriceCents)
}

export function calculateOfferTotals(items: WebAtelierOfferItemInput[]): WebAtelierOfferTotals {
  let subtotal = 0
  let discount = 0
  for (const item of items) {
    const line = lineTotalCents(item.quantity, item.unit_price_cents)
    if (item.item_type === 'discount') discount += line
    else subtotal += line
  }
  if (discount > subtotal) throw new Error('discount_exceeds_subtotal')
  return {
    subtotal_cents: subtotal,
    discount_cents: discount,
    total_cents: subtotal - discount,
  }
}

export function suggestedLineForTier(tier: WebAtelierPackageTier): WebAtelierOfferItemInput {
  const labels: Record<WebAtelierPackageTier, string> = {
    start: 'Web projekt START (informativno)',
    pro: 'Web projekt PRO (informativno)',
    premium: 'Web projekt PREMIUM (informativno)',
  }
  return {
    item_type: 'service',
    description: labels[tier],
    details: 'Informativna cijena do izdavanja službene ponude. Nije račun.',
    quantity: 1,
    unit_price_cents: WEB_ATELIER_INFORMATIVE_PRICES_CENTS[tier],
  }
}

export function canEditOffer(status: WebAtelierOfferStatus): boolean {
  return status === 'draft'
}

export function canIssueOffer(status: WebAtelierOfferStatus): boolean {
  return status === 'draft'
}

export function canRecordDelivery(status: WebAtelierOfferStatus, deliveredAt: string | null): boolean {
  return status === 'sent' && !deliveredAt
}

export function canRecordDecision(
  status: WebAtelierOfferStatus,
  deliveredAt: string | null,
): boolean {
  return status === 'sent' && !!deliveredAt
}

export function canCreateProject(status: WebAtelierOfferStatus): boolean {
  return status === 'accepted'
}

export function canReviseOffer(status: WebAtelierOfferStatus): boolean {
  return status === 'sent' || status === 'rejected' || status === 'expired'
}

/** Snapshot issuance is not client delivery. */
export function issuedOfferMeansDelivered(): false {
  return false
}

const OFFER_TRANSITIONS: Record<WebAtelierOfferStatus, readonly WebAtelierOfferStatus[]> = {
  draft: ['sent'],
  sent: ['accepted', 'rejected', 'expired', 'superseded'],
  accepted: [],
  rejected: [],
  expired: [],
  superseded: [],
}

const PROJECT_TRANSITIONS: Record<WebAtelierProjectStatus, readonly WebAtelierProjectStatus[]> = {
  preparing: ['waiting_for_client', 'ready_to_start', 'on_hold', 'cancelled'],
  waiting_for_client: ['preparing', 'ready_to_start', 'on_hold', 'cancelled'],
  ready_to_start: ['scheduled', 'in_progress', 'on_hold', 'cancelled'],
  scheduled: ['in_progress', 'on_hold', 'cancelled'],
  in_progress: ['client_review', 'on_hold', 'cancelled'],
  client_review: ['revision', 'final_approval', 'in_progress', 'on_hold', 'cancelled'],
  revision: ['in_progress', 'client_review', 'on_hold', 'cancelled'],
  final_approval: ['completed', 'revision', 'on_hold', 'cancelled'],
  completed: [],
  on_hold: [
    'preparing',
    'waiting_for_client',
    'ready_to_start',
    'scheduled',
    'in_progress',
    'client_review',
    'revision',
    'final_approval',
    'cancelled',
  ],
  cancelled: [],
}

export function isOfferTransitionAllowed(
  from: WebAtelierOfferStatus,
  to: WebAtelierOfferStatus,
): boolean {
  return OFFER_TRANSITIONS[from].includes(to)
}

export function isProjectTransitionAllowed(
  from: WebAtelierProjectStatus,
  to: WebAtelierProjectStatus,
): boolean {
  return PROJECT_TRANSITIONS[from].includes(to)
}

export function inquiryCreatesProject(): false {
  return false
}

export function sentOfferCreatesProject(): false {
  return false
}

export function normalizeScopeInput(input: WebAtelierScopeInput): WebAtelierScopeInput {
  const summary = input.summary.trim()
  if (summary.length < 1 || summary.length > 4000) throw new Error('scope_summary_length')
  const cleanList = (values: string[] | undefined, required: boolean) => {
    const next = (values ?? [])
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
    if (next.length > 30) throw new Error('scope_list_invalid')
    if (required && next.length < 1) throw new Error('scope_deliverables_required')
    if (next.some((value) => value.length > 300)) throw new Error('scope_list_item_length')
    return next
  }
  const out: WebAtelierScopeInput = {
    summary,
    deliverables: cleanList(input.deliverables, true),
    exclusions: cleanList(input.exclusions, false),
    assumptions: cleanList(input.assumptions, false),
  }
  if (input.timeline_note?.trim()) {
    const note = input.timeline_note.trim()
    if (note.length > 1000) throw new Error('scope_timeline_invalid')
    out.timeline_note = note
  }
  if (input.revision_rounds !== undefined) {
    if (
      !Number.isInteger(input.revision_rounds) ||
      input.revision_rounds < 0 ||
      input.revision_rounds > 20
    ) {
      throw new Error('scope_revision_rounds_invalid')
    }
    out.revision_rounds = input.revision_rounds
  }
  return out
}

export function validateOfferItems(items: WebAtelierOfferItemInput[]): WebAtelierOfferItemInput[] {
  if (!Array.isArray(items) || items.length > 50) throw new Error('items_invalid')
  return items.map((item) => {
    if (!(WEB_ATELIER_OFFER_ITEM_TYPES as readonly string[]).includes(item.item_type)) {
      throw new Error('items_type_invalid')
    }
    const description = item.description.trim()
    if (description.length < 1 || description.length > 300) throw new Error('items_description_invalid')
    const details = item.details?.trim() || null
    if (details && details.length > 1000) throw new Error('items_details_invalid')
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 1000) {
      throw new Error('items_quantity_invalid')
    }
    if (Math.round(item.quantity * 100) / 100 !== item.quantity) throw new Error('items_quantity_invalid')
    if (!Number.isInteger(item.unit_price_cents) || item.unit_price_cents < 0 || item.unit_price_cents > 100_000_000) {
      throw new Error('items_price_invalid')
    }
    return {
      item_type: item.item_type,
      description,
      details,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
    }
  })
}

export function buildEvidenceReference(input: {
  offerNumber: string
  offerVersion: number
  narrative: string
}): string {
  return `${input.offerNumber} #v${input.offerVersion} — ${input.narrative.trim()}`
}

export function validateAcceptanceEvidence(input: {
  decided_by_name: string
  evidence_channel: string
  evidence_reference: string
  evidence_retention_note: string
  admin_confirmed: boolean
  expected_snapshot_sha256: string
  offer_number: string
  offer_version: number
}): void {
  if (input.admin_confirmed !== true) throw new Error('admin_confirmation_required')
  if (input.decided_by_name.trim().length < 1) throw new Error('decided_by_name_required')
  if (!(WEB_ATELIER_EVIDENCE_CHANNELS as readonly string[]).includes(input.evidence_channel)) {
    throw new Error('evidence_channel_invalid')
  }
  if (input.evidence_reference.trim().length < 10) throw new Error('evidence_reference_required')
  if (input.evidence_retention_note.trim().length < 10) {
    throw new Error('evidence_retention_note_required')
  }
  if (!/^[0-9a-f]{64}$/.test(input.expected_snapshot_sha256)) throw new Error('snapshot_mismatch')
  if (!input.evidence_reference.toLowerCase().includes(input.offer_number.toLowerCase())) {
    throw new Error('evidence_must_cite_offer_number')
  }
  if (!input.evidence_reference.toLowerCase().includes(`#v${input.offer_version}`)) {
    throw new Error('evidence_must_cite_offer_version')
  }
}

export async function fetchWebAtelierOffers(): Promise<WebAtelierOfferListItem[]> {
  const supabase = await adminClient()
  const { data, error } = await supabase
    .from('web_atelier_offers')
    .select(OFFER_LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error('fetch_failed')
  return (data ?? []) as unknown as WebAtelierOfferListItem[]
}

export async function fetchWebAtelierOffersForInquiry(
  inquiryId: string,
): Promise<WebAtelierOfferListItem[]> {
  const supabase = await adminClient()
  const { data, error } = await supabase
    .from('web_atelier_offers')
    .select(OFFER_LIST_COLUMNS)
    .eq('inquiry_id', inquiryId)
    .order('version', { ascending: false })
  if (error) throw new Error('fetch_failed')
  return (data ?? []) as unknown as WebAtelierOfferListItem[]
}

export async function fetchWebAtelierOffer(id: string): Promise<WebAtelierOfferDetail | null> {
  const supabase = await adminClient()
  const { data, error } = await supabase
    .from('web_atelier_offers')
    .select(OFFER_DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('fetch_failed')
  if (!data) return null
  const { data: items, error: itemsError } = await supabase
    .from('web_atelier_offer_items')
    .select(ITEM_COLUMNS)
    .eq('offer_id', id)
    .order('position', { ascending: true })
  if (itemsError) throw new Error('fetch_failed')
  return {
    ...(data as unknown as Omit<WebAtelierOfferDetail, 'items'>),
    items: (items ?? []) as unknown as WebAtelierOfferLine[],
  }
}

export async function fetchWebAtelierApprovalForOffer(
  offerId: string,
): Promise<WebAtelierApprovalRecord | null> {
  const supabase = await adminClient()
  const { data, error } = await supabase
    .from('web_atelier_approvals')
    .select(
      'id, offer_id, decision, offer_number, offer_version, offer_snapshot_sha256, method, decided_by_name, decided_at, evidence_channel, evidence_reference, evidence_retention_note, note',
    )
    .eq('offer_id', offerId)
    .maybeSingle()
  if (error) throw new Error('fetch_failed')
  return (data as unknown as WebAtelierApprovalRecord | null) ?? null
}

export async function createWebAtelierOfferDraft(
  inquiryId: string,
  copyFromOfferId?: string | null,
): Promise<string> {
  const supabase = await adminClient()
  const { data, error } = await supabase.rpc('admin_create_web_atelier_offer_draft', {
    p_inquiry_id: inquiryId,
    p_copy_from_offer_id: copyFromOfferId ?? null,
  })
  if (error) rpcError(error)
  return String(data)
}

export async function updateWebAtelierOfferDraft(
  offerId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const supabase = await adminClient()
  const { error } = await supabase.rpc('admin_update_web_atelier_offer_draft', {
    p_offer_id: offerId,
    p_patch: patch,
  })
  if (error) rpcError(error)
}

export async function setWebAtelierOfferItems(
  offerId: string,
  items: WebAtelierOfferItemInput[],
): Promise<WebAtelierOfferTotals> {
  const clean = validateOfferItems(items)
  calculateOfferTotals(clean)
  const supabase = await adminClient()
  const { data, error } = await supabase.rpc('admin_set_web_atelier_offer_items', {
    p_offer_id: offerId,
    p_items: clean,
  })
  if (error) rpcError(error)
  return data as WebAtelierOfferTotals
}

export async function createWebAtelierScopeVersion(
  inquiryId: string,
  scope: WebAtelierScopeInput,
): Promise<string> {
  const supabase = await adminClient()
  const { data, error } = await supabase.rpc('admin_create_web_atelier_scope_version', {
    p_inquiry_id: inquiryId,
    p_scope: normalizeScopeInput(scope),
  })
  if (error) rpcError(error)
  return String(data)
}

export async function discardWebAtelierOfferDraft(offerId: string): Promise<void> {
  const supabase = await adminClient()
  const { error } = await supabase.rpc('admin_discard_web_atelier_offer_draft', {
    p_offer_id: offerId,
  })
  if (error) rpcError(error)
}

export async function markWebAtelierOfferSent(offerId: string): Promise<{
  offer_id: string
  offer_number: string
  snapshot_sha256: string
  sent_at: string
}> {
  const supabase = await adminClient()
  const { data, error } = await supabase.rpc('admin_mark_web_atelier_offer_sent', {
    p_offer_id: offerId,
  })
  if (error) rpcError(error)
  return data as {
    offer_id: string
    offer_number: string
    snapshot_sha256: string
    sent_at: string
  }
}

export async function recordWebAtelierOfferDelivery(input: {
  offerId: string
  deliveredAt: string
  deliveryChannel: WebAtelierDeliveryChannel
  deliveryReference: string
}): Promise<void> {
  if (!(WEB_ATELIER_DELIVERY_CHANNELS as readonly string[]).includes(input.deliveryChannel)) {
    throw new Error('delivery_channel_invalid')
  }
  if (input.deliveryReference.trim().length < 10) throw new Error('delivery_reference_required')
  const supabase = await adminClient()
  const { error } = await supabase.rpc('admin_record_web_atelier_offer_delivery', {
    p_offer_id: input.offerId,
    p_delivered_at: input.deliveredAt,
    p_delivery_channel: input.deliveryChannel,
    p_delivery_reference: input.deliveryReference.trim(),
  })
  if (error) rpcError(error)
}

export async function recordWebAtelierOfferDecision(input: {
  offerId: string
  decision: 'accepted' | 'rejected'
  expectedOfferVersion: number
  expectedSnapshotSha256: string
  offerNumber: string
  decidedByName: string
  decidedAt: string
  evidenceChannel: WebAtelierEvidenceChannel
  evidenceReference: string
  evidenceRetentionNote: string
  note?: string
  adminConfirmed: boolean
}): Promise<string> {
  validateAcceptanceEvidence({
    decided_by_name: input.decidedByName,
    evidence_channel: input.evidenceChannel,
    evidence_reference: input.evidenceReference,
    evidence_retention_note: input.evidenceRetentionNote,
    admin_confirmed: input.adminConfirmed,
    expected_snapshot_sha256: input.expectedSnapshotSha256,
    offer_number: input.offerNumber,
    offer_version: input.expectedOfferVersion,
  })
  const supabase = await adminClient()
  const { data, error } = await supabase.rpc('admin_record_web_atelier_offer_decision', {
    p_offer_id: input.offerId,
    p_decision: input.decision,
    p_expected_offer_version: input.expectedOfferVersion,
    p_expected_snapshot_sha256: input.expectedSnapshotSha256,
    p_decided_by_name: input.decidedByName.trim(),
    p_decided_at: input.decidedAt,
    p_evidence_channel: input.evidenceChannel,
    p_evidence_reference: input.evidenceReference.trim(),
    p_evidence_retention_note: input.evidenceRetentionNote.trim(),
    p_note: input.note?.trim() || null,
    p_admin_confirmed: true,
  })
  if (error) rpcError(error)
  return String(data)
}

export async function createWebAtelierProjectFromOffer(offerId: string): Promise<{
  project_id: string
  project_number: string
  created: boolean
}> {
  const supabase = await adminClient()
  const { data, error } = await supabase.rpc('admin_create_web_atelier_project_from_offer', {
    p_offer_id: offerId,
  })
  if (error) rpcError(error)
  return data as { project_id: string; project_number: string; created: boolean }
}

export async function fetchWebAtelierProjects(): Promise<WebAtelierProjectListItem[]> {
  const supabase = await adminClient()
  const { data, error } = await supabase
    .from('web_atelier_projects')
    .select(PROJECT_LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error('fetch_failed')
  return (data ?? []) as unknown as WebAtelierProjectListItem[]
}

export async function fetchWebAtelierProject(id: string): Promise<WebAtelierProjectDetail | null> {
  const supabase = await adminClient()
  const { data, error } = await supabase
    .from('web_atelier_projects')
    .select(PROJECT_DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('fetch_failed')
  if (!data) return null
  const { data: events, error: eventsError } = await supabase
    .from('web_atelier_project_events')
    .select('id, event_type, from_status, to_status, note, created_at')
    .eq('project_id', id)
    .order('created_at', { ascending: true })
  if (eventsError) throw new Error('fetch_failed')
  return {
    ...(data as unknown as Omit<WebAtelierProjectDetail, 'events'>),
    events: (events ?? []) as unknown as WebAtelierProjectEvent[],
  }
}

export async function updateWebAtelierProject(
  projectId: string,
  patch: { title?: string; notes?: string | null; status?: WebAtelierProjectStatus },
): Promise<void> {
  if (patch.status && !(WEB_ATELIER_PROJECT_STATUSES as readonly string[]).includes(patch.status)) {
    throw new Error('project_status_invalid')
  }
  const supabase = await adminClient()
  const { error } = await supabase.rpc('admin_update_web_atelier_project', {
    p_project_id: projectId,
    p_patch: patch,
  })
  if (error) rpcError(error)
}
