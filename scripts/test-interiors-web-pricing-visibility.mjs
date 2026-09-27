import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  filterWebVisiblePricingItems,
  getWebVisiblePricingItemsForDate,
  isInteriorsItemWebVisible,
} from '../src/lib/interiorsPricingWeb.ts'
import { getZagrebCalendarDate } from '../src/lib/zagrebCalendarDate.ts'

const source = JSON.parse(readFileSync('src/data/interiorsPricing.json', 'utf8'))
const items = source.items

const multiRoom = items.find((item) => item.id === 'multi-room-package')
assert.ok(multiRoom)
assert.equal(multiRoom.validFrom, '2026-10-01')

const sep30Late = new Date('2026-09-30T21:59:59.000Z')
const oct1Start = new Date('2026-09-30T22:00:00.000Z')
const oct2Mid = new Date('2026-10-02T12:00:00.000Z')

assert.equal(getZagrebCalendarDate(sep30Late), '2026-09-30')
assert.equal(getZagrebCalendarDate(oct1Start), '2026-10-01')
assert.equal(getZagrebCalendarDate(oct2Mid), '2026-10-02')

assert.equal(isInteriorsItemWebVisible(multiRoom, '2026-09-30'), false)
assert.equal(isInteriorsItemWebVisible(multiRoom, '2026-10-01'), true)
assert.equal(isInteriorsItemWebVisible(multiRoom, '2026-10-02'), true)

assert.equal(
  isInteriorsItemWebVisible(multiRoom, getZagrebCalendarDate(sep30Late)),
  false,
)
assert.equal(
  isInteriorsItemWebVisible(multiRoom, getZagrebCalendarDate(oct1Start)),
  true,
)

const visibleSep30 = getWebVisiblePricingItemsForDate(items, sep30Late)
const visibleOct1 = getWebVisiblePricingItemsForDate(items, oct1Start)
const visibleOct2 = filterWebVisiblePricingItems(items, '2026-10-02')

assert.equal(visibleSep30.some((item) => item.id === 'multi-room-package'), false)
assert.equal(visibleOct1.some((item) => item.id === 'multi-room-package'), true)
assert.equal(visibleOct2.some((item) => item.id === 'multi-room-package'), true)

assert.equal(visibleSep30.length, 7)
assert.equal(visibleOct1.length, 8)
assert.equal(visibleOct2.length, 8)

const coreIds = [
  'interior-small-set',
  'interior-room',
  'interior-kitchen',
  'photorealistic-visualization',
  'additional-3d-complexity',
  'included-minor-revision',
  'major-revision',
]

for (const id of coreIds) {
  assert.equal(
    visibleSep30.some((item) => item.id === id),
    true,
    `${id} must stay visible on 2026-09-30 Zagreb`,
  )
}

console.log('Interiors web pricing visibility checks passed.')
