import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildWebAtelierInquiryUpdate } from '../src/lib/webAtelierAdmin.ts'
import { handleInquiryRequest, type GatewayEnv } from '../src/lib/webAtelierEdgeHandler.ts'
import {
  canonicalSubmission,
  draftToWire,
  inquiryErrorMessage,
  inquiryFingerprint,
  readStoredIdempotency,
  rememberIdempotency,
  resolveIdempotencyKey,
  type WebAtelierDraft,
} from '../src/lib/webAtelierInquiry.ts'
import { hmacSha256Hex, parseInquiryBody, resolveDevHostAccess } from '../src/lib/webAtelierGatewayPolicy.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const INQUIRY_ID = '11111111-1111-4111-8111-111111111111'
const IDEMPOTENCY_KEY = '22222222-2222-4222-8222-222222222222'
const REFERENCE = 'WA-2026-000001'

const draft: WebAtelierDraft = {
  language: 'hr',
  packagePreference: 'pro',
  fullNameOrCompany: '  Ana Studio  ',
  email: '  Ana@Example.com ',
  phone: '  ',
  existingWebsite: '',
  referral: 'google',
  projectTypes: ['Drugo', 'Web shop'],
  projectTypesOther: ' portal ',
  goals: ['Dobiti upite (leadove)'],
  goalsOther: '',
  contentReady: 'partial',
  visualsReady: '',
  contentLinks: '',
  designMood: ['Minimalistički', 'Drugo'],
  designMoodOther: ' toplo ',
  designInspiration: '',
  features: ['Blog / novosti'],
  featuresOther: '',
  featuresNotes: '',
  budgetRange: '1000-3000',
  launchDeadline: '2026-12-01',
  deadlineFlexibility: 'flexible',
  contactPreference: 'email',
  contactTime: '',
  extraNotes: 'Trebam novu stranicu za studio.',
}

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

function env(overrides: Partial<GatewayEnv> = {}): GatewayEnv {
  return {
    supabaseUrl: 'https://cpvofgaknmgnmusypoev.supabase.co',
    serviceRoleKey: 'service-role-test',
    turnstileSecret: 'turnstile-secret-test',
    rateLimitPepper: 'pepper-test',
    allowWww: false,
    allowDevHosts: false,
    ...overrides,
  }
}

function request(body: unknown, init: { method?: string; origin?: string; contentType?: string } = {}) {
  const method = init.method ?? 'POST'
  const headers = new Headers()
  if (init.origin) headers.set('Origin', init.origin)
  if (method !== 'GET' && method !== 'OPTIONS') {
    headers.set('content-type', init.contentType ?? 'application/json')
  }
  return new Request('https://cpvofgaknmgnmusypoev.supabase.co/functions/v1/submit-web-atelier-inquiry', {
    method,
    headers,
    body: method === 'GET' || method === 'OPTIONS' ? undefined : JSON.stringify(body),
  })
}

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body: string
}

function mockFetch(script: Array<(call: Call) => Response>) {
  const calls: Call[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    const headers = new Headers(init?.headers)
    const rawBody = init?.body
    const body =
      typeof rawBody === 'string'
        ? rawBody
        : rawBody instanceof URLSearchParams
          ? rawBody.toString()
          : ''
    const call: Call = {
      url,
      method: init?.method ?? 'GET',
      headers: Object.fromEntries(headers.entries()),
      body,
    }
    calls.push(call)
    const next = script[calls.length - 1]
    if (!next) throw new Error(`unexpected fetch ${url}`)
    return next(call)
  }
  return { calls, fetchImpl }
}

function rpcOk(data: unknown) {
  return () => new Response(JSON.stringify(data), { status: 200 })
}

function rpcError(message: string, status = 400) {
  return () => new Response(JSON.stringify({ message }), { status })
}

function siteverify(data: unknown, status = 200) {
  return () => new Response(JSON.stringify(data), { status })
}

async function submit(deps: { env: GatewayEnv | null; fetchImpl: typeof fetch }, body?: unknown) {
  const wire = body ?? draftToWire(draft, IDEMPOTENCY_KEY, 'turnstile-token-ok')
  const response = await handleInquiryRequest(request(wire, { origin: 'https://anislrc.hr' }), deps)
  return { status: response.status, json: (await response.json()) as Record<string, unknown> }
}

