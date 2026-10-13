import {
  confirmationFromRpc,
  decideSiteverify,
  hmacSha256Hex,
  isAllowedBrowserOrigin,
  mapGatewayMessage,
  resolveDevHostAccess,
  MAX_INQUIRY_BODY_BYTES,
  normalizeEmail,
  parseInquiryBody,
  type InquirySubmission,
  type PublicErrorCode,
  type TurnstileHostPolicy,
} from './webAtelierGatewayPolicy.ts'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export interface GatewayEnv {
  supabaseUrl: string
  serviceRoleKey: string
  turnstileSecret: string
  rateLimitPepper: string
  allowWww: boolean
  allowDevHosts: boolean
}

export interface GatewayDeps {
  env: GatewayEnv | null
  fetchImpl: typeof fetch
}

function devOriginsOpen(env: GatewayEnv | null): boolean {
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
  if (isAllowedBrowserOrigin(origin, allowDevOrigins)) {
    headers.set('Access-Control-Allow-Origin', origin as string)
  }
  return headers
}

function jsonResponse(
  origin: string | null,
  status: number,
  body: { error: PublicErrorCode } | { inquiryId: string; referenceCode: string },
  allowDevOrigins: boolean,
): Response {
  const headers = corsHeaders(origin, allowDevOrigins)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { status, headers })
}

function errorStatus(code: PublicErrorCode): number {
  if (code === 'rate_limited') return 429
  if (code === 'unavailable') return 503
  return 400
}

async function readLimitedBody(req: Request): Promise<Uint8Array | null> {
  const declared = Number(req.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > MAX_INQUIRY_BODY_BYTES) return null
  if (!req.body) return null
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > MAX_INQUIRY_BODY_BYTES) {
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

function rpcArgs(submission: InquirySubmission, emailHash: string, includeHash: boolean) {
  const args: Record<string, unknown> = {
    p_idempotency_key: submission.idempotencyKey,
    p_language: submission.language,
    p_package_preference: submission.packagePreference,
    p_contact_name: submission.contactName,
    p_email: submission.email,
    p_phone: submission.phone,
    p_existing_website: submission.existingWebsite,
    p_referral: submission.referral,
    p_project_types: submission.projectTypes,
    p_project_types_other: submission.projectTypesOther,
    p_goals: submission.goals,
    p_goals_other: submission.goalsOther,
    p_content_ready: submission.contentReady,
    p_visuals_ready: submission.visualsReady,
    p_content_links: submission.contentLinks,
    p_design_mood: submission.designMood,
    p_design_mood_other: submission.designMoodOther,
    p_design_inspiration: submission.designInspiration,
    p_features: submission.features,
    p_features_other: submission.featuresOther,
    p_features_notes: submission.featuresNotes,
    p_budget_range: submission.budgetRange,
    p_launch_deadline: submission.launchDeadline,
    p_deadline_flexibility: submission.deadlineFlexibility,
    p_contact_preference: submission.contactPreference,
    p_contact_time: submission.contactTime,
    p_extra_notes: submission.extraNotes,
  }
  if (includeHash) args.p_email_hash = emailHash
  return args
}

async function postRpc(
  deps: GatewayDeps,
  env: GatewayEnv,
  name: 'reserve_web_atelier_captcha_attempt' | 'submit_web_atelier_inquiry' | 'confirm_web_atelier_inquiry_retry',
  args: Record<string, unknown>,
): Promise<{ ok: true; data: unknown } | { ok: false; code: PublicErrorCode }> {
  let response: Response
  try {
    response = await deps.fetchImpl(`${env.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: env.serviceRoleKey,
        Authorization: `Bearer ${env.serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    })
  } catch {
    return { ok: false, code: 'unavailable' }
  }

  const text = await response.text()
  if (response.ok) {
    if (!text) return { ok: true, data: null }
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
  console.error(JSON.stringify({ event: 'rpc_rejected', rpc: name, status: response.status }))
  return { ok: false, code: mapGatewayMessage(message) }
}

async function siteverify(
  deps: GatewayDeps,
  env: GatewayEnv,
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
      console.error(JSON.stringify({ event: 'siteverify_http', status: response.status }))
      return { ok: false }
    }
    return { ok: true, data: (await response.json()) as unknown }
  } catch {
    console.error(JSON.stringify({ event: 'siteverify_unreachable' }))
    return { ok: false }
  }
}

function hostPolicy(env: GatewayEnv): TurnstileHostPolicy {
  return {
    allowWww: env.allowWww,
    allowDevHosts: resolveDevHostAccess(env.supabaseUrl, env.allowDevHosts),
  }
}

export async function handleInquiryRequest(req: Request, deps: GatewayDeps): Promise<Response> {
  const origin = req.headers.get('Origin')
  const openDev = devOriginsOpen(deps.env)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin, openDev) })
  }
  if (req.method !== 'POST') {
    return jsonResponse(origin, 405, { error: 'invalid_payload' }, openDev)
  }
  if (!deps.env?.supabaseUrl || !deps.env.serviceRoleKey || !deps.env.turnstileSecret || !deps.env.rateLimitPepper) {
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
  const submission = parseInquiryBody(parsedJson)
  if (!submission) return jsonResponse(origin, 400, { error: 'invalid_payload' }, openDev)

  const emailHash = await hmacSha256Hex(env.rateLimitPepper, normalizeEmail(submission.email))
  const reserved = await postRpc(deps, env, 'reserve_web_atelier_captcha_attempt', {
    p_email_hash: emailHash,
  })
  if (!reserved.ok) {
    const code = reserved.code === 'rate_limited' ? 'rate_limited' : 'unavailable'
    return jsonResponse(origin, errorStatus(code), { error: code }, openDev)
  }

  const verified = await siteverify(deps, env, submission.turnstileToken)
  if (!verified.ok) {
    return jsonResponse(origin, 503, { error: 'unavailable' }, openDev)
  }
  if (typeof verified.data !== 'object' || verified.data === null) {
    return jsonResponse(origin, 400, { error: 'captcha_failed' }, openDev)
  }
  const decision = decideSiteverify(
    verified.data as { success?: boolean; hostname?: string; 'error-codes'?: string[] },
    hostPolicy(env),
  )

  if (decision === 'captcha_failed') {
    return jsonResponse(origin, 400, { error: 'captcha_failed' }, openDev)
  }

  if (decision === 'confirm') {
    const confirmed = await postRpc(
      deps,
      env,
      'confirm_web_atelier_inquiry_retry',
      rpcArgs(submission, emailHash, false),
    )
    if (!confirmed.ok) {
      const code = confirmed.code === 'unavailable' ? 'unavailable' : 'captcha_failed'
      return jsonResponse(origin, errorStatus(code), { error: code }, openDev)
    }
    const confirmation = confirmationFromRpc(confirmed.data)
    if (!confirmation) return jsonResponse(origin, 400, { error: 'captcha_failed' }, openDev)
    return jsonResponse(origin, 200, confirmation, openDev)
  }

  const submitted = await postRpc(
    deps,
    env,
    'submit_web_atelier_inquiry',
    rpcArgs(submission, emailHash, true),
  )
  if (!submitted.ok) {
    const code = submitted.code === 'rate_limited' || submitted.code === 'unavailable' ? submitted.code : 'invalid_payload'
    return jsonResponse(origin, errorStatus(code), { error: code }, openDev)
  }
  const confirmation = confirmationFromRpc(submitted.data)
  if (!confirmation) return jsonResponse(origin, 503, { error: 'unavailable' }, openDev)
  return jsonResponse(origin, 200, confirmation, openDev)
}
