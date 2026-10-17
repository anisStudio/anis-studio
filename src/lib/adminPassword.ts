/**
 * Admin password change + recovery helpers (pure / injectable).
 * Never log password values. Never persist passwords to app tables.
 */

export const ADMIN_PASSWORD_MIN_LENGTH = 8

export const ADMIN_PASSWORD_RECOVERY_PATH = '/admin/reset-password'
export const ADMIN_FORGOT_PASSWORD_PATH = '/admin/forgot-password'

export type AdminPasswordValidationError =
  | 'too_short'
  | 'mismatch'
  | 'same_as_current'
  | 'current_required'
  | 'new_required'

export function validateNewPasswordPair(input: {
  newPassword: string
  confirmPassword: string
  currentPassword?: string
  minLength?: number
}): AdminPasswordValidationError | null {
  const min = input.minLength ?? ADMIN_PASSWORD_MIN_LENGTH
  if (!input.newPassword) return 'new_required'
  if (input.newPassword.length < min) return 'too_short'
  if (input.newPassword !== input.confirmPassword) return 'mismatch'
  if (
    typeof input.currentPassword === 'string' &&
    input.currentPassword.length > 0 &&
    input.newPassword === input.currentPassword
  ) {
    return 'same_as_current'
  }
  return null
}

export function messageForPasswordValidation(
  error: AdminPasswordValidationError,
  minLength = ADMIN_PASSWORD_MIN_LENGTH,
): string {
  switch (error) {
    case 'too_short':
      return `Nova lozinka mora imati najmanje ${minLength} znakova.`
    case 'mismatch':
      return 'Nova lozinka i potvrda se ne podudaraju.'
    case 'same_as_current':
      return 'Nova lozinka mora se razlikovati od trenutačne.'
    case 'current_required':
      return 'Unesite trenutačnu lozinku.'
    case 'new_required':
      return 'Unesite novu lozinku.'
  }
}

/** Only same-origin recovery target — never an arbitrary external URL. */
export function buildAdminPasswordRecoveryRedirectTo(origin: string): string {
  let base = origin.trim()
  try {
    const u = new URL(base)
    base = u.origin
  } catch {
    base = base.replace(/\/$/, '')
  }
  return `${base.replace(/\/$/, '')}${ADMIN_PASSWORD_RECOVERY_PATH}`
}

export interface AuthCallbackParams {
  error: string | null
  errorCode: string | null
  errorDescription: string | null
  /** Supabase recovery type from hash/query when present. */
  type: string | null
  hasAuthCode: boolean
  hasAccessToken: boolean
}

function readParam(params: URLSearchParams, key: string): string | null {
  const v = params.get(key)
  return v && v.trim() ? v.trim() : null
}

/**
 * Parse Auth callback / recovery errors from a full URL (hash or query).
 * Does not return tokens — only flags and safe error codes.
 */
export function parseAuthCallbackParams(href: string): AuthCallbackParams {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return {
      error: null,
      errorCode: null,
      errorDescription: null,
      type: null,
      hasAuthCode: false,
      hasAccessToken: false,
    }
  }

  const query = url.searchParams
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
  const hashParams = new URLSearchParams(hash)

  const error =
    readParam(query, 'error') ?? readParam(hashParams, 'error')
  const errorCode =
    readParam(query, 'error_code') ?? readParam(hashParams, 'error_code')
  const errorDescription =
    readParam(query, 'error_description') ??
    readParam(hashParams, 'error_description')
  const type = readParam(query, 'type') ?? readParam(hashParams, 'type')

  return {
    error,
    errorCode,
    errorDescription,
    type,
    hasAuthCode: Boolean(readParam(query, 'code')),
    hasAccessToken: Boolean(readParam(hashParams, 'access_token')),
  }
}

export function isAuthRecoveryCallback(params: AuthCallbackParams): boolean {
  if (params.type === 'recovery') return true
  if (params.hasAuthCode || params.hasAccessToken) return true
  if (params.errorCode || params.error) return true
  return false
}

export type RecoveryLinkErrorKind = 'otp_expired' | 'access_denied' | 'other' | null

export function classifyRecoveryLinkError(
  params: AuthCallbackParams,
): RecoveryLinkErrorKind {
  if (!params.error && !params.errorCode) return null
  const code = (params.errorCode ?? '').toLowerCase()
  const desc = (params.errorDescription ?? '').toLowerCase()
  if (code === 'otp_expired' || desc.includes('expired')) {
    return 'otp_expired'
  }
  if (code === 'access_denied' || params.error === 'access_denied') {
    return 'access_denied'
  }
  return 'other'
}

export function messageForRecoveryLinkError(kind: RecoveryLinkErrorKind): string {
  switch (kind) {
    case 'otp_expired':
      return 'Poveznica za reset lozinke je istekla ili je već iskorištena. Zatražite novu poveznicu.'
    case 'access_denied':
      return 'Pristup preko poveznice za reset nije dopušten. Zatražite novu poveznicu.'
    case 'other':
      return 'Poveznica za reset lozinke nije valjana. Zatražite novu poveznicu.'
    default:
      return 'Poveznica za reset lozinke nije valjana. Zatražite novu poveznicu.'
  }
}

/** Generic copy — does not reveal whether the email exists. */
export const PASSWORD_RESET_REQUEST_GENERIC_SUCCESS =
  'Ako postoji administratorski račun s tom adresom, poslali smo upute za reset lozinke. Provjerite e-poštu.'
