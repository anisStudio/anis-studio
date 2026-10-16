import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  WEB_ATELIER_INFORMATIVE_PRICES_EUR,
  buildEvidenceReference,
  calculateOfferTotals,
  canCreateProject,
  canEditOffer,
  canIssueOffer,
  canRecordDecision,
  canRecordDelivery,
  eurosToCents,
  inquiryCreatesProject,
  isOfferTransitionAllowed,
  isProjectTransitionAllowed,
  issuedOfferMeansDelivered,
  lineTotalCents,
  normalizeScopeInput,
  sentOfferCreatesProject,
  suggestedLineForTier,
  validateAcceptanceEvidence,
  validateOfferItems,
} from '../src/lib/webAtelierOffers.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

assert.equal(inquiryCreatesProject(), false)
assert.equal(sentOfferCreatesProject(), false)
assert.equal(issuedOfferMeansDelivered(), false)
assert.equal(canCreateProject('draft'), false)
assert.equal(canCreateProject('sent'), false)
assert.equal(canCreateProject('rejected'), false)
assert.equal(canCreateProject('expired'), false)
assert.equal(canCreateProject('accepted'), true)
assert.equal(canEditOffer('sent'), false)
assert.equal(canIssueOffer('draft'), true)
assert.equal(canRecordDelivery('sent', null), true)
assert.equal(canRecordDelivery('sent', '2026-10-14T10:00:00Z'), false)
assert.equal(canRecordDelivery('draft', null), false)
assert.equal(canRecordDecision('sent', null), false)
assert.equal(canRecordDecision('sent', '2026-10-14T10:00:00Z'), true)
assert.equal(canRecordDecision('draft', null), false)

assert.equal(isOfferTransitionAllowed('draft', 'sent'), true)
assert.equal(isOfferTransitionAllowed('draft', 'accepted'), false)
assert.equal(isOfferTransitionAllowed('sent', 'accepted'), true)
assert.equal(isOfferTransitionAllowed('sent', 'draft'), false)
assert.equal(isOfferTransitionAllowed('accepted', 'sent'), false)
assert.equal(isOfferTransitionAllowed('accepted', 'rejected'), false)
assert.equal(isOfferTransitionAllowed('rejected', 'accepted'), false)
assert.equal(isOfferTransitionAllowed('expired', 'accepted'), false)
assert.equal(isOfferTransitionAllowed('superseded', 'accepted'), false)

assert.equal(isProjectTransitionAllowed('preparing', 'ready_to_start'), true)
assert.equal(isProjectTransitionAllowed('preparing', 'completed'), false)
assert.equal(isProjectTransitionAllowed('ready_to_start', 'in_progress'), true)
assert.equal(isProjectTransitionAllowed('in_progress', 'client_review'), true)
assert.equal(isProjectTransitionAllowed('client_review', 'final_approval'), true)
assert.equal(isProjectTransitionAllowed('final_approval', 'completed'), true)
assert.equal(isProjectTransitionAllowed('completed', 'in_progress'), false)
assert.equal(isProjectTransitionAllowed('cancelled', 'preparing'), false)

assert.equal(WEB_ATELIER_INFORMATIVE_PRICES_EUR.start, 300)
assert.equal(WEB_ATELIER_INFORMATIVE_PRICES_EUR.pro, 500)
assert.equal(WEB_ATELIER_INFORMATIVE_PRICES_EUR.premium, 800)
assert.equal(eurosToCents(300), 30_000)
assert.equal(eurosToCents(123.45), 12_345)
assert.equal(lineTotalCents(1, 50_000), 50_000)
assert.equal(lineTotalCents(2.5, 12_345), 30_863)

const totals = calculateOfferTotals([
  { item_type: 'service', description: 'PRO', quantity: 1, unit_price_cents: 50_000 },
  { item_type: 'addon', description: 'Stranice', quantity: 2.5, unit_price_cents: 12_345 },
  { item_type: 'discount', description: 'Popust', quantity: 1, unit_price_cents: 5_000 },
])
assert.deepEqual(totals, { subtotal_cents: 80_863, discount_cents: 5_000, total_cents: 75_863 })

assert.throws(() => calculateOfferTotals([
  { item_type: 'service', description: 'x', quantity: 1, unit_price_cents: 100 },
  { item_type: 'discount', description: 'd', quantity: 1, unit_price_cents: 500 },
]), /discount_exceeds_subtotal/)
assert.throws(() => lineTotalCents(0, 100), /items_quantity_invalid/)
assert.throws(() => lineTotalCents(1, -1), /items_price_invalid/)