const submission = canonicalSubmission(draft)
assert.ok(submission)
assert.equal(submission.email, 'ana@example.com')
assert.equal(submission.contactName, 'Ana Studio')
assert.equal(submission.packagePreference, 'pro')
assert.equal(submission.language, 'hr')
assert.deepEqual(submission.projectTypes, ['Drugo', 'Web shop'].sort((a, b) => (a < b ? -1 : 1)))
assert.equal(submission.phone, null)
assert.equal(submission.projectTypesOther, 'portal')
assert.equal(submission.budgetRange, '1000-3000')
assert.equal(submission.launchDeadline, '2026-12-01')

const firstFingerprint = inquiryFingerprint(submission)
const samePayload = canonicalSubmission({ ...draft, email: 'ANA@example.com' })
assert.ok(samePayload)
assert.equal(inquiryFingerprint(samePayload), firstFingerprint)
const changed = canonicalSubmission({ ...draft, extraNotes: 'Drugačiji opis projekta.' })
assert.ok(changed)
assert.notEqual(inquiryFingerprint(changed), firstFingerprint)

const reused = resolveIdempotencyKey(
  { fingerprint: firstFingerprint, key: IDEMPOTENCY_KEY },
  firstFingerprint,
  '33333333-3333-4333-8333-333333333333',
)
assert.equal(reused.key, IDEMPOTENCY_KEY)
const regenerated = resolveIdempotencyKey(reused, inquiryFingerprint(changed), '33333333-3333-4333-8333-333333333333')
assert.equal(regenerated.key, '33333333-3333-4333-8333-333333333333')

const memory = new Map<string, string>()
const storage: Storage = {
  get length() {
    return memory.size
  },
  clear: () => memory.clear(),
  getItem: (key) => memory.get(key) ?? null,
  key: (index) => [...memory.keys()][index] ?? null,
  removeItem: (key) => {
    memory.delete(key)
  },
  setItem: (key, value) => {
    memory.set(key, value)
  },
}
rememberIdempotency(storage, reused)
const afterTimeout = resolveIdempotencyKey(
  readStoredIdempotency(storage),
  firstFingerprint,
  '55555555-5555-4555-8555-555555555555',
)
assert.equal(afterTimeout.key, IDEMPOTENCY_KEY)
const afterEdit = resolveIdempotencyKey(
  readStoredIdempotency(storage),
  inquiryFingerprint(changed),
  '55555555-5555-4555-8555-555555555555',
)
assert.equal(afterEdit.key, '55555555-5555-4555-8555-555555555555')
assert.notEqual(inquiryErrorMessage('rate_limited', 'hr'), inquiryErrorMessage('rate_limited', 'en'))
assert.notEqual(inquiryErrorMessage('captcha_failed', 'hr'), inquiryErrorMessage('unavailable', 'hr'))

const nodeHash = createHmac('sha256', 'pepper-test').update('ana@example.com').digest('hex')
assert.equal(await hmacSha256Hex('pepper-test', 'ana@example.com'), nodeHash)

const wire = draftToWire(draft, IDEMPOTENCY_KEY, 'turnstile-token-ok')
assert.equal(parseInquiryBody({ ...wire, emailHash: nodeHash }), null)
assert.equal(parseInquiryBody({ ...wire, remoteip: '1.2.3.4' }), null)

