import {
  WEB_ATELIER_BUDGETS,
  WEB_ATELIER_CONTACT,
  WEB_ATELIER_FEATURES,
  WEB_ATELIER_FLEXIBILITY,
  WEB_ATELIER_GOALS,
  WEB_ATELIER_MOODS,
  WEB_ATELIER_PACKAGES,
  WEB_ATELIER_PROJECT_TYPES,
  WEB_ATELIER_READY,
  WEB_ATELIER_REFERRALS,
} from './webAtelierOptions.ts'

export const PUBLIC_ERRORS = ['captcha_failed', 'rate_limited', 'invalid_payload', 'unavailable'] as const
export type PublicErrorCode = (typeof PUBLIC_ERRORS)[number]

export const PRODUCTION_TURNSTILE_HOST = 'anislrc.hr'
export const WWW_TURNSTILE_HOST = 'www.anislrc.hr'
export const DEV_TURNSTILE_HOSTS = ['localhost', '127.0.0.1'] as const
/**
 * Cloudflare's documented dummy hostname for always-pass test keys
 * (secret/sitekey `1x0000000000000000000000000000000AA`).
 * Accepted ONLY when `allowDevHosts` is already true — and that flag is
 * gated by `resolveDevHostAccess` to local Supabase hosts, so it cannot
 * activate against production (`*.supabase.co` / anislrc).
 */
export const CLOUDFLARE_TURNSTILE_DUMMY_HOSTNAME = 'example.com'

export const PRODUCTION_BROWSER_ORIGINS = ['https://anislrc.hr', 'https://www.anislrc.hr'] as const

export const DEV_BROWSER_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
] as const

export const ALLOWED_BROWSER_ORIGINS = [...PRODUCTION_BROWSER_ORIGINS, ...DEV_BROWSER_ORIGINS] as const

const LOCAL_SUPABASE_HOSTS = ['localhost', '127.0.0.1', 'kong'] as const

export const MAX_INQUIRY_BODY_BYTES = 48_000

const BODY_KEYS = [
  'idempotencyKey',
  'language',
  'packagePreference',
  'contactName',
  'email',
  'phone',
  'existingWebsite',
  'referral',
  'projectTypes',
  'projectTypesOther',
  'goals',
  'goalsOther',
  'contentReady',
  'visualsReady',
  'contentLinks',
  'designMood',
  'designMoodOther',
  'designInspiration',
  'features',
  'featuresOther',
  'featuresNotes',
  'budgetRange',
  'launchDeadline',
  'deadlineFlexibility',
  'contactPreference',
  'contactTime',
  'extraNotes',
  'turnstileToken',
] as const

export interface InquirySubmission {
  idempotencyKey: string
  language: 'hr' | 'en'
  packagePreference: 'start' | 'pro' | 'premium' | null
  contactName: string
  email: string
  phone: string | null
  existingWebsite: string | null
  referral: 'google' | 'social' | 'recommendation' | 'other' | null
  projectTypes: string[]
  projectTypesOther: string | null
  goals: string[]
  goalsOther: string | null
  contentReady: 'yes' | 'partial' | 'no' | null
  visualsReady: 'yes' | 'partial' | 'no' | null
  contentLinks: string | null
  designMood: string[]
  designMoodOther: string | null
  designInspiration: string | null
  features: string[]
  featuresOther: string | null
  featuresNotes: string | null
  budgetRange: 'under-1000' | '1000-3000' | '3000-7000' | '7000+'
  launchDeadline: string | null
  deadlineFlexibility: 'fixed' | 'flexible' | 'very-flexible' | null
  contactPreference: 'email' | 'phone' | 'whatsapp' | 'viber'
  contactTime: string | null
  extraNotes: string
  turnstileToken: string
}

export interface TurnstileHostPolicy {
  allowWww: boolean
  allowDevHosts: boolean
}

export interface SiteverifyResult {
  success?: boolean
  hostname?: string
  'error-codes'?: string[]
}

