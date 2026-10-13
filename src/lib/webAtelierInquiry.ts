import {
  parseInquiryBody,
  type InquirySubmission,
} from './webAtelierGatewayPolicy.ts'

const IDEMPOTENCY_STORAGE_KEY = 'web-atelier-inquiry-idempotency'
const DUMMY_KEY = '00000000-0000-4000-8000-000000000000'
const DUMMY_TOKEN = 'placeholder-token'

export interface WebAtelierDraft {
  language: 'hr' | 'en'
  packagePreference: 'start' | 'pro' | 'premium' | ''
  fullNameOrCompany: string
  email: string
  phone: string
  existingWebsite: string
  referral: string
  projectTypes: string[]
  projectTypesOther: string
  goals: string[]
  goalsOther: string
  contentReady: string
  visualsReady: string
  contentLinks: string
  designMood: string[]
  designMoodOther: string
  designInspiration: string
  features: string[]
  featuresOther: string
  featuresNotes: string
  budgetRange: string
  launchDeadline: string
  deadlineFlexibility: string
  contactPreference: string
  contactTime: string
  extraNotes: string
}

export interface StoredIdempotency {
  fingerprint: string
  key: string
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function draftToWire(draft: WebAtelierDraft, idempotencyKey: string, turnstileToken: string) {
  return {
    idempotencyKey,
    language: draft.language,
    packagePreference: draft.packagePreference || null,
    contactName: draft.fullNameOrCompany,
    email: draft.email,
    phone: emptyToNull(draft.phone),
    existingWebsite: emptyToNull(draft.existingWebsite),
    referral: emptyToNull(draft.referral),
    projectTypes: draft.projectTypes,
    projectTypesOther: emptyToNull(draft.projectTypesOther),
    goals: draft.goals,
    goalsOther: emptyToNull(draft.goalsOther),
    contentReady: emptyToNull(draft.contentReady),
    visualsReady: emptyToNull(draft.visualsReady),
    contentLinks: emptyToNull(draft.contentLinks),
    designMood: draft.designMood,
    designMoodOther: emptyToNull(draft.designMoodOther),
    designInspiration: emptyToNull(draft.designInspiration),
    features: draft.features,
    featuresOther: emptyToNull(draft.featuresOther),
    featuresNotes: emptyToNull(draft.featuresNotes),
    budgetRange: draft.budgetRange,
    launchDeadline: emptyToNull(draft.launchDeadline),
    deadlineFlexibility: emptyToNull(draft.deadlineFlexibility),
    contactPreference: draft.contactPreference,
    contactTime: emptyToNull(draft.contactTime),
    extraNotes: draft.extraNotes,
    turnstileToken,
  }
}

export function canonicalSubmission(draft: WebAtelierDraft): InquirySubmission | null {
  return parseInquiryBody(draftToWire(draft, DUMMY_KEY, DUMMY_TOKEN))
}

export function inquiryFingerprint(submission: InquirySubmission): string {
  const { idempotencyKey: _key, turnstileToken: _token, ...core } = submission
  void _key
  void _token
  return JSON.stringify(core)
}

export function resolveIdempotencyKey(
  stored: StoredIdempotency | null,
  fingerprint: string,
  nextKey: string,
): StoredIdempotency {
  if (stored && stored.fingerprint === fingerprint && stored.key) {
    return stored
  }
  return { fingerprint, key: nextKey }
}

export function readStoredIdempotency(storage: Storage | null): StoredIdempotency | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(IDEMPOTENCY_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredIdempotency>
    if (typeof parsed.fingerprint !== 'string' || typeof parsed.key !== 'string') return null
    return { fingerprint: parsed.fingerprint, key: parsed.key }
  } catch {
    return null
  }
}

export function rememberIdempotency(storage: Storage | null, value: StoredIdempotency): void {
  if (!storage) return
  try {
    storage.setItem(IDEMPOTENCY_STORAGE_KEY, JSON.stringify(value))
  } catch {
    /* private mode */
  }
}

export function inquiryErrorMessage(code: string, language: 'hr' | 'en'): string {
  const hr = language === 'hr'
  if (code === 'captcha_failed') {
    return hr
      ? 'Provjera nije uspjela. Potvrdi da nisi robot i pokušaj ponovo.'
      : 'The check failed. Confirm you are not a robot and try again.'
  }
  if (code === 'rate_limited') {
    return hr
      ? 'Previše pokušaja. Pričekaj malo i pokušaj ponovo.'
      : 'Too many attempts. Wait a moment and try again.'
  }
  if (code === 'invalid_payload') {
    return hr
      ? 'Provjeri unesene podatke i pokušaj ponovo.'
      : 'Check the entered details and try again.'
  }
  return hr
    ? 'Slanje trenutno nije dostupno. Pokušaj ponovo kasnije.'
    : 'Sending is unavailable right now. Try again later.'
}
