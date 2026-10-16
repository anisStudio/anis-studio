// F2.4.16F — material requirements for accepted Web Atelier projects.
// Admin checklist only. Client upload authorization is intentionally deferred.
// Private storage paths are planned metadata; no fabricated file records.

export const WEB_ATELIER_MATERIAL_KINDS = [
  'logo',
  'text',
  'images',
  'brand_colors',
  'other',
] as const

export const WEB_ATELIER_MATERIAL_STATUSES = [
  'pending',
  'received',
  'waived',
  'cancelled',
] as const

export type WebAtelierMaterialKind = (typeof WEB_ATELIER_MATERIAL_KINDS)[number]
export type WebAtelierMaterialStatus = (typeof WEB_ATELIER_MATERIAL_STATUSES)[number]

export const WEB_ATELIER_MATERIAL_KIND_LABEL_HR: Record<WebAtelierMaterialKind, string> = {
  logo: 'Logo',
  text: 'Tekstovi',
  images: 'Slike',
  brand_colors: 'Boje brenda',
  other: 'Ostalo',
}

export const WEB_ATELIER_MATERIAL_STATUS_LABEL_HR: Record<WebAtelierMaterialStatus, string> = {
  pending: 'Na čekanju',
  received: 'Primljeno',
  waived: 'Odustano',
  cancelled: 'Otkazano',
}

export const WEB_ATELIER_MATERIALS_BUCKET = 'web-atelier-materials'

export interface WebAtelierMaterialRequirement {
  id: string
  project_id: string
  kind: WebAtelierMaterialKind
  title: string
  description: string | null
  is_required: boolean
  deadline: string | null
  status: WebAtelierMaterialStatus
  admin_notes: string | null
  planned_storage_path: string
  position: number
  created_at: string
  updated_at: string
}

export interface WebAtelierMaterialRequirementInput {
  kind: WebAtelierMaterialKind
  title: string
  description?: string | null
  is_required?: boolean
  deadline?: string | null
  admin_notes?: string | null
}

async function adminClient() {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('supabase_unavailable')
  return supabase
}

function rpcError(error: { message?: string } | null): never {
  throw new Error(error?.message ?? 'rpc_failed')
}

export function plannedStoragePath(projectId: string, requirementId: string): string {
  return `${WEB_ATELIER_MATERIALS_BUCKET}/${projectId}/${requirementId}/`
}

export function isValidPlannedStoragePath(
  path: string,
  projectId: string,
  requirementId: string,
): boolean {
  return path === plannedStoragePath(projectId, requirementId)
}

/** Documented remaining work — do not call from UI as if uploads were live. */
export function clientMaterialUploadImplemented(): false {
  return false
}

export function validateMaterialInput(input: WebAtelierMaterialRequirementInput): WebAtelierMaterialRequirementInput {
  if (!(WEB_ATELIER_MATERIAL_KINDS as readonly string[]).includes(input.kind)) {
    throw new Error('material_kind_invalid')
  }
  const title = input.title.trim()
  if (title.length < 1 || title.length > 200) throw new Error('material_title_invalid')
  const description = input.description?.trim() || null
  if (description && description.length > 2000) throw new Error('material_description_invalid')
  const admin_notes = input.admin_notes?.trim() || null
  if (admin_notes && admin_notes.length > 4000) throw new Error('material_admin_notes_invalid')
  if (input.deadline) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.deadline)) throw new Error('material_deadline_invalid')
  }
  return {
    kind: input.kind,
    title,
    description,
    is_required: input.is_required !== false,
    deadline: input.deadline || null,
    admin_notes,
  }
}

export function materialOverview(rows: WebAtelierMaterialRequirement[]): {
  total: number
  required_pending: number
  received: number
  waived: number
  cancelled: number
} {
  return {
    total: rows.length,
    required_pending: rows.filter((r) => r.is_required && r.status === 'pending').length,
    received: rows.filter((r) => r.status === 'received').length,
    waived: rows.filter((r) => r.status === 'waived').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
  }
}

export async function listWebAtelierMaterialRequirements(
  projectId: string,
): Promise<WebAtelierMaterialRequirement[]> {
  const supabase = await adminClient()
  const { data, error } = await supabase.rpc('admin_list_web_atelier_material_requirements', {
    p_project_id: projectId,
  })
  if (error) rpcError(error)
  return (data ?? []) as WebAtelierMaterialRequirement[]
}

export async function createWebAtelierMaterialRequirement(
  projectId: string,
  input: WebAtelierMaterialRequirementInput,
): Promise<string> {
  const clean = validateMaterialInput(input)
  const supabase = await adminClient()
  const { data, error } = await supabase.rpc('admin_create_web_atelier_material_requirement', {
    p_project_id: projectId,
    p_kind: clean.kind,
    p_title: clean.title,
    p_description: clean.description,
    p_is_required: clean.is_required,
    p_deadline: clean.deadline,
    p_admin_notes: clean.admin_notes,
  })
  if (error) rpcError(error)
  return data as string
}

export async function updateWebAtelierMaterialRequirement(
  requirementId: string,
  patch: Partial<{
    title: string
    description: string | null
    is_required: boolean
    deadline: string | null
    status: WebAtelierMaterialStatus
    admin_notes: string | null
    kind: WebAtelierMaterialKind
  }>,
): Promise<void> {
  if (patch.status && !(WEB_ATELIER_MATERIAL_STATUSES as readonly string[]).includes(patch.status)) {
    throw new Error('material_status_invalid')
  }
  if (patch.kind && !(WEB_ATELIER_MATERIAL_KINDS as readonly string[]).includes(patch.kind)) {
    throw new Error('material_kind_invalid')
  }
  const supabase = await adminClient()
  const { error } = await supabase.rpc('admin_update_web_atelier_material_requirement', {
    p_requirement_id: requirementId,
    p_patch: patch,
  })
  if (error) rpcError(error)
}