const suggested = suggestedLineForTier('pro')
assert.equal(suggested.unit_price_cents, 50_000)
assert.match(suggested.description, /PRO/)
assert.match(suggested.details ?? '', /Nije račun/)

assert.throws(() => validateOfferItems([
  { item_type: 'gift' as never, description: 'x', quantity: 1, unit_price_cents: 10 },
]), /items_type_invalid/)
assert.throws(() => validateOfferItems([
  { item_type: 'service', description: 'x', quantity: 1.234, unit_price_cents: 10 },
]), /items_quantity_invalid/)

const clean = validateOfferItems([
  { item_type: 'service', description: '  Web  ', details: '', quantity: 1, unit_price_cents: 30_000 },
])
assert.equal(clean[0].description, 'Web')
assert.equal(clean[0].details, null)

const scope = normalizeScopeInput({
  summary: '  Web stranica  ',
  deliverables: ['Dizajn', ' ', 'Izrada'],
  exclusions: ['Copywriting'],
})
assert.equal(scope.summary, 'Web stranica')
assert.deepEqual(scope.deliverables, ['Dizajn', 'Izrada'])
assert.throws(() => normalizeScopeInput({ summary: 'x', deliverables: [] }), /scope_deliverables_required/)

assert.equal(
  buildEvidenceReference({
    offerNumber: 'WO-2026-000001',
    offerVersion: 2,
    narrative: 'E-mail Ane',
  }),
  'WO-2026-000001 #v2 — E-mail Ane',
)

assert.throws(() => validateAcceptanceEvidence({
  decided_by_name: 'Ana',
  evidence_channel: 'email',
  evidence_reference: 'WO-2026-000001 #v1 — E-mail Ane od 2026-10-14',
  evidence_retention_note: 'Mailbox arhiva Inbox/WebAtelier/2026',
  admin_confirmed: false,
  expected_snapshot_sha256: 'a'.repeat(64),
  offer_number: 'WO-2026-000001',
  offer_version: 1,
}), /admin_confirmation_required/)
assert.throws(() => validateAcceptanceEvidence({
  decided_by_name: 'Ana',
  evidence_channel: 'email',
  evidence_reference: 'kratko',
  evidence_retention_note: 'Mailbox arhiva Inbox/WebAtelier/2026',
  admin_confirmed: true,
  expected_snapshot_sha256: 'a'.repeat(64),
  offer_number: 'WO-2026-000001',
  offer_version: 1,
}), /evidence_reference_required/)
assert.throws(() => validateAcceptanceEvidence({
  decided_by_name: 'Ana',
  evidence_channel: 'email',
  evidence_reference: 'samo narrative bez broja #v1',
  evidence_retention_note: 'Mailbox arhiva Inbox/WebAtelier/2026',
  admin_confirmed: true,
  expected_snapshot_sha256: 'a'.repeat(64),
  offer_number: 'WO-2026-000001',
  offer_version: 1,
}), /evidence_must_cite_offer_number/)
assert.throws(() => validateAcceptanceEvidence({
  decided_by_name: 'Ana',
  evidence_channel: 'email',
  evidence_reference: 'WO-2026-000001 bez verzije',
  evidence_retention_note: 'Mailbox arhiva Inbox/WebAtelier/2026',
  admin_confirmed: true,
  expected_snapshot_sha256: 'a'.repeat(64),
  offer_number: 'WO-2026-000001',
  offer_version: 1,
}), /evidence_must_cite_offer_version/)
assert.throws(() => validateAcceptanceEvidence({
  decided_by_name: 'Ana',
  evidence_channel: 'email',
  evidence_reference: 'WO-2026-000001 #v1 — ok',
  evidence_retention_note: 'kratko',
  admin_confirmed: true,
  expected_snapshot_sha256: 'a'.repeat(64),
  offer_number: 'WO-2026-000001',
  offer_version: 1,
}), /evidence_retention_note_required/)
validateAcceptanceEvidence({
  decided_by_name: 'Ana Test',
  evidence_channel: 'email',
  evidence_reference: 'WO-2026-000001 #v1 — E-mail Ane Test od 2026-10-14, predmet: Prihvaćanje',
  evidence_retention_note: 'Mailbox arhiva Inbox/WebAtelier/2026',
  admin_confirmed: true,
  expected_snapshot_sha256: 'ab'.repeat(32),
  offer_number: 'WO-2026-000001',
  offer_version: 1,
})

