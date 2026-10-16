import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  WEB_ATELIER_MATERIAL_KINDS,
  clientMaterialUploadImplemented,
  isValidPlannedStoragePath,
  materialOverview,
  plannedStoragePath,
  validateMaterialInput,
} from '../src/lib/webAtelierMaterials.ts'
import {
  WEB_ATELIER_PROJECT_STATUS_PUBLIC_HR,
  assertPublicStatusPayload,
  defaultTrackingExpiryIso,
  isValidTrackingTokenFormat,
  trackingLinkPath,
} from '../src/lib/webAtelierTracking.ts'
import { WEB_ATELIER_PROJECT_STATUSES } from '../src/lib/webAtelierOffers.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

const migration = read('supabase/migrations/20261016020000_web_atelier_tracking_materials.sql')

assert.match(migration, /create table public\.web_atelier_project_tracking_tokens/)
assert.match(migration, /create table public\.web_atelier_material_requirements/)
assert.match(migration, /create table public\.web_atelier_material_file_meta/)
assert.match(migration, /admin_create_web_atelier_project_tracking_token/)
assert.match(migration, /admin_revoke_web_atelier_project_tracking_token/)
assert.match(migration, /admin_list_web_atelier_project_tracking_tokens/)
assert.match(migration, /get_web_atelier_project_public_status/)
assert.match(migration, /admin_create_web_atelier_material_requirement/)
assert.match(migration, /token_hash/)
assert.match(migration, /wat_/)
assert.match(migration, /tracking_token_expired/)
assert.match(migration, /tracking_token_revoked/)
assert.match(migration, /tracking_token_invalid/)
assert.match(migration, /web-atelier-materials/)
assert.match(migration, /public\s*=\s*false/)
assert.doesNotMatch(migration, /grant select on table public\.web_atelier_project_tracking_tokens/)
assert.match(migration, /grant execute on function public\.get_web_atelier_project_public_status/)
assert.match(migration, /to anon, authenticated/)
assert.doesNotMatch(migration, /client_email/)
assert.match(migration, /Never send|No e-mail|no e-mail/i)
assert.match(migration, /material_file_meta_writes_disabled/)
assert.match(migration, /Client upload authorization is not implemented/i)

// Static: plaintext token must not be a stored column.
assert.doesNotMatch(migration, /plaintext_token|token_plain|raw_token/)

assert.equal(clientMaterialUploadImplemented(), false)
assert.equal(isValidTrackingTokenFormat('wat_' + 'a'.repeat(64)), true)
assert.equal(isValidTrackingTokenFormat('wat_' + 'A'.repeat(64)), false)
assert.equal(isValidTrackingTokenFormat('bad'), false)
assert.equal(isValidTrackingTokenFormat('wat_' + 'a'.repeat(63)), false)

assert.match(trackingLinkPath('wat_' + 'b'.repeat(64)), /^\/pracenje-projekta\/wat_/)
assert.ok(Date.parse(defaultTrackingExpiryIso(30)) > Date.now())

for (const status of WEB_ATELIER_PROJECT_STATUSES) {
  assert.ok(WEB_ATELIER_PROJECT_STATUS_PUBLIC_HR[status].label.length > 0)
  assert.ok(WEB_ATELIER_PROJECT_STATUS_PUBLIC_HR[status].description.length > 0)
}

const okPayload = {
  project_number: 'WP-2026-000001',
  title: 'Demo',
  status: 'in_progress',
  status_label_hr: 'U izradi',
  status_description_hr: 'Aktivno radimo na vašem web projektu.',
  checked_at: new Date().toISOString(),
}
assert.equal(assertPublicStatusPayload(okPayload).status, 'in_progress')
assert.throws(
  () => assertPublicStatusPayload({ ...okPayload, client_email: 'x@y.z' }),
  /public_status_leaks_sensitive_field/,
)
assert.throws(
  () => assertPublicStatusPayload({ ...okPayload, agreed_total_cents: 1 }),
  /public_status_leaks_sensitive_field/,
)
assert.throws(
  () => assertPublicStatusPayload({ ...okPayload, notes: 'secret' }),
  /public_status_leaks_sensitive_field/,
)
assert.throws(
  () => assertPublicStatusPayload({ project_number: 'WP-1' } as never),
  /public_status_incomplete/,
)

const path = plannedStoragePath(
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
)
assert.equal(
  path,
  'web-atelier-materials/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/',
)
assert.equal(
  isValidPlannedStoragePath(
    path,
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  ),
  true,
)

assert.deepEqual(
  validateMaterialInput({ kind: 'logo', title: '  Logo  ', is_required: true }),
  { kind: 'logo', title: 'Logo', description: null, is_required: true, deadline: null, admin_notes: null },
)
assert.throws(() => validateMaterialInput({ kind: 'nope' as never, title: 'x' }), /material_kind_invalid/)
assert.equal(WEB_ATELIER_MATERIAL_KINDS.includes('brand_colors'), true)

assert.deepEqual(
  materialOverview([
    {
      id: '1',
      project_id: 'p',
      kind: 'logo',
      title: 'L',
      description: null,
      is_required: true,
      deadline: null,
      status: 'pending',
      admin_notes: null,
      planned_storage_path: path,
      position: 1,
      created_at: '',
      updated_at: '',
    },
    {
      id: '2',
      project_id: 'p',
      kind: 'text',
      title: 'T',
      description: null,
      is_required: false,
      deadline: null,
      status: 'received',
      admin_notes: null,
      planned_storage_path: path,
      position: 2,
      created_at: '',
      updated_at: '',
    },
  ]),
  { total: 2, required_pending: 1, received: 1, waived: 0, cancelled: 0 },
)

const app = read('src/App.tsx')
assert.match(app, /pracenje-projekta\/:token/)
assert.match(app, /path="\/pracenje-projekta"/)
assert.match(app, /WebAtelierProjectTrackingPage/)
const trackingPage = read('src/pages/WebAtelierProjectTrackingPage.tsx')
assert.match(trackingPage, /fetchPublicProjectStatusByToken/)
assert.match(trackingPage, /noIndex/)
assert.match(trackingPage, /no-referrer/)
assert.match(trackingPage, /sessionStorage/)
assert.match(trackingPage, /replace:\s*true/)
assert.match(read('src/pages/AdminWebAtelierProjectDetailPage.tsx'), /createWebAtelierTrackingToken/)
assert.match(read('src/pages/AdminWebAtelierProjectDetailPage.tsx'), /createWebAtelierMaterialRequirement/)
assert.match(read('src/lib/webAtelierTracking.ts'), /Never send tracking links/)
assert.equal(read('src/lib/webAtelierMaterials.ts').includes('clientMaterialUploadImplemented'), true)

// Storage insert policy must use in-bucket object paths, not bucket-id prefix.
assert.match(migration, /name ~ '\^\[0-9a-f-\]\{36\}\/\[0-9a-f-\]\{36\}\/'/)
assert.doesNotMatch(migration, /name like \('web-atelier-materials\/%'\)/)
assert.doesNotMatch(migration, /bucket_id <> 'web-atelier-materials'/)

// Must not wire auto-email for tracking.
assert.doesNotMatch(read('src/lib/webAtelierTracking.ts'), /resend|nodemailer|sendEmail|mailto:/i)
assert.doesNotMatch(migration, /pg_net|http_post|send_email/i)

console.log('web-atelier tracking/materials unit tests passed')