export type SiteverifyDecision = 'submit' | 'confirm' | 'captcha_failed'

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function hmacSha256Hex(pepper: string, message: string): Promise<string> {
  if (!pepper) {
    throw new Error('missing_pepper')
  }
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function isAllowedTurnstileHostname(
  hostname: string | undefined,
  policy: TurnstileHostPolicy,
): boolean {
  if (!hostname) return false
  const host = hostname.trim().toLowerCase()
  if (host === PRODUCTION_TURNSTILE_HOST) return true
  if (policy.allowWww && host === WWW_TURNSTILE_HOST) return true
  if (policy.allowDevHosts) {
    if ((DEV_TURNSTILE_HOSTS as readonly string[]).includes(host)) return true
    // Local-only: Cloudflare always-pass dummy keys report this hostname.
    if (host === CLOUDFLARE_TURNSTILE_DUMMY_HOSTNAME) return true
  }
  return false
}

export function decideSiteverify(
  result: SiteverifyResult,
  policy: TurnstileHostPolicy,
): SiteverifyDecision {
  const codes = Array.isArray(result['error-codes']) ? result['error-codes'] : []
  if (codes.includes('timeout-or-duplicate')) {
    return codes.length === 1 ? 'confirm' : 'captcha_failed'
  }
  if (result.success === true) {
    return isAllowedTurnstileHostname(result.hostname, policy) ? 'submit' : 'captcha_failed'
  }
  return 'captcha_failed'
}

export function resolveDevHostAccess(supabaseUrl: string, flagEnabled: boolean): boolean {
  if (flagEnabled !== true) return false
  try {
    const host = new URL(supabaseUrl).hostname.toLowerCase()
    return (LOCAL_SUPABASE_HOSTS as readonly string[]).includes(host)
  } catch {
    return false
  }
}

export function mapGatewayMessage(message: string | undefined): PublicErrorCode {
  const text = message ?? ''
  if (text.includes('rate_limited')) return 'rate_limited'
  if (
    text.includes('web_atelier_gateway:') ||
    text.includes('create_public_web_atelier_inquiry:') ||
    text.includes('retry_unavailable') ||
    text.includes('različit sadržaj')
  ) {
    return 'invalid_payload'
  }
  return 'unavailable'
}

export function isAllowedBrowserOrigin(origin: string | null, allowDevOrigins: boolean): boolean {
  if (!origin) return false
  if ((PRODUCTION_BROWSER_ORIGINS as readonly string[]).includes(origin)) return true
  return allowDevOrigins && (DEV_BROWSER_ORIGINS as readonly string[]).includes(origin)
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNullableString(value: unknown, max: number): string | null | undefined {
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  if (value.length > max) return undefined
  return blankToNull(value)
}

function asChoice<T extends string>(value: unknown, allowed: readonly T[], max: number): T | null | undefined {
  const text = asNullableString(value, max)
  if (text === undefined) return undefined
  if (text === null) return null
  return (allowed as readonly string[]).includes(text) ? (text as T) : undefined
}

function asStringArray(value: unknown, allowed: readonly string[], maxItems: number): string[] | undefined {
  if (!Array.isArray(value) || value.length > maxItems) return undefined
  const unique: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.includes(item)) return undefined
    if (!unique.includes(item)) unique.push(item)
  }
  unique.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  return unique
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isEmailShape(email: string): boolean {
  const at = email.indexOf('@')
  if (at < 1 || email.length > 320) return false
  const domain = email.slice(at + 1)
  return domain.includes('.')
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  if (value < '2000-01-01' || value > '2100-01-01') return false
  const [year, month, day] = value.split('-').map((part) => Number(part))
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function parseInquiryBody(raw: unknown): InquirySubmission | null {
  if (!isRecord(raw)) return null
  const keys = Object.keys(raw)
  if (keys.length !== BODY_KEYS.length || BODY_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(raw, key))) {
    return null
  }

  if (typeof raw.idempotencyKey !== 'string' || !isUuid(raw.idempotencyKey)) return null
  if (raw.language !== 'hr' && raw.language !== 'en') return null
  const packagePreference = asChoice(raw.packagePreference, WEB_ATELIER_PACKAGES, 20)
  if (packagePreference === undefined) return null
  const contactName = asNullableString(raw.contactName, 200)
  if (!contactName) return null
  const email = asNullableString(raw.email, 320)
  if (!email) return null
  const normalizedEmail = normalizeEmail(email)
  if (!isEmailShape(normalizedEmail)) return null
  const phone = asNullableString(raw.phone, 40)
  if (phone === undefined) return null
  const existingWebsite = asNullableString(raw.existingWebsite, 500)
  if (existingWebsite === undefined) return null
  const referral = asChoice(raw.referral, WEB_ATELIER_REFERRALS, 40)
  if (referral === undefined) return null
  const projectTypes = asStringArray(raw.projectTypes, WEB_ATELIER_PROJECT_TYPES, 12)
  if (!projectTypes || projectTypes.length < 1) return null
  const projectTypesOther = asNullableString(raw.projectTypesOther, 500)
  if (projectTypesOther === undefined) return null
  const goals = asStringArray(raw.goals, WEB_ATELIER_GOALS, 12)
  if (!goals) return null
  const goalsOther = asNullableString(raw.goalsOther, 500)
  if (goalsOther === undefined) return null
  const contentReady = asChoice(raw.contentReady, WEB_ATELIER_READY, 20)
  if (contentReady === undefined) return null
  const visualsReady = asChoice(raw.visualsReady, WEB_ATELIER_READY, 20)
  if (visualsReady === undefined) return null
  const contentLinks = asNullableString(raw.contentLinks, 2000)
  if (contentLinks === undefined) return null
  const designMood = asStringArray(raw.designMood, WEB_ATELIER_MOODS, 8)
  if (!designMood) return null
  const designMoodOther = asNullableString(raw.designMoodOther, 500)
  if (designMoodOther === undefined) return null
  const designInspiration = asNullableString(raw.designInspiration, 4000)
  if (designInspiration === undefined) return null
  const features = asStringArray(raw.features, WEB_ATELIER_FEATURES, 16)
  if (!features) return null
  const featuresOther = asNullableString(raw.featuresOther, 500)
  if (featuresOther === undefined) return null
  const featuresNotes = asNullableString(raw.featuresNotes, 4000)
  if (featuresNotes === undefined) return null
  const budgetRange = asChoice(raw.budgetRange, WEB_ATELIER_BUDGETS, 20)
  if (!budgetRange) return null
  const launchDeadline = asNullableString(raw.launchDeadline, 10)
  if (launchDeadline === undefined) return null
  if (launchDeadline !== null && !isIsoDate(launchDeadline)) return null
  const deadlineFlexibility = asChoice(raw.deadlineFlexibility, WEB_ATELIER_FLEXIBILITY, 20)
  if (deadlineFlexibility === undefined) return null
  const contactPreference = asChoice(raw.contactPreference, WEB_ATELIER_CONTACT, 20)
  if (!contactPreference) return null
  const contactTime = asNullableString(raw.contactTime, 200)
  if (contactTime === undefined) return null
  const extraNotes = asNullableString(raw.extraNotes, 10000)
  if (!extraNotes || extraNotes.length < 10) return null
  if (typeof raw.turnstileToken !== 'string') return null
  const turnstileToken = raw.turnstileToken.trim()
  if (turnstileToken.length < 10 || turnstileToken.length > 2048) return null

  return {
    idempotencyKey: raw.idempotencyKey.toLowerCase(),
    language: raw.language,
    packagePreference,
    contactName,
    email: normalizedEmail,
    phone,
    existingWebsite,
    referral,
    projectTypes,
    projectTypesOther,
    goals,
    goalsOther,
    contentReady,
    visualsReady,
    contentLinks,
    designMood,
    designMoodOther,
    designInspiration,
    features,
    featuresOther,
    featuresNotes,
    budgetRange,
    launchDeadline,
    deadlineFlexibility,
    contactPreference,
    contactTime,
    extraNotes,
    turnstileToken,
  }
}

export function confirmationFromRpc(data: unknown): { inquiryId: string; referenceCode: string } | null {
  if (!isRecord(data)) return null
  const inquiryId = data.inquiry_id
  const referenceCode = data.reference_code
  if (typeof inquiryId !== 'string' || typeof referenceCode !== 'string') return null
  if (!isUuid(inquiryId)) return null
  if (!/^WA-\d{4}-\d{6,}$/.test(referenceCode)) return null
  return { inquiryId, referenceCode }
}
