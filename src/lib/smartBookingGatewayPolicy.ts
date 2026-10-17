// F2.6 booking Edge gateway — validation + public error mapping (no secrets).

import {
  decideSiteverify,
  isAllowedBrowserOrigin,
  normalizeEmail,
  resolveDevHostAccess,
  type SiteverifyResult,
  type TurnstileHostPolicy,
} from './webAtelierGatewayPolicy.ts'

export const BOOKING_PUBLIC_ERRORS = [
  'captcha_failed',
  'rate_limited',
  'invalid_payload',
  'unavailable',
  'slot_unavailable',
] as const

export type BookingPublicErrorCode = (typeof BOOKING_PUBLIC_ERRORS)[number]

export const MAX_BOOKING_BODY_BYTES = 12_000

const DEPARTMENTS = ['web_atelier', 'interiors', 'lrc'] as const

export interface BookingSubmission {
  department: (typeof DEPARTMENTS)[number]
  windowId: string
  contactName: string
  contactEmail: string
  contactPhone: string
  description: string
  idempotencyKey: string
  turnstileToken: string
  entityKind: 'booking_lead' | 'web_atelier_inquiry' | 'interiors_inquiry' | 'lrc_inquiry'
  entityId: string | null
  language: 'hr' | 'en'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function isEmailShape(email: string): boolean {
  const at = email.indexOf('@')
  if (at < 1 || email.length > 320) return false
  return email.slice(at + 1).includes('.')
}

export function parseBookingBody(raw: unknown): BookingSubmission | null {
  if (!isRecord(raw)) return null

  const department = raw.department
  if (typeof department !== 'string' || !(DEPARTMENTS as readonly string[]).includes(department)) {
    return null
  }

  if (typeof raw.windowId !== 'string' || !isUuid(raw.windowId)) return null
  if (typeof raw.idempotencyKey !== 'string' || !isUuid(raw.idempotencyKey)) return null

  if (typeof raw.contactName !== 'string') return null
  const contactName = raw.contactName.trim()
  if (contactName.length < 2 || contactName.length > 120) return null

  if (typeof raw.contactEmail !== 'string') return null
  const contactEmail = normalizeEmail(raw.contactEmail)
  if (!isEmailShape(contactEmail) || contactEmail.length > 254) return null

  if (typeof raw.contactPhone !== 'string') return null
  const contactPhone = raw.contactPhone.trim()
  if (contactPhone.length < 5 || contactPhone.length > 40) return null

  if (typeof raw.description !== 'string') return null
  const description = raw.description.trim()
  if (description.length < 10 || description.length > 4000) return null

  if (typeof raw.turnstileToken !== 'string') return null
  const turnstileToken = raw.turnstileToken.trim()
  if (turnstileToken.length < 10 || turnstileToken.length > 2048) return null

  const language = raw.language === 'en' ? 'en' : raw.language === 'hr' ? 'hr' : null
  if (!language) return null

  let entityKind: BookingSubmission['entityKind'] = 'booking_lead'
  let entityId: string | null = null
  if (raw.entityKind != null) {
    if (
      raw.entityKind !== 'booking_lead' &&
      raw.entityKind !== 'web_atelier_inquiry' &&
      raw.entityKind !== 'interiors_inquiry' &&
      raw.entityKind !== 'lrc_inquiry'
    ) {
      return null
    }
    entityKind = raw.entityKind
  }
  if (raw.entityId != null) {
    if (typeof raw.entityId !== 'string' || !isUuid(raw.entityId)) return null
    entityId = raw.entityId.toLowerCase()
  }
  if (entityKind === 'booking_lead') {
    entityId = null
  } else if (!entityId) {
    return null
  }

  return {
    department: department as BookingSubmission['department'],
    windowId: raw.windowId.toLowerCase(),
    contactName,
    contactEmail,
    contactPhone,
    description,
    idempotencyKey: raw.idempotencyKey.toLowerCase(),
    turnstileToken,
    entityKind,
    entityId,
    language,
  }
}

export function mapBookingRpcMessage(message: string | undefined): BookingPublicErrorCode {
  const text = (message ?? '').toLowerCase()
  if (text.includes('rate_limited') || text.includes('booking_rate_limited')) return 'rate_limited'
  if (
    text.includes('booking_slot_unavailable') ||
    text.includes('capacity_exceeded') ||
    text.includes('shared_consultation_capacity') ||
    text.includes('closed_period') ||
    text.includes('booking_slot_stale') ||
    text.includes('outside_window')
  ) {
    return 'slot_unavailable'
  }
  if (
    text.includes('booking_') ||
    text.includes('invalid') ||
    text.includes('required') ||
    text.includes('idempotency')
  ) {
    return 'invalid_payload'
  }
  return 'unavailable'
}

export function bookingSiteverifyOk(
  result: SiteverifyResult,
  policy: TurnstileHostPolicy,
): boolean {
  // Booking does not use WA confirm/retry — require a fresh successful verify.
  return decideSiteverify(result, policy) === 'submit'
}

export function bookingCorsAllowed(origin: string | null, allowDevOrigins: boolean): boolean {
  return isAllowedBrowserOrigin(origin, allowDevOrigins)
}

export { resolveDevHostAccess }