const success = mockFetch([
  rpcOk(null),
  siteverify({ success: true, hostname: 'anislrc.hr', 'error-codes': [] }),
  rpcOk({ inquiry_id: INQUIRY_ID, reference_code: REFERENCE }),
])
const successResult = await submit({ env: env(), fetchImpl: success.fetchImpl })
assert.equal(successResult.status, 200)
assert.deepEqual(successResult.json, { inquiryId: INQUIRY_ID, referenceCode: REFERENCE })
assert.equal(success.calls.length, 3)
assert.match(success.calls[0].url, /\/rpc\/reserve_web_atelier_captcha_attempt$/)
assert.equal(success.calls[1].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
assert.match(success.calls[2].url, /\/rpc\/submit_web_atelier_inquiry$/)
assert.equal(success.calls[1].body.includes('remoteip'), false)
assert.match(success.calls[1].body, /secret=turnstile-secret-test/)
assert.equal(success.calls[1].headers.authorization, undefined)
assert.equal(success.calls[0].headers.authorization, 'Bearer service-role-test')
assert.equal(success.calls[2].headers.authorization, 'Bearer service-role-test')
const submittedBody = JSON.parse(success.calls[2].body) as { p_email: string; p_email_hash: string; p_package_preference: string }
assert.equal(submittedBody.p_email, 'ana@example.com')
assert.equal(submittedBody.p_email_hash, nodeHash)
assert.equal(submittedBody.p_email_hash, await hmacSha256Hex('pepper-test', submittedBody.p_email))
assert.equal(submittedBody.p_package_preference, 'pro')

const invalid = mockFetch([
  rpcOk(null),
  siteverify({ success: false, 'error-codes': ['invalid-input-response'] }),
])
const invalidResult = await submit({ env: env(), fetchImpl: invalid.fetchImpl })
assert.equal(invalidResult.status, 400)
assert.deepEqual(invalidResult.json, { error: 'captcha_failed' })
assert.equal(invalid.calls.length, 2)

const expired = mockFetch([
  rpcOk(null),
  siteverify({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
  rpcOk({ inquiry_id: INQUIRY_ID, reference_code: REFERENCE }),
])
const expiredResult = await submit({ env: env(), fetchImpl: expired.fetchImpl })
assert.equal(expiredResult.status, 200)
assert.deepEqual(Object.keys(expiredResult.json).sort(), ['inquiryId', 'referenceCode'])
assert.match(expired.calls[2].url, /\/rpc\/confirm_web_atelier_inquiry_retry$/)
assert.equal(expired.calls[2].body.includes('p_email_hash'), false)
assert.equal(JSON.parse(expired.calls[2].body).p_idempotency_key, IDEMPOTENCY_KEY)
assert.equal(expired.calls.some((call) => call.url.includes('submit_web_atelier_inquiry')), false)

const replayedSuccessFlag = mockFetch([
  rpcOk(null),
  siteverify({ success: true, hostname: 'anislrc.hr', 'error-codes': ['timeout-or-duplicate'] }),
  rpcOk({ inquiry_id: INQUIRY_ID, reference_code: REFERENCE }),
])
const replayedSuccessResult = await submit({ env: env(), fetchImpl: replayedSuccessFlag.fetchImpl })
assert.equal(replayedSuccessResult.status, 200)
assert.deepEqual(replayedSuccessResult.json, { inquiryId: INQUIRY_ID, referenceCode: REFERENCE })
assert.match(replayedSuccessFlag.calls[2].url, /confirm_web_atelier_inquiry_retry$/)
assert.equal(replayedSuccessFlag.calls.some((call) => call.url.includes('submit_web_atelier_inquiry')), false)

const replayedOtherKey = mockFetch([
  rpcOk(null),
  siteverify({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
  rpcError('web_atelier_gateway: retry_unavailable'),
])
const otherKeyResult = await submit(
  { env: env(), fetchImpl: replayedOtherKey.fetchImpl },
  draftToWire(draft, '44444444-4444-4444-8444-444444444444', 'turnstile-token-ok'),
)
assert.deepEqual(otherKeyResult.json, { error: 'captcha_failed' })
assert.equal(replayedOtherKey.calls.some((call) => call.url.includes('submit_web_atelier_inquiry')), false)

const confirmMismatch = mockFetch([
  rpcOk(null),
  siteverify({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
  rpcError('web_atelier_gateway: različit sadržaj'),
])
const mismatchResult = await submit({ env: env(), fetchImpl: confirmMismatch.fetchImpl })
assert.deepEqual(mismatchResult.json, { error: 'captcha_failed' })

const missingRetry = mockFetch([
  rpcOk(null),
  siteverify({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
  rpcError('web_atelier_gateway: retry_unavailable'),
])
const missingRetryResult = await submit({ env: env(), fetchImpl: missingRetry.fetchImpl })
assert.deepEqual(missingRetryResult.json, { error: 'captcha_failed' })

const wrongHost = mockFetch([
  rpcOk(null),
  siteverify({ success: true, hostname: 'evil.example', 'error-codes': [] }),
])
const wrongHostResult = await submit({ env: env(), fetchImpl: wrongHost.fetchImpl })
assert.deepEqual(wrongHostResult.json, { error: 'captcha_failed' })
assert.equal(wrongHost.calls.length, 2)

const wwwBlocked = mockFetch([
  rpcOk(null),
  siteverify({ success: true, hostname: 'www.anislrc.hr', 'error-codes': [] }),
])
assert.deepEqual((await submit({ env: env(), fetchImpl: wwwBlocked.fetchImpl })).json, { error: 'captcha_failed' })

const wwwAllowed = mockFetch([
  rpcOk(null),
  siteverify({ success: true, hostname: 'www.anislrc.hr', 'error-codes': [] }),
  rpcOk({ inquiry_id: INQUIRY_ID, reference_code: REFERENCE }),
])
assert.equal((await submit({ env: env({ allowWww: true }), fetchImpl: wwwAllowed.fetchImpl })).status, 200)

const devBlocked = mockFetch([
  rpcOk(null),
  siteverify({ success: true, hostname: 'localhost', 'error-codes': [] }),
])
assert.deepEqual((await submit({ env: env(), fetchImpl: devBlocked.fetchImpl })).json, { error: 'captcha_failed' })

const devFlagOnProduction = mockFetch([
  rpcOk(null),
  siteverify({ success: true, hostname: 'localhost', 'error-codes': [] }),
])
assert.deepEqual(
  (await submit({ env: env({ allowDevHosts: true }), fetchImpl: devFlagOnProduction.fetchImpl })).json,
  { error: 'captcha_failed' },
)
assert.equal(devFlagOnProduction.calls.some((call) => call.url.includes('submit_web_atelier_inquiry')), false)
assert.equal(resolveDevHostAccess('https://cpvofgaknmgnmusypoev.supabase.co', true), false)
assert.equal(resolveDevHostAccess('http://127.0.0.1:54321', true), true)
assert.equal(resolveDevHostAccess('http://kong:8000', true), true)
assert.equal(resolveDevHostAccess('http://127.0.0.1:54321', false), false)

const cfDummyBlockedOnProd = mockFetch([
  rpcOk(null),
  siteverify({ success: true, hostname: 'example.com', 'error-codes': [] }),
])
assert.deepEqual(
  (await submit({ env: env({ allowDevHosts: true }), fetchImpl: cfDummyBlockedOnProd.fetchImpl })).json,
  { error: 'captcha_failed' },
)
assert.equal(
  cfDummyBlockedOnProd.calls.some((call) => call.url.includes('submit_web_atelier_inquiry')),
  false,
)

const cfDummyAllowedLocal = mockFetch([
  rpcOk(null),
  siteverify({ success: true, hostname: 'example.com', 'error-codes': [] }),
  rpcOk({ inquiry_id: INQUIRY_ID, reference_code: REFERENCE }),
])
assert.equal(
  (
    await submit({
      env: env({ allowDevHosts: true, supabaseUrl: 'http://127.0.0.1:54421' }),
      fetchImpl: cfDummyAllowedLocal.fetchImpl,
    })
  ).status,
  200,
)
assert.equal(
  cfDummyAllowedLocal.calls.some((call) => call.url.includes('submit_web_atelier_inquiry')),
  true,
)

const devAllowed = mockFetch([
  rpcOk(null),
  siteverify({ success: true, hostname: '127.0.0.1', 'error-codes': [] }),
  rpcOk({ inquiry_id: INQUIRY_ID, reference_code: REFERENCE }),
])
assert.equal(
  (
    await submit({
      env: env({ allowDevHosts: true, supabaseUrl: 'http://127.0.0.1:54321' }),
      fetchImpl: devAllowed.fetchImpl,
    })
  ).status,
  200,
)
const productionStillAllowed = mockFetch([
  rpcOk(null),
  siteverify({ success: true, hostname: 'anislrc.hr', 'error-codes': [] }),
  rpcOk({ inquiry_id: INQUIRY_ID, reference_code: REFERENCE }),
])
assert.equal(
  (await submit({ env: env({ allowDevHosts: true, allowWww: false }), fetchImpl: productionStillAllowed.fetchImpl })).status,
  200,
)

const quota = mockFetch([rpcError('web_atelier_gateway: rate_limited')])
const quotaResult = await submit({ env: env(), fetchImpl: quota.fetchImpl })
assert.equal(quotaResult.status, 429)
assert.deepEqual(quotaResult.json, { error: 'rate_limited' })
assert.equal(quota.calls.length, 1)

const submitQuota = mockFetch([
  rpcOk(null),
  siteverify({ success: true, hostname: 'anislrc.hr', 'error-codes': [] }),
  rpcError('web_atelier_gateway: rate_limited'),
])
const submitQuotaResult = await submit({ env: env(), fetchImpl: submitQuota.fetchImpl })
assert.equal(submitQuotaResult.status, 429)

const cloudflareDown = mockFetch([rpcOk(null), siteverify({ success: false }, 503)])
assert.deepEqual((await submit({ env: env(), fetchImpl: cloudflareDown.fetchImpl })).json, { error: 'unavailable' })

const badMethod = await handleInquiryRequest(request(wire, { method: 'GET', origin: 'https://anislrc.hr' }), {
  env: env(),
  fetchImpl: mockFetch([]).fetchImpl,
})
assert.equal(badMethod.status, 405)

const options = await handleInquiryRequest(request(null, { method: 'OPTIONS', origin: 'https://anislrc.hr' }), {
  env: env(),
  fetchImpl: mockFetch([]).fetchImpl,
})
assert.equal(options.status, 204)
assert.equal(options.headers.get('access-control-allow-origin'), 'https://anislrc.hr')

const foreign = await handleInquiryRequest(request(null, { method: 'OPTIONS', origin: 'https://evil.example' }), {
  env: env(),
  fetchImpl: mockFetch([]).fetchImpl,
})
assert.equal(foreign.status, 204)
assert.equal(foreign.headers.get('access-control-allow-origin'), null)

const localOriginOnProduction = await handleInquiryRequest(
  request(null, { method: 'OPTIONS', origin: 'http://localhost:5173' }),
  { env: env({ allowDevHosts: true }), fetchImpl: mockFetch([]).fetchImpl },
)
assert.equal(localOriginOnProduction.headers.get('access-control-allow-origin'), null)

const localOriginOnLocal = await handleInquiryRequest(
  request(null, { method: 'OPTIONS', origin: 'http://localhost:5173' }),
  {
    env: env({ allowDevHosts: true, supabaseUrl: 'http://127.0.0.1:54321' }),
    fetchImpl: mockFetch([]).fetchImpl,
  },
)
assert.equal(localOriginOnLocal.headers.get('access-control-allow-origin'), 'http://localhost:5173')

assert.deepEqual((await submit({ env: null, fetchImpl: mockFetch([]).fetchImpl })).json, { error: 'unavailable' })

const statusOnly = buildWebAtelierInquiryUpdate({ status: 'under_review', email: 'secret@example.com', extra_notes: 'no' })
assert.deepEqual(statusOnly, { status: 'under_review' })
assert.equal(buildWebAtelierInquiryUpdate({ status: 'published' }), null)
assert.deepEqual(buildWebAtelierInquiryUpdate({ risk_state: 'suspected' }), { risk_state: 'suspected' })
assert.deepEqual(buildWebAtelierInquiryUpdate({ archived_at: null }), { archived_at: null })
assert.equal(buildWebAtelierInquiryUpdate({ contact_name: 'Ana' }), null)

const clientFiles = [
  'src/components/WebProjectForm.tsx',
  'src/components/TurnstileWidget.tsx',
  'src/lib/webAtelierInquiry.ts',
  'src/lib/webAtelierSubmit.ts',
  'src/pages/WebAtelierInquiryPage.tsx',
]
const clientSource = clientFiles.map(read).join('\n')
for (const forbidden of [
  '.rpc(',
  'create_public_web_atelier_inquiry',
  'reserve_web_atelier_captcha_attempt',
  'confirm_web_atelier_inquiry_retry',
  'submit_web_atelier_inquiry',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TURNSTILE_SECRET_KEY',
  'RATE_LIMIT_PEPPER',
  '299',
  '499',
  '799',
  'webAtelierEdgeHandler',
]) {
  assert.equal(clientSource.includes(forbidden), false, forbidden)
}
assert.match(read('src/lib/webAtelierSubmit.ts'), /functions\/v1\/submit-web-atelier-inquiry/)
assert.equal(read('src/lib/webAtelierEdgeHandler.ts').includes('remoteip'), false)
assert.match(read('supabase/functions/submit-web-atelier-inquiry/index.ts'), /Deno\.serve/)
assert.match(read('supabase/config.toml'), /verify_jwt = false/)
assert.equal(read('supabase/config.toml').includes('cpvofgaknmgnmusypoev'), false)
assert.match(read('supabase/config.toml'), /project_id = "anis-studio"/)
assert.match(read('supabase/functions/submit-web-atelier-inquiry/index.ts'), /resolveDevHostAccess/)
assert.equal(read('supabase/functions/submit-web-atelier-inquiry/index.ts').includes('cpvofgaknmgnmusypoev'), false)
const formSource = read('src/components/WebProjectForm.tsx')
const failureBranch = formSource.indexOf('if (!result.ok)')
const successEvent = formSource.indexOf("trackEvent('form_submit_success'")
assert.ok(failureBranch > 0 && successEvent > failureBranch)
assert.equal(formSource.slice(0, failureBranch).includes("trackEvent('form_submit_success'"), false)
assert.match(read('src/App.tsx'), /path="\/interijeri"/)
assert.match(read('src/App.tsx'), /web-atelier-inquiries\/:id/)
assert.match(read('src/App.tsx'), /PublicServiceGuard service="webAtelier"/)
assert.match(read('src/App.tsx'), /<AdminRoute>/)
const appSource = read('src/App.tsx')
assert.equal(appSource.includes('web-atelier-test'), false)
assert.equal(appSource.includes('AdminWebAtelierTestPage'), false)
assert.equal(read('src/components/Header.tsx').includes('web-atelier-test'), false)
assert.equal(read('src/components/AdminNav.tsx').includes('web-atelier-test'), false)
assert.match(read('src/components/AdminRoute.tsx'), /isAdmin/)
assert.match(read('src/components/AdminRoute.tsx'), /Navigate to="\/admin\/login"/)
assert.equal(existsSync(join(root, 'src/pages/AdminWebAtelierTestPage.tsx')), false)
assert.match(read('src/components/AdminNav.tsx'), /web-atelier-inquiries/)
assert.match(read('src/components/WebProjectForm.tsx'), /form_submit_success/)
assert.equal(read('src/components/WebProjectForm.tsx').includes('addWebProjectRequest'), false)
assert.equal(read('src/components/WebProjectForm.tsx').includes('initialContact'), false)
assert.match(read('src/hooks/useSettings.ts'), /web_atelier_public_visible:\s*false/)
assert.match(read('src/App.tsx'), /path="web-atelier-inquiries"/)
assert.match(read('src/App.tsx'), /path="web-atelier-inquiries\/:id"/)
assert.match(read('src/App.tsx'), /path="web-atelier-offers"/)
assert.match(read('src/App.tsx'), /path="web-atelier-projects"/)
assert.equal(appSource.includes('accept-offer'), false)
assert.equal(appSource.includes('path="/ponuda"'), false)
const formUx = read('src/components/WebProjectForm.tsx')
assert.match(formUx, /web-atelier-inquiry-form/)
assert.match(formUx, /import '\.\/webProjectForm\.css'/)
assert.match(formUx, /submitWebAtelierInquiry/)
assert.match(formUx, /canonicalSubmission/)
// Contrast regression guard: the form is a self-contained light surface. Colours live in
// webProjectForm.css and must not depend on `html.dark` (dark: variants), on inherited colour,
// or on class substrings matched by global `.section-with-bg [class*="…"]` !important rules.
assert.equal(/dark:/.test(formUx), false, 'WebProjectForm must not use dark: variants')
assert.equal(/\b(bg-white|text-plum|text-pearl|text-slate)/.test(formUx), false)
assert.equal(formUx.includes('<style'), false)
const formCss = read('src/components/webProjectForm.css')
assert.match(formCss, /color-scheme:\s*light/)
assert.match(formCss, /\.wa-control/)
assert.match(formCss, /::placeholder/)
assert.match(formCss, /background-color:\s*#ffffff\s*!important/)
assert.equal(/html\.dark/.test(formCss.replace(/\/\*[\s\S]*?\*\//g, '')), false, 'css must not key colours on html.dark')

console.log('web-atelier inquiry tests passed')
