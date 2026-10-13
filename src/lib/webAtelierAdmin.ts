export const WEB_ATELIER_STATUSES = [
  'submitted',
  'under_review',
  'accepted',
  'needs_info',
  'declined',
  'spam',
] as const

export const WEB_ATELIER_RISKS = ['unreviewed', 'clear', 'suspected', 'blocked'] as const

export type WebAtelierStatus = (typeof WEB_ATELIER_STATUSES)[number]
export type WebAtelierRisk = (typeof WEB_ATELIER_RISKS)[number]

export interface WebAtelierInquiryUpdate {
  status?: WebAtelierStatus
  risk_state?: WebAtelierRisk
  archived_at?: string | null
}

export function buildWebAtelierInquiryUpdate(
  input: Record<string, unknown>,
): WebAtelierInquiryUpdate | null {
  const update: WebAtelierInquiryUpdate = {}
  if (Object.prototype.hasOwnProperty.call(input, 'status')) {
    if (!(WEB_ATELIER_STATUSES as readonly string[]).includes(String(input.status))) return null
    update.status = input.status as WebAtelierStatus
  }
  if (Object.prototype.hasOwnProperty.call(input, 'risk_state')) {
    if (!(WEB_ATELIER_RISKS as readonly string[]).includes(String(input.risk_state))) return null
    update.risk_state = input.risk_state as WebAtelierRisk
  }
  if (Object.prototype.hasOwnProperty.call(input, 'archived_at')) {
    const value = input.archived_at
    if (value !== null && typeof value !== 'string') return null
    update.archived_at = value
  }
  return Object.keys(update).length > 0 ? update : null
}

export interface WebAtelierInquiryListItem {
  id: string
  reference_code: string
  contact_name: string
  email: string
  created_at: string
  status: WebAtelierStatus
  risk_state: WebAtelierRisk
  archived_at: string | null
}

export interface WebAtelierInquiryDetail extends WebAtelierInquiryListItem {
  language: string
  package_preference: string | null
  phone: string | null
  existing_website: string | null
  referral: string | null
  project_types: string[]
  project_types_other: string | null
  goals: string[]
  goals_other: string | null
  content_ready: string | null
  visuals_ready: string | null
  content_links: string | null
  design_mood: string[]
  design_mood_other: string | null
  design_inspiration: string | null
  features: string[]
  features_other: string | null
  features_notes: string | null
  budget_range: string
  launch_deadline: string | null
  deadline_flexibility: string | null
  contact_preference: string
  contact_time: string | null
  extra_notes: string
  configurator_snapshot: Record<string, unknown> | null
  updated_at: string
}

const LIST_COLUMNS =
  'id, reference_code, contact_name, email, created_at, status, risk_state, archived_at'

const DETAIL_COLUMNS = `${LIST_COLUMNS}, language, package_preference, phone, existing_website, referral, project_types, project_types_other, goals, goals_other, content_ready, visuals_ready, content_links, design_mood, design_mood_other, design_inspiration, features, features_other, features_notes, budget_range, launch_deadline, deadline_flexibility, contact_preference, contact_time, extra_notes, configurator_snapshot, updated_at`

async function adminClient() {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('supabase_unavailable')
  return supabase
}

export async function fetchWebAtelierInquiries(): Promise<WebAtelierInquiryListItem[]> {
  const supabase = await adminClient()
  const { data, error } = await supabase
    .from('web_atelier_inquiries')
    .select(LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error('fetch_failed')
  return (data ?? []) as unknown as WebAtelierInquiryListItem[]
}

export async function fetchWebAtelierInquiry(id: string): Promise<WebAtelierInquiryDetail | null> {
  const supabase = await adminClient()
  const { data, error } = await supabase
    .from('web_atelier_inquiries')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('fetch_failed')
  return (data as unknown as WebAtelierInquiryDetail | null) ?? null
}

export async function updateWebAtelierInquiry(
  id: string,
  input: Record<string, unknown>,
): Promise<void> {
  const update = buildWebAtelierInquiryUpdate(input)
  if (!update) throw new Error('invalid_update')
  const supabase = await adminClient()
  const { error } = await supabase.from('web_atelier_inquiries').update(update).eq('id', id)
  if (error) throw new Error('update_failed')
}
