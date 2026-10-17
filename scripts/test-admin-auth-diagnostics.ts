// Admin auth diagnostics — pure helpers (no network, no secrets printed).

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  classifySupabaseAuthError,
  failureFromSupabaseAuthError,
  messageForAdminAuthFailure,
} from '../src/lib/adminAuthErrors.ts'
import {
  EXPECTED_SUPABASE_PROJECT_REF,
  buildSupabasePublicDiagnostics,
  extractSupabaseProjectRefFromHost,
  readJwtPayloadRef,
} from '../src/lib/supabasePublicConfig.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

assert.equal(EXPECTED_SUPABASE_PROJECT_REF, 'cpvofgaknmgnmusypoev')
assert.equal(
  extractSupabaseProjectRefFromHost('cpvofgaknmgnmusypoev.supabase.co'),
  'cpvofgaknmgnmusypoev',
)

assert.equal(
  buildSupabasePublicDiagnostics(undefined, undefined).status,
  'missing',
)
assert.equal(
  buildSupabasePublicDiagnostics('not-a-url', 'sb_publishable_x').status,
  'invalid_url',
)
assert.equal(
  buildSupabasePublicDiagnostics(
    'https://cpvofgaknmgnmusypoev.supabase.co',
    'sb_publishable_test_value_not_secret',
  ).status,
  'ready',
)
assert.equal(
  buildSupabasePublicDiagnostics(
    'https://cpvofgaknmgnmusypoev.supabase.co',
    'sb_publishable_test_value_not_secret',
  ).projectRef,
  'cpvofgaknmgnmusypoev',
)

// Legacy JWT anon key: payload {"ref":"otherproject","role":"anon"}
const otherRefPayload = Buffer.from(
  JSON.stringify({ ref: 'otherproject', role: 'anon' }),
).toString('base64url')
const fakeJwt = `eyJhbGciOiJub25lIn0.${otherRefPayload}.sig`
assert.equal(readJwtPayloadRef(fakeJwt), 'otherproject')
assert.equal(
  buildSupabasePublicDiagnostics(
    'https://cpvofgaknmgnmusypoev.supabase.co',
    fakeJwt,
  ).status,
  'url_key_mismatch',
)

assert.equal(
  classifySupabaseAuthError({ message: 'Invalid login credentials' }),
  'invalid_credentials',
)
assert.equal(
  classifySupabaseAuthError({ message: 'Failed to fetch' }),
  'network',
)
assert.equal(
  classifySupabaseAuthError({ message: 'Invalid API key' }),
  'misconfigured',
)
assert.equal(
  classifySupabaseAuthError({ message: 'Email not confirmed' }),
  'email_not_confirmed',
)
assert.equal(
  failureFromSupabaseAuthError({ message: 'Invalid login credentials' }).message,
  messageForAdminAuthFailure('invalid_credentials'),
)
assert.equal(
  messageForAdminAuthFailure('invalid_credentials'),
  'Neispravna e-pošta ili lozinka.',
)

// Source contracts — login distinguishes config vs credentials; no bypasses
const provider = readFileSync(join(root, 'src/providers/AdminAuthProvider.tsx'), 'utf8')
assert.match(provider, /failureFromSupabaseAuthError/)
assert.match(provider, /getSupabasePublicDiagnostics/)
assert.match(provider, /fetchIsAdmin/)
assert.match(provider, /failureKind:\s*'not_admin'/)
assert.doesNotMatch(provider, /admin=true/)
assert.doesNotMatch(provider, /VITE_ADMIN_PASSWORD/)
assert.doesNotMatch(provider, /service_role/)

const loginPage = readFileSync(join(root, 'src/pages/AdminLoginPage.tsx'), 'utf8')
assert.match(loginPage, /Auth projekt/)
assert.match(loginPage, /EXPECTED_SUPABASE_PROJECT_REF/)
assert.match(loginPage, /ne prenosi se na Vercel Preview/)

const docs = readFileSync(join(root, 'docs/admin-preview-and-publishing.md'), 'utf8')
assert.match(docs, /VITE_SUPABASE_URL/)
assert.match(docs, /Preview/)
assert.match(docs, /cpvofgaknmgnmusypoev/)
assert.match(docs, /VITE_ADMIN_PASSWORD/)

console.log('test-admin-auth-diagnostics: PASS')
