// F2.6 booking Edge handler — Turnstile siteverify then service_role RPC.
// Never logs tokens, secrets, or PII.

import {
  resolveDevHostAccess,
  type TurnstileHostPolicy,
} from './webAtelierGatewayPolicy.ts'
import {
  MAX_BOOKING_BODY_BYTES,
  bookingCorsAllowed,
  bookingSiteverifyOk,
  mapBookingRpcMessage,
  parseBookingBody,
  type BookingPublicErrorCode,
  type BookingSubmission,
} from './smartBookingGatewayPolicy.ts'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export interface BookingGatewayEnv {
  supabaseUrl: string
  serviceRoleKey: string
  turnstileSecret: string
  allowWww: boolean
  allowDevHosts: boolean
}

export interface BookingGatewayDeps {
  env: BookingGatewayEnv | null
  fetchImpl: typeof fetch
}

type SuccessBody = {
  reservationId: string
  department: string
  startsAt: string
  endsAt: string
  replay: boolean
  noticeHr?: string
  noticeEn?: string
}

function devOriginsOpen(env: BookingGatewayEnv | null): boolean {
  if (!env) return false
  return resolveDevHostAccess(env.supabaseUrl, env.allowDevHosts)
}

function corsHeaders(origin: string | null, allowDevOrigins: boolean): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  })
  if (bookingCorsAllowed(origin, allowDevOrigins)) {
    headers.set('Access-Control-Allow-Origin', origin as string)
  }
  return headers
}

function jsonResponse(
  origin: string | null,
  status: number,
  body: { error: BookingPublicErrorCode } | SuccessBody,
  allowDevOrigins: boolean,
): Response {
  const headers = corsHeaders(origin, allowDevOrigins)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { status, headers })
}

function errorStatus(code: BookingPublicErrorCode): number {
  if (code === 'rate_limited') return 429
  if (code === 'unavailable') return 503
  if (code === 'slot_unavailable') return 409
  return 400
}

async function readLimitedBody(req: Request): Promise<Uint8Array | null> {
  const declared = Number(req.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > MAX_BOOKING_BODY_BYTES) return null
  if (!req.body) return null
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > MAX_BOOKING_BODY_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

function hostPolicy(env: BookingGatewayEnv): TurnstileHostPolicy {
  return {
    allowWww: env.allowWww,
    allowDevHosts: resolveDevHostAccess(env.supabaseUrl, env.allowDevHosts),
  }
}

async function siteverify(
  deps: BookingGatewayDeps,
  env: BookingGatewayEnv,
  token: string,
): Promise<{ ok: true; data: unknown } | { ok: false }> {
  const body = new URLSearchParams()
  body.set('secret', env.turnstileSecret)
  body.set('response', token)
  try {
    const response = await deps.fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!response.ok) {
      console.error(JSON.stringify({ event: 'booking_siteverify_http', status: response.status }))
      return { ok: false }
    }
    return { ok: true, data: (await response.json()) as unknown }
  } catch {
    console.error(JSON.stringify({ event: 'booking_siteverify_unreachable' }))
    return { ok: false }
  }
}

async function callBookRpc(
  deps: BookingGatewayDeps,
  env: BookingGatewayEnv,
  submission: BookingSubmission,
): Promise<
  | { ok: true; data: unknown }
  | { ok: false; code: BookingPublicErrorCode }
> {
  let response: Response
  try {
    response = await deps.fetchImpl(
      `${env.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/public_book_consultation_slot`,
      {
        method: 'POST',
        headers: {
          apikey: env.serviceRoleKey,
          Authorization: `Bearer ${env.serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_department: submission.department,
          p_window_id: submission.windowId,
          p_contact_name: submission.contactName,
          p_contact_email: submission.contactEmail,
          p_contact_phone: submission.contactPhone,
          p_description: submission.description,
          p_idempotency_key: submission.idempotencyKey,
          p_client_fingerprint: null,
          p_entity_kind: submission.entityKind,
          p_entity_id: submission.entityId,
        }),
      },
    )
  } catch {
    return { ok: false, code: 'unavailable' }
  }

  const text = await response.text()
  if (response.ok) {
    if (!text) return { ok: false, code: 'unavailable' }
    try {
      return { ok: true, data: JSON.parse(text) as unknown }
    } catch {
      return { ok: false, code: 'unavailable' }
    }
  }

  let message = ''
  try {
    const parsed = JSON.parse(text) as { message?: unknown }
    if (typeof parsed.message === 'string') message = parsed.message
  } catch {
    message = ''
  }
  console.error(
    JSON.stringify({
      event: 'booking_rpc_rejected',
      status: response.status,
    }),
  )
  return { ok: false, code: mapBookingRpcMessage(message) }
}

function successFromRpc(data: unknown): SuccessBody | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const row = data as Record<string, unknown>
  if (typeof row.reservation_id !== 'string') return null
  if (typeof row.department !== 'string') return null
  if (typeof row.starts_at !== 'string') return null
  if (typeof row.ends_at !== 'string') return null
  return {
    reservationId: row.reservation_id,
    department: row.department,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    replay: row.replay === true,
    noticeHr: typeof row.notice_hr === 'string' ? row.notice_hr : undefined,
    noticeEn: typeof row.notice_en === 'string' ? row.notice_en : undefined,
  }
}

export async function handleBookingRequest(
  req: Request,
  deps: BookingGatewayDeps,
): Promise<Response> {
  const origin = req.headers.get('Origin')
  const openDev = devOriginsOpen(deps.env)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin, openDev) })
  }
  if (req.method !== 'POST') {
    return jsonResponse(origin, 405, { error: 'invalid_payload' }, openDev)
  }
  if (!deps.env?.supabaseUrl || !deps.env.serviceRoleKey || !deps.env.turnstileSecret) {
    return jsonResponse(origin, 503, { error: 'unavailable' }, openDev)
  }
  const env = deps.env

  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return jsonResponse(origin, 400, { error: 'invalid_payload' }, openDev)
  }

  const bytes = await readLimitedBody(req)
  if (!bytes) return jsonResponse(origin, 400, { error: 'invalid_payload' }, openDev)

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    return jsonResponse(origin, 400, { error: 'invalid_payload' }, openDev)
  }

  const submission = parseBookingBody(parsedJson)
  if (!submission) return jsonResponse(origin, 400, { error: 'invalid_payload' }, openDev)

  const verified = await siteverify(deps, env, submission.turnstileToken)
  if (!verified.ok) {
    return jsonResponse(origin, 503, { error: 'unavailable' }, openDev)
  }
  if (typeof verified.data !== 'object' || verified.data === null) {
    return jsonResponse(origin, 400, { error: 'captcha_failed' }, openDev)
  }
  if (!bookingSiteverifyOk(verified.data as { success?: boolean; hostname?: string; 'error-codes'?: string[] }, hostPolicy(env))) {
    return jsonResponse(origin, 400, { error: 'captcha_failed' }, openDev)
  }

  const booked = await callBookRpc(deps, env, submission)
  if (!booked.ok) {
    return jsonResponse(origin, errorStatus(booked.code), { error: booked.code }, openDev)
  }
  const success = successFromRpc(booked.data)
  if (!success) return jsonResponse(origin, 503, { error: 'unavailable' }, openDev)
  return jsonResponse(origin, 200, success, openDev)
}
