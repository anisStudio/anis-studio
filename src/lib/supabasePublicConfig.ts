/**
 * Public, non-secret Supabase configuration diagnostics for the browser bundle.
 * Never log or return full keys/tokens.
 */

export type SupabaseConfigStatus =
  | 'missing'
  | 'invalid_url'
  | 'ready'
  | 'url_key_mismatch'

export interface SupabasePublicDiagnostics {
  status: SupabaseConfigStatus
  /** Hostname only, e.g. cpvofgaknmgnmusypoev.supabase.co */
  urlHost: string | null
  /** Project ref from URL host when on *.supabase.co */
  projectRef: string | null
  /** Project ref from JWT anon key payload when present (legacy eyJ… keys). */
  keyRef: string | null
  /** True when a non-empty anon/publishable key string is present (value never exposed). */
  hasAnonKey: boolean
  /** Key shape only — never the secret material. */
  keyFormat: 'missing' | 'jwt' | 'publishable' | 'other'
}

function trimEnv(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Decode JWT payload without verification — used only to read public `ref` claim. */
export function readJwtPayloadRef(token: string): string | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const json = atob(b64 + pad)
    const parsed = JSON.parse(json) as { ref?: unknown }
    return typeof parsed.ref === 'string' && parsed.ref.trim() ? parsed.ref.trim() : null
  } catch {
    return null
  }
}

export function extractSupabaseProjectRefFromHost(host: string | null): string | null {
  if (!host) return null
  const m = host.toLowerCase().match(/^([a-z0-9]+)\.supabase\.co$/)
  return m?.[1] ?? null
}

export function detectSupabaseKeyFormat(
  key: string | null,
): SupabasePublicDiagnostics['keyFormat'] {
  if (!key) return 'missing'
  if (key.startsWith('eyJ')) return 'jwt'
  if (key.startsWith('sb_publishable_') || key.startsWith('sb_anon_')) return 'publishable'
  return 'other'
}

/**
 * Build diagnostics from raw env-like strings (testable without Vite).
 */
export function buildSupabasePublicDiagnostics(
  rawUrl: unknown,
  rawAnonKey: unknown,
): SupabasePublicDiagnostics {
  const url = trimEnv(rawUrl)
  const anonKey = trimEnv(rawAnonKey)
  const keyFormat = detectSupabaseKeyFormat(anonKey)
  const keyRef = keyFormat === 'jwt' && anonKey ? readJwtPayloadRef(anonKey) : null

  if (!url || !anonKey) {
    return {
      status: 'missing',
      urlHost: null,
      projectRef: null,
      keyRef,
      hasAnonKey: Boolean(anonKey),
      keyFormat,
    }
  }

  let urlHost: string | null = null
  try {
    urlHost = new URL(url).hostname.toLowerCase()
  } catch {
    return {
      status: 'invalid_url',
      urlHost: null,
      projectRef: null,
      keyRef,
      hasAnonKey: true,
      keyFormat,
    }
  }

  const projectRef = extractSupabaseProjectRefFromHost(urlHost)

  if (keyRef && projectRef && keyRef !== projectRef) {
    return {
      status: 'url_key_mismatch',
      urlHost,
      projectRef,
      keyRef,
      hasAnonKey: true,
      keyFormat,
    }
  }

  return {
    status: 'ready',
    urlHost,
    projectRef,
    keyRef,
    hasAnonKey: true,
    keyFormat,
  }
}

export function getSupabasePublicDiagnostics(): SupabasePublicDiagnostics {
  return buildSupabasePublicDiagnostics(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
  )
}

/** Expected production Supabase project ref for Ani's Studio. */
export const EXPECTED_SUPABASE_PROJECT_REF = 'cpvofgaknmgnmusypoev'
