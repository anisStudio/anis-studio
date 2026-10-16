// F2.4.16E — client project tracking (no client accounts).
// Plaintext tokens are shown once at creation; only hashes live in the DB.
// Never send tracking links or e-mails automatically from this module.
//
// Token-in-URL residual risk: the shareable link still contains the secret once.
// The public page scrubs the path into sessionStorage + replace navigation;
// operators should still treat links as confidential (no public chat/logs).

import type { WebAtelierProjectStatus } from './webAtelierOffers'

export const WEB_ATELIER_TRACKING_PURPOSE = 'project_status_read' as const

export const WEB_ATELIER_PROJECT_STATUS_PUBLIC_HR: Record<
  WebAtelierProjectStatus,
  { label: string; description: string }
> = {
  preparing: {
    label: 'Priprema',
    description: 'Pripremamo projekt i dogovaramo sljedeće korake.',
  },
  waiting_for_client: {
    label: 'Čekamo vas',
    description: 'Potrebne su informacije ili materijali s vaše strane da nastavimo.',
  },
  ready_to_start: {
    label: 'Spremno za početak',
    description: 'Sve je spremno; uskoro krećemo s izradom.',
  },
  scheduled: {
    label: 'Zakazano',
    description: 'Početak izrade je dogovoren i zakazan.',
  },
  in_progress: {
    label: 'U izradi',
    description: 'Aktivno radimo na vašem web projektu.',
  },
  client_review: {
    label: 'Na vašem pregledu',
    description: 'Pripremili smo materijal za vaš pregled i povratne informacije.',
  },
  revision: {
    label: 'Revizija',
    description: 'Uvodimo dogovorene izmjene nakon pregleda.',
  },
  final_approval: {
    label: 'Završna potvrda',
    description: 'Čekamo završnu potvrdu prije zatvaranja projekta.',
  },
  completed: {
    label: 'Završeno',
    description: 'Projekt je završen.',
  },
  on_hold: {
    label: 'Na čekanju',
    description: 'Projekt je privremeno pauziran.',
  },
  cancelled: {
    label: 'Otkazano',
    description: 'Projekt je otkazan.',
  },
}

export interface WebAtelierTrackingTokenMeta {
  id: string
  project_id: string
  purpose: typeof WEB_ATELIER_TRACKING_PURPOSE
  token_prefix: string
  label: string | null
  expires_at: string
  revoked_at: string | null
  created_at: string
  last_used_at: string | null
  use_count: number
  is_expired: boolean
  is_active: boolean
}

export interface WebAtelierTrackingTokenCreated {
  token_id: string
  token: string
  token_prefix: string
  purpose: typeof WEB_ATELIER_TRACKING_PURPOSE
  expires_at: string
  project_id: string
  label: string | null
}

/** Minimal public status — must never include PII, notes, evidence, or money. */
export interface WebAtelierPublicProjectStatus {
  project_number: string
  title: string
  status: WebAtelierProjectStatus
  status_label_hr: string
  status_description_hr: string
  checked_at: string
}

const PUBLIC_STATUS_KEYS = [
  'project_number',
  'title',
  'status',
  'status_label_hr',
  'status_description_hr',
  'checked_at',
] as const

const FORBIDDEN_PUBLIC_KEYS = [
  'client_email',
  'client_name',
  'email',
  'phone',
  'notes',
  'admin_notes',
  'agreed_total_cents',
  'total_cents',
  'approval_id',
  'evidence',
  'token_hash',
] as const

async function adminClient() {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('supabase_unavailable')
  return supabase
}

function rpcError(error: { message?: string } | null): never {
  throw new Error(error?.message ?? 'rpc_failed')
}

export function isValidTrackingTokenFormat(token: string): boolean {
  return /^wat_[0-9a-f]{64}$/.test(token.trim())
}

export function defaultTrackingExpiryIso(days = 30): string {
  const safeDays = Math.min(90, Math.max(1, Math.floor(days)))
  const at = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000)
  return at.toISOString()
}

export function assertPublicStatusPayload(payload: Record<string, unknown>): WebAtelierPublicProjectStatus {
  for (const key of FORBIDDEN_PUBLIC_KEYS) {
    if (key in payload) throw new Error('public_status_leaks_sensitive_field')
  }
  for (const key of PUBLIC_STATUS_KEYS) {
    if (typeof payload[key] !== 'string' || !payload[key]) {
      throw new Error('public_status_incomplete')
    }
  }
  const extra = Object.keys(payload).filter(
    (key) => !(PUBLIC_STATUS_KEYS as readonly string[]).includes(key),
  )
  if (extra.length > 0) throw new Error('public_status_unexpected_fields')

  return {
    project_number: String(payload.project_number),
    title: String(payload.title),
    status: payload.status as WebAtelierProjectStatus,
    status_label_hr: String(payload.status_label_hr),
    status_description_hr: String(payload.status_description_hr),
    checked_at: String(payload.checked_at),
  }
}

export function trackingLinkPath(token: string): string {
  return `/pracenje-projekta/${encodeURIComponent(token.trim())}`
}

/** Manual copy helper only — never auto-sends e-mail. */
export function trackingLinkForDisplay(origin: string, token: string): string {
  const base = origin.replace(/\/$/, '')
  return `${base}${trackingLinkPath(token)}`
}

export async function createWebAtelierTrackingToken(input: {
  projectId: string
  expiresAt: string
  label?: string | null
}): Promise<WebAtelierTrackingTokenCreated> {
  const supabase = await adminClient()
  const { data, error } = await supabase.rpc('admin_create_web_atelier_project_tracking_token', {
    p_project_id: input.projectId,
    p_expires_at: input.expiresAt,
    p_label: input.label ?? null,
  })
  if (error) rpcError(error)
  const row = data as WebAtelierTrackingTokenCreated
  if (!row?.token || !isValidTrackingTokenFormat(row.token)) {
    throw new Error('tracking_token_create_invalid')
  }
  return row
}

export async function revokeWebAtelierTrackingToken(tokenId: string): Promise<{
  token_id: string
  revoked_at: string
  already_revoked: boolean
}> {
  const supabase = await adminClient()
  const { data, error } = await supabase.rpc('admin_revoke_web_atelier_project_tracking_token', {
    p_token_id: tokenId,
  })
  if (error) rpcError(error)
  return data as { token_id: string; revoked_at: string; already_revoked: boolean }
}

export async function listWebAtelierTrackingTokens(
  projectId: string,
): Promise<WebAtelierTrackingTokenMeta[]> {
  const supabase = await adminClient()
  const { data, error } = await supabase.rpc('admin_list_web_atelier_project_tracking_tokens', {
    p_project_id: projectId,
  })
  if (error) rpcError(error)
  const rows = (data ?? []) as WebAtelierTrackingTokenMeta[]
  if (rows.some((row) => 'token_hash' in (row as object) || 'token' in (row as object))) {
    throw new Error('tracking_list_leaks_secret')
  }
  return rows
}

export async function fetchPublicProjectStatusByToken(
  token: string,
): Promise<WebAtelierPublicProjectStatus> {
  if (!isValidTrackingTokenFormat(token)) throw new Error('tracking_token_invalid')
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('supabase_unavailable')
  const { data, error } = await supabase.rpc('get_web_atelier_project_public_status', {
    p_token: token.trim(),
  })
  if (error) rpcError(error)
  return assertPublicStatusPayload((data ?? {}) as Record<string, unknown>)
}
