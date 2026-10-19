// F2.6 booking Edge handler tests — mock Turnstile + RPC (no network / no Deno).

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  handleBookingRequest,
  type BookingGatewayEnv,
} from '../src/lib/smartBookingEdgeHandler.ts'
import {
  parseBookingBody,
  bookingSiteverifyOk,
  mapBookingRpcMessage,
} from '../src/lib/smartBookingGatewayPolicy.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const WINDOW_ID = '11111111-1111-4111-8111-111111111111'
const IDEMPOTENCY_KEY = '22222222-2222-4222-8222-222222222222'
const RESERVATION_ID = '33333333-3333-4333-8333-333333333333'

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    department: 'interiors',
    windowId: WINDOW_ID,
    contactName: 'Ana Test',
    contactEmail: 'ana@example.com',
    contactPhone: '0912345678',
    description: 'Detaljan opis projekta za rezervaciju termina.',
    idempotencyKey: IDEMPOTENCY_KEY,
    turnstileToken: 'turnstile-token-ok-abcdefghij',
    language: 'hr',
    entityKind: 'booking_lead',
    entityId: null,
    ...overrides,
  }
}

function env(overrides: Partial<BookingGatewayEnv> = {}): BookingGatewayEnv {
  return {
    supabaseUrl: 'https://example.supabase.co',
    serviceRoleKey: 'service-role-test',
    turnstileSecret: 'turnstile-secret-test',
    allowWww: false,
    allowDevHosts: false,
    ...overrides,
  }
}

function request(body: unknown, init?: { origin?: string; method?: string }) {
  return new Request('https://example.supabase.co/functions/v1/book-consultation-slot', {
    method: init?.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: init?.origin ?? 'https://anislrc.hr',
    },
    body: JSON.stringify(body),
  })
}

type Call = { url: string; method: string; body: string }

function mockFetch(script: Array<(call: Call) => Response>) {
  const calls: Call[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    const rawBody = init?.body
    const body =
      typeof rawBody === 'string'
        ? rawBody
        : rawBody instanceof URLSearchParams
          ? rawBody.toString()
          : ''
    const call: Call = { url, method: init?.method ?? 'GET', body }
    calls.push(call)
    const next = script[calls.length - 1]
    if (!next) throw new Error(`unexpected fetch ${url}`)
    return next(call)
  }
  return { calls, fetchImpl }
}

function siteverify(data: unknown, status = 200) {
  return () => new Response(JSON.stringify(data), { status })
}

function rpcOk(data: unknown) {
  return () => new Response(JSON.stringify(data), { status: 200 })
}

function rpcError(message: string, status = 400) {
  return () => new Response(JSON.stringify({ message }), { status })
}

async function book(
  deps: { env: BookingGatewayEnv | null; fetchImpl: typeof fetch },
  body?: unknown,
) {
  const response = await handleBookingRequest(
    request(body ?? validBody(), { origin: 'https://anislrc.hr' }),
    deps,
  )
  return { status: response.status, json: (await response.json()) as Record<string, unknown> }
}

// --- Policy unit checks ---
const parsed = parseBookingBody(validBody())
assert.ok(parsed)
assert.equal(parsed.contactEmail, 'ana@example.com')
assert.equal(parseBookingBody(validBody({ turnstileToken: 'short' })), null)
assert.equal(parseBookingBody(validBody({ description: 'kratko' })), null)
assert.equal(parseBookingBody(validBody({ department: 'other' })), null)
assert.ok(parseBookingBody({ ...validBody(), extraField: true }))

assert.equal(
  bookingSiteverifyOk({ success: true, hostname: 'anislrc.hr', 'error-codes': [] }, {
    allowWww: false,
    allowDevHosts: false,
  }),
  true,
)
assert.equal(
  bookingSiteverifyOk({ success: false, 'error-codes': ['invalid-input-response'] }, {
    allowWww: false,
    allowDevHosts: false,
  }),
  false,
)
assert.equal(
  bookingSiteverifyOk(
    { success: true, hostname: 'anislrc.hr', 'error-codes': ['timeout-or-duplicate'] },
    { allowWww: false, allowDevHosts: false },
  ),
  false,
)
assert.equal(mapBookingRpcMessage('booking_slot_unavailable'), 'slot_unavailable')
assert.equal(mapBookingRpcMessage('booking_month_capacity_full'), 'slot_unavailable')
assert.equal(mapBookingRpcMessage('booking_rate_limited'), 'rate_limited')

