/**
 * Safe mapping of Supabase Auth / admin authorization failures to user-facing copy.
 * Does not reveal whether an email exists (shared invalid-credentials message).
 */

export type AdminAuthFailureKind =
  | 'not_configured'
  | 'misconfigured'
  | 'network'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'not_admin'
  | 'unknown'

export interface AdminAuthFailure {
  kind: AdminAuthFailureKind
  /** Safe Croatian message for the login UI. */
  message: string
}

const MESSAGES: Record<AdminAuthFailureKind, string> = {
  not_configured:
    'Prijava trenutno nije dostupna: autentifikacijska usluga nije konfigurirana za ovo okruženje.',
  misconfigured:
    'Prijava trenutno nije dostupna: konfiguracija autentifikacije nije usklađena. Provjerite Vercel Preview varijable.',
  network:
    'Prijava nije uspjela zbog mrežne greške ili nedostupne autentifikacijske usluge. Pokušajte ponovo.',
  invalid_credentials: 'Neispravna e-pošta ili lozinka.',
  email_not_confirmed: 'Potvrdite adresu e-pošte prije prijave.',
  not_admin: 'Ovaj račun nema pristup admin panelu.',
  unknown: 'Prijava nije uspjela. Pokušajte ponovo.',
}

export function messageForAdminAuthFailure(kind: AdminAuthFailureKind): string {
  return MESSAGES[kind]
}

/**
 * Classify a Supabase Auth error message / status without leaking internals.
 */
export function classifySupabaseAuthError(input: {
  message?: string | null
  status?: number | null
  name?: string | null
}): AdminAuthFailureKind {
  const m = (input.message ?? '').toLowerCase()
  const status = input.status ?? null

  if (
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('network request failed') ||
    m.includes('load failed') ||
    input.name === 'AuthRetryableFetchError'
  ) {
    return 'network'
  }

  if (
    m.includes('invalid api key') ||
    m.includes('invalid jwt') ||
    m.includes('unsupported jwt') ||
    m.includes('bad_jwt') ||
    (status === 401 && (m.includes('api key') || m.includes('jwt')))
  ) {
    return 'misconfigured'
  }

  if (m.includes('email not confirmed')) {
    return 'email_not_confirmed'
  }

  if (
    m.includes('invalid login credentials') ||
    m.includes('invalid email or password') ||
    m.includes('invalid_credentials')
  ) {
    return 'invalid_credentials'
  }

  return 'unknown'
}

export function failureFromSupabaseAuthError(input: {
  message?: string | null
  status?: number | null
  name?: string | null
}): AdminAuthFailure {
  const kind = classifySupabaseAuthError(input)
  return { kind, message: messageForAdminAuthFailure(kind) }
}