const migration = read('supabase/migrations/20261014010000_web_atelier_offers_projects.sql')
assert.match(migration, /create table public\.web_atelier_offers/)
assert.match(migration, /create table public\.web_atelier_offer_items/)
assert.match(migration, /create table public\.web_atelier_scope_versions/)
assert.match(migration, /create table public\.web_atelier_approvals/)
assert.match(migration, /create table public\.web_atelier_projects/)
assert.match(migration, /create table public\.web_atelier_project_events/)
assert.match(migration, /using \(public\.is_admin\(\)\)/)
assert.match(migration, /admin_create_web_atelier_offer_draft/)
assert.match(migration, /admin_mark_web_atelier_offer_sent/)
assert.match(migration, /admin_record_web_atelier_offer_delivery/)
assert.match(migration, /admin_record_web_atelier_offer_decision/)
assert.match(migration, /admin_create_web_atelier_project_from_offer/)
assert.match(migration, /web_atelier_business_date/)
assert.match(migration, /Europe\/Zagreb/)
assert.match(migration, /offer_immutable_after_sent/)
assert.match(migration, /offer_delivery_required_before_decision/)
assert.match(migration, /project_requires_accepted_offer/)
assert.match(migration, /web_atelier_projects_one_per_offer_key/)
assert.match(migration, /method in \('admin_recorded'\)/)
assert.match(migration, /default 'preparing'/)
assert.match(migration, /NOT an invoice/)
assert.match(migration, /Lock order: inquiry/)
assert.equal(migration.includes('stripe'), false)
assert.equal(migration.includes('web_atelier_public_visible'), false)
assert.match(migration, /revoke all on table public\.web_atelier_offers from public, anon, authenticated, service_role/)
assert.match(migration, /grant execute on function public\.admin_create_web_atelier_offer_draft/)
assert.match(migration, /grant execute on function public\.admin_record_web_atelier_offer_delivery/)

const app = read('src/App.tsx')
assert.match(app, /path="web-atelier-offers"/)
assert.match(app, /path="web-atelier-offers\/:id"/)
assert.match(app, /path="web-atelier-projects"/)
assert.match(app, /path="web-atelier-projects\/:id"/)
assert.match(app, /PublicServiceGuard service="webAtelier"/)
assert.equal(app.includes('web-atelier-test'), false)
assert.equal(app.includes('path="/ponuda"'), false)
assert.equal(app.includes('accept-offer'), false)

const adminNav = read('src/components/AdminNav.tsx')
assert.match(adminNav, /web-atelier-offers/)
assert.match(adminNav, /web-atelier-projects/)
assert.equal(adminNav.includes('web-atelier-test'), false)

const header = read('src/components/Header.tsx')
assert.equal(header.includes('web-atelier-offers'), false)
assert.equal(header.includes('web-atelier-projects'), false)

assert.match(read('src/hooks/useSettings.ts'), /web_atelier_public_visible:\s*false/)
assert.equal(read('src/lib/webAtelierOffers.ts').includes('.rpc(') && read('src/lib/webAtelierOffers.ts').includes('admin_create_web_atelier_offer_draft'), true)
assert.equal(read('src/lib/webAtelierInquiry.ts').includes('web_atelier_projects'), false)
assert.equal(read('src/lib/webAtelierSubmit.ts').includes('admin_create_web_atelier_project'), false)

assert.equal(existsSync(join(root, 'src/pages/AdminWebAtelierOffersPage.tsx')), true)
assert.equal(existsSync(join(root, 'src/pages/AdminWebAtelierOfferDetailPage.tsx')), true)
assert.equal(existsSync(join(root, 'src/pages/AdminWebAtelierProjectsPage.tsx')), true)
assert.equal(existsSync(join(root, 'src/pages/AdminWebAtelierProjectDetailPage.tsx')), true)
assert.equal(existsSync(join(root, 'src/pages/AdminWebAtelierTestPage.tsx')), false)

const clientBundle = [
  read('src/lib/webAtelierOffers.ts'),
  read('src/pages/AdminWebAtelierOffersPage.tsx'),
  read('src/pages/AdminWebAtelierOfferDetailPage.tsx'),
].join('\n')
assert.equal(clientBundle.includes('299'), false)
assert.equal(clientBundle.includes('499'), false)
assert.equal(clientBundle.includes('799'), false)
assert.match(clientBundle, /admin_record_web_atelier_offer_delivery/)
assert.match(clientBundle, /evidence_retention_note|evidenceRetentionNote/)
assert.match(clientBundle, /Izdavanje snapshota|Izdaj snapshot/)

console.log('web-atelier offer tests passed')