// --- Handler flows ---
const success = mockFetch([
  siteverify({ success: true, hostname: 'anislrc.hr', 'error-codes': [] }),
  rpcOk({
    reservation_id: RESERVATION_ID,
    department: 'interiors',
    starts_at: '2027-01-15T09:00:00+00:00',
    ends_at: '2027-01-15T11:00:00+00:00',
    replay: false,
    notice_hr: 'Termin je rezerviran.',
  }),
])
const successResult = await book({ env: env(), fetchImpl: success.fetchImpl })
assert.equal(successResult.status, 200)
assert.equal(successResult.json.reservationId, RESERVATION_ID)
assert.equal(successResult.json.replay, false)
assert.equal(success.calls[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
assert.match(success.calls[1].url, /public_book_consultation_slot/)
assert.match(success.calls[0].body, /response=turnstile-token-ok/)
assert.doesNotMatch(success.calls[0].body, /ana@example\.com/)

const missingToken = await book(
  { env: env(), fetchImpl: mockFetch([]).fetchImpl },
  validBody({ turnstileToken: '' }),
)
assert.equal(missingToken.status, 400)
assert.equal(missingToken.json.error, 'invalid_payload')

const invalidCaptcha = mockFetch([
  siteverify({ success: false, 'error-codes': ['invalid-input-response'] }),
])
const invalidResult = await book({ env: env(), fetchImpl: invalidCaptcha.fetchImpl })
assert.equal(invalidResult.status, 400)
assert.equal(invalidResult.json.error, 'captcha_failed')
assert.equal(invalidCaptcha.calls.length, 1)

const expired = mockFetch([
  siteverify({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
])
const expiredResult = await book({ env: env(), fetchImpl: expired.fetchImpl })
assert.equal(expiredResult.status, 400)
assert.equal(expiredResult.json.error, 'captcha_failed')

const wrongHost = mockFetch([
  siteverify({ success: true, hostname: 'evil.example', 'error-codes': [] }),
])
const wrongHostResult = await book({ env: env(), fetchImpl: wrongHost.fetchImpl })
assert.equal(wrongHostResult.status, 400)
assert.equal(wrongHostResult.json.error, 'captcha_failed')

const noEnv = await book({ env: null, fetchImpl: mockFetch([]).fetchImpl })
assert.equal(noEnv.status, 503)
assert.equal(noEnv.json.error, 'unavailable')

const slotFull = mockFetch([
  siteverify({ success: true, hostname: 'anislrc.hr', 'error-codes': [] }),
  rpcError('booking_slot_unavailable'),
])
const slotFullResult = await book({ env: env(), fetchImpl: slotFull.fetchImpl })
assert.equal(slotFullResult.status, 409)
assert.equal(slotFullResult.json.error, 'slot_unavailable')

const rateLimited = mockFetch([
  siteverify({ success: true, hostname: 'anislrc.hr', 'error-codes': [] }),
  rpcError('booking_rate_limited'),
])
const rateResult = await book({ env: env(), fetchImpl: rateLimited.fetchImpl })
assert.equal(rateResult.status, 429)
assert.equal(rateResult.json.error, 'rate_limited')

const siteverifyDown = mockFetch([siteverify({ success: false }, 503)])
const downResult = await book({ env: env(), fetchImpl: siteverifyDown.fetchImpl })
assert.equal(downResult.status, 503)
assert.equal(downResult.json.error, 'unavailable')

const options = await handleBookingRequest(
  new Request('https://example.supabase.co/functions/v1/book-consultation-slot', {
    method: 'OPTIONS',
    headers: { Origin: 'https://anislrc.hr' },
  }),
  { env: env(), fetchImpl: mockFetch([]).fetchImpl },
)
assert.equal(options.status, 204)
assert.equal(options.headers.get('Access-Control-Allow-Origin'), 'https://anislrc.hr')

const getBlocked = await handleBookingRequest(
  new Request('https://example.supabase.co/functions/v1/book-consultation-slot', {
    method: 'GET',
    headers: { Origin: 'https://anislrc.hr' },
  }),
  { env: env(), fetchImpl: mockFetch([]).fetchImpl },
)
assert.equal(getBlocked.status, 405)

// Migration contract: hardening revokes anon execute
const hardening = readFileSync(
  join(root, 'supabase/migrations/20261017140000_f26_booking_turnstile_edge_hardening.sql'),
  'utf8',
)
assert.match(hardening, /revoke all on function public\.public_book_consultation_slot/)
assert.match(hardening, /grant execute on function public\.public_book_consultation_slot[\s\S]*to service_role/)
assert.match(hardening, /book-consultation-slot/)

const edgeEntry = readFileSync(
  join(root, 'supabase/functions/book-consultation-slot/index.ts'),
  'utf8',
)
assert.match(edgeEntry, /TURNSTILE_SECRET_KEY/)
assert.match(edgeEntry, /handleBookingRequest/)
assert.doesNotMatch(edgeEntry, /VITE_/)

console.log('smart-booking Edge security tests passed')
