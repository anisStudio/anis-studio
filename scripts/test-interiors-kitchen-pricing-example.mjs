import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const COMPLEX_UNITS = 2
const ADVANCED_UNITS = 4

const pricing = JSON.parse(readFileSync('src/data/interiorsPricing.json', 'utf8'))
const kitchen = pricing.items.find((item) => item.id === 'interior-kitchen')
const complexity = pricing.items.find((item) => item.id === 'additional-3d-complexity')

assert.equal(kitchen?.price?.type, 'from')
assert.equal(complexity?.price?.type, 'unit')

const baseCents = kitchen.price.minCents
const unitCents = complexity.price.amountCents

assert.equal(baseCents, 4000)
assert.equal(unitCents, 1000)
assert.equal(baseCents + unitCents * COMPLEX_UNITS, 6000)
assert.equal(baseCents + unitCents * ADVANCED_UNITS, 8000)

console.log('Kitchen pricing example helper checks passed.')
