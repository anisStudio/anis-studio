// F2.4 G — admin-only communication history + templates.
// Manual records only. Never sends e-mail or fabricates delivery.

export const COMMUNICATION_CHANNELS = ['email', 'telephone', 'meeting', 'other'] as const
export const COMMUNICATION_DIRECTIONS = ['inbound', 'outbound', 'internal'] as const
export const COMMUNICATION_DEPARTMENTS = ['web_atelier', 'interiors', 'lrc', 'shared'] as const

export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number]
export type CommunicationDirection = (typeof COMMUNICATION_DIRECTIONS)[number]
export type CommunicationDepartment = (typeof COMMUNICATION_DEPARTMENTS)[number]

export const COMMUNICATION_CHANNEL_LABEL_HR: Record<CommunicationChannel, string> = {
  email: 'E-mail',
  telephone: 'Telefon',
  meeting: 'Sastanak',
  other: 'Ostalo',
}

export const COMMUNICATION_DIRECTION_LABEL_HR: Record<CommunicationDirection, string> = {
  inbound: 'Dolazno',
  outbound: 'Odlazno',
  internal: 'Interno',
}

export interface CommunicationTemplate {
  id: string
  department: CommunicationDepartment
  channel: CommunicationChannel
  name: string
  subject_template: string | null
  body_template: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WebAtelierCommunication {
  id: string
  channel: CommunicationChannel
  direction: CommunicationDirection
  subject: string | null
  summary: string
  occurred_at: string
  inquiry_id: string | null
  offer_id: string | null
  project_id: string | null
  template_id: string | null
  created_at: string
}

async function requireClient() {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase nije konfiguriran.')
  return supabase
}

export async function listCommunicationTemplates(
  department?: CommunicationDepartment | null,
): Promise<CommunicationTemplate[]> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_list_communication_templates', {
    p_department: department ?? null,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as CommunicationTemplate[]
}

export async function upsertCommunicationTemplate(input: {
  id?: string | null
  department: CommunicationDepartment
  channel: CommunicationChannel
  name: string
  subjectTemplate?: string | null
  bodyTemplate: string
  isActive?: boolean
}): Promise<string> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_upsert_communication_template', {
    p_id: input.id ?? null,
    p_department: input.department,
    p_channel: input.channel,
    p_name: input.name,
    p_subject_template: input.subjectTemplate ?? null,
    p_body_template: input.bodyTemplate,
    p_is_active: input.isActive ?? true,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function listWebAtelierCommunications(filter: {
  inquiryId?: string | null
  offerId?: string | null
  projectId?: string | null
}): Promise<WebAtelierCommunication[]> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_list_web_atelier_communications', {
    p_inquiry_id: filter.inquiryId ?? null,
    p_offer_id: filter.offerId ?? null,
    p_project_id: filter.projectId ?? null,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as WebAtelierCommunication[]
}

export async function createWebAtelierCommunication(input: {
  channel: CommunicationChannel
  direction: CommunicationDirection
  subject?: string | null
  summary: string
  occurredAt?: string | null
  inquiryId?: string | null
  offerId?: string | null
  projectId?: string | null
  templateId?: string | null
}): Promise<string> {
  const client = await requireClient()
  const { data, error } = await client.rpc('admin_create_web_atelier_communication', {
    p_channel: input.channel,
    p_direction: input.direction,
    p_subject: input.subject ?? null,
    p_summary: input.summary,
    p_occurred_at: input.occurredAt ?? new Date().toISOString(),
    p_inquiry_id: input.inquiryId ?? null,
    p_offer_id: input.offerId ?? null,
    p_project_id: input.projectId ?? null,
    p_template_id: input.templateId ?? null,
  })
  if (error) throw new Error(error.message)
  return data as string
}
