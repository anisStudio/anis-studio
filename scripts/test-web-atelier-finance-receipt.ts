import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PAYMENT_PLAN_KINDS,
  buildFullPaymentPlan,
  eurosToCents,
  sumCents,
  validatePaymentPlanTotals,
} from '../src/lib/webAtelierFinance.ts'
import { assertPublicStatusPayload } from '../src/lib/webAtelierTracking.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migration = readFileSync(
  join(root, 'supabase/migrations/20261017120000_f24_payment_receipt_confirmation.sql'),
  'utf8',
)
const panel = readFileSync(join(root, 'src/components/AdminFinancePanel.tsx'), 'utf8')
const financeLib = readFileSync(join(root, 'src/lib/webAtelierFinance.ts'), 'utf8')

assert.match(migration, /admin_confirm_web_atelier_payment_receipt/)
assert.match(migration, /admin_correct_web_atelier_payment_receipt/)
assert.match(migration, /admin_save_web_atelier_payment_plan/)
assert.match(migration, /web_atelier_payment_receipt_events/)
assert.match(migration, /receipt_confirmed_at/)
assert.match(migration, /anis\.finance_allow_receipt/)
assert.match(migration, /get_web_atelier_project_public_status/)
assert.match(migration, /'receipts'/)
assert.doesNotMatch(migration, /insert into public\.web_atelier_payment_records/)
assert.doesNotMatch(migration, /stripe/i)
assert.match(migration, /Do NOT auto-apply to production/i)

assert.ok(!panel.includes('Evidentiraj uplatu'))
assert.ok(!panel.includes('Ručna uplata'))
assert.ok(panel.includes('Potvrdi primitak'))
assert.ok(panel.includes('Parri'))
assert.ok(financeLib.includes('Jednokratno'))
assert.ok(!financeLib.includes('admin_record_web_atelier_payment'))

assert.deepEqual(PAYMENT_PLAN_KINDS, ['full', 'advance_balance', 'custom'])
assert.deepEqual(buildFullPaymentPlan(50_000), [
  { label: 'Cjelokupna uplata', amountCents: 50_000, dueDate: null },
])

validatePaymentPlanTotals('full', buildFullPaymentPlan(12_345), 12_345)
validatePaymentPlanTotals(
  'advance_balance',
  [
    { label: 'Avans', amountCents: 4_000 },
    { label: 'Završna uplata', amountCents: 6_000 },
  ],
  10_000,
)
assert.throws(
  () =>
    validatePaymentPlanTotals(
      'advance_balance',
      [
        { label: 'Avans', amountCents: 4_000 },
        { label: 'Završna uplata', amountCents: 5_000 },
      ],
      10_000,
    ),
  /Zbroj rata/,
)
assert.equal(sumCents([1, 2, 3]), 6)
assert.equal(eurosToCents('10,01'), 1001)

const base = {
  project_number: 'WP-2026-000001',
  title: 'Demo',
  status: 'in_progress',
  status_label_hr: 'U izradi',
  status_description_hr: 'Aktivno radimo.',
  checked_at: new Date().toISOString(),
}
assert.equal(assertPublicStatusPayload(base).receipts, undefined)
const withReceipts = assertPublicStatusPayload({
  ...base,
  receipts: [{ label: 'Cjelokupna uplata', status: 'confirmed', confirmed_on: '2026-10-17' }],
})
assert.equal(withReceipts.receipts?.[0]?.label, 'Cjelokupna uplata')
assert.throws(
  () =>
    assertPublicStatusPayload({
      ...base,
      receipts: [{ label: 'X', status: 'confirmed', confirmed_on: null, amount_cents: 1 }],
    }),
  /public_status_receipt_leaks_field/,
)
assert.throws(
  () => assertPublicStatusPayload({ ...base, amount_cents: 1 }),
  /public_status_leaks_sensitive_field/,
)

console.log('web-atelier finance-receipt unit tests: OK')
