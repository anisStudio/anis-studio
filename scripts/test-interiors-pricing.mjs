import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  archiveFilename,
  generatePricingFiles,
  parseCsv,
  publicationFilename,
  renderPricingCsv,
  validatePricingDocument,
} from './generate-interiors-pricing.mjs'

const source = JSON.parse(
  await readFile('src/data/interiorsPricing.json', 'utf8'),
)

function publicReadyFixture() {
  const fixture = structuredClone(source)
  fixture.publicationStatus = 'public-ready'
  fixture.version = '2026-10-01T09-00-00Z'
  fixture.validFrom = '2026-10-01T09:00:00Z'
  fixture.publishedAt = '2026-10-01T08:30:00Z'
  fixture.publication.sequence = 7
  fixture.publication.filename.serviceObjectTypeToken =
    'test-service-object'
  fixture.regulatoryMappings.kitchenReferencePriceTreatment.status =
    'resolved'
  fixture.regulatoryMappings.kitchenReferencePriceTreatment.resolutionCode =
    'test-confirmed-treatment'
  for (const item of fixture.items) {
    item.introducedAt = '2026-10-01'
  }
  return fixture
}

function expectFailure(action, expectedText) {
  assert.throws(action, (error) => {
    assert.match(error.message, expectedText)
    return true
  })
}

validatePricingDocument(source, { requirePublicReady: false })
assert.equal(source.items.length, 8)
expectFailure(
  () => validatePricingDocument(source, { requirePublicReady: true }),
  /draft/,
)

const fixture = publicReadyFixture()
validatePricingDocument(fixture)

const unresolvedKitchenFixture = publicReadyFixture()
unresolvedKitchenFixture.regulatoryMappings.kitchenReferencePriceTreatment.status =
  'unresolved'
unresolvedKitchenFixture.regulatoryMappings.kitchenReferencePriceTreatment.resolutionCode =
  null
expectFailure(
  () => validatePricingDocument(unresolvedKitchenFixture),
  /Kitchen anchor\/reference price tretman je neriješen/,
)

const missingSequenceFixture = publicReadyFixture()
missingSequenceFixture.publication.sequence = null
expectFailure(
  () => validatePricingDocument(missingSequenceFixture),
  /publication.sequence mora biti postavljen/,
)

const zeroSequenceFixture = publicReadyFixture()
zeroSequenceFixture.publication.sequence = 0
expectFailure(
  () => validatePricingDocument(zeroSequenceFixture),
  /publication.sequence mora biti pozitivan integer/,
)

const negativeSequenceFixture = publicReadyFixture()
negativeSequenceFixture.publication.sequence = -1
expectFailure(
  () => validatePricingDocument(negativeSequenceFixture),
  /publication.sequence mora biti pozitivan integer/,
)

const missingPublicationTimestampFixture = publicReadyFixture()
missingPublicationTimestampFixture.publishedAt = null
expectFailure(
  () => validatePricingDocument(missingPublicationTimestampFixture),
  /publishedAt mora biti neprazan string/,
)

const missingObjectTypeTokenFixture = publicReadyFixture()
missingObjectTypeTokenFixture.publication.filename.serviceObjectTypeToken =
  null
expectFailure(
  () => validatePricingDocument(missingObjectTypeTokenFixture),
  /serviceObjectTypeToken mora biti potvrđen/,
)

const expectedFilename =
  'test-service-object_hanibala-lucica-7-32270-zupanja-hrvatska_P1_7_20261001T083000Z_2026-10-01T09-00-00Z.csv'
assert.equal(publicationFilename(fixture), expectedFilename)
assert.equal(publicationFilename(structuredClone(fixture)), expectedFilename)
assert.match(expectedFilename, /_P1_/)
assert.match(expectedFilename, /_7_/)
assert.match(expectedFilename, /20261001T083000Z/)

const missingExpectedIdFixture = publicReadyFixture()
missingExpectedIdFixture.items = missingExpectedIdFixture.items.filter(
  (item) => item.id !== 'major-revision',
)
expectFailure(
  () => validatePricingDocument(missingExpectedIdFixture),
  /točno 8 stavki/,
)

const extraUnknownIdFixture = publicReadyFixture()
extraUnknownIdFixture.items.push({
  ...structuredClone(extraUnknownIdFixture.items[0]),
  id: 'unknown-service',
  displayOrder: 9,
})
expectFailure(
  () => validatePricingDocument(extraUnknownIdFixture),
  /točno 8 stavki/,
)

const replacedExpectedIdFixture = publicReadyFixture()
replacedExpectedIdFixture.items.find((item) => item.id === 'major-revision').id =
  'unknown-service'
expectFailure(
  () => validatePricingDocument(replacedExpectedIdFixture),
  /Nepoznat pricing ID/,
)

const csv = renderPricingCsv(fixture)
const parsed = parseCsv(csv)
const header = parsed[0]
const rows = parsed.slice(1)
const column = (row, name) => row[header.indexOf(name)]
const byId = new Map(rows.map((row) => [column(row, 'item_id'), row]))

assert.equal(column(byId.get('interior-small-set'), 'price_display_hr'), 'od 35.00 EUR')
assert.equal(column(byId.get('photorealistic-visualization'), 'price_display_hr'), '15.00 EUR')
assert.equal(
  column(byId.get('additional-3d-complexity'), 'price_display_hr'),
  '10.00 EUR / obračunska jedinica',
)
assert.equal(column(byId.get('major-revision'), 'price_display_hr'), 'prema opsegu')
assert.equal(
  column(byId.get('included-minor-revision'), 'price_display_hr'),
  'uključeno u osnovnu cijenu',
)
assert.equal(column(byId.get('multi-room-package'), 'price_display_hr'), '10 % popusta')
assert.equal(column(byId.get('interior-small-set'), 'internal_row_kind'), 'chargeable-service')
assert.equal(column(byId.get('included-minor-revision'), 'internal_row_kind'), 'included-scope')
assert.equal(column(byId.get('multi-room-package'), 'internal_row_kind'), 'sales-condition')
assert.equal(column(byId.get('interior-small-set'), 'publication_sequence'), '7')
assert.equal(column(byId.get('included-minor-revision'), 'price_fixed'), '')
assert.equal(column(byId.get('major-revision'), 'price_fixed'), '')
assert.equal(column(byId.get('major-revision'), 'currency'), '')
assert.equal(column(byId.get('multi-room-package'), 'currency'), '')

const escapingFixture = publicReadyFixture()
escapingFixture.items[0].description.hr = 'Č, ć, ž, š, đ i "navodnici", sa zarezom'
const escapedRows = parseCsv(renderPricingCsv(escapingFixture))
const escapedHeader = escapedRows[0]
assert.equal(
  escapedRows[1][escapedHeader.indexOf('description_hr')],
  'Č, ć, ž, š, đ i "navodnici", sa zarezom',
)

const duplicateFixture = publicReadyFixture()
duplicateFixture.items[1].id = duplicateFixture.items[0].id
expectFailure(
  () => validatePricingDocument(duplicateFixture),
  /Duplicate ID/,
)

const zeroFromFixture = publicReadyFixture()
zeroFromFixture.items.find((item) => item.id === 'interior-small-set').price.minCents = 0
expectFailure(
  () => validatePricingDocument(zeroFromFixture),
  /minCents mora biti pozitivan integer/,
)

const zeroFixedFixture = publicReadyFixture()
zeroFixedFixture.items.find(
  (item) => item.id === 'photorealistic-visualization',
).price.amountCents = 0
expectFailure(
  () => validatePricingDocument(zeroFixedFixture),
  /amountCents mora biti pozitivan integer/,
)

const rangeFixture = publicReadyFixture()
const complexityItem = rangeFixture.items.find(
  (item) => item.id === 'additional-3d-complexity',
)
complexityItem.price = { type: 'range', minCents: 500, maxCents: 1500 }

const zeroRangeMinFixture = structuredClone(rangeFixture)
zeroRangeMinFixture.items.find(
  (item) => item.id === 'additional-3d-complexity',
).price.minCents = 0
expectFailure(
  () => validatePricingDocument(zeroRangeMinFixture),
  /minCents mora biti pozitivan integer/,
)

const zeroRangeMaxFixture = structuredClone(rangeFixture)
zeroRangeMaxFixture.items.find(
  (item) => item.id === 'additional-3d-complexity',
).price.maxCents = 0
expectFailure(
  () => validatePricingDocument(zeroRangeMaxFixture),
  /maxCents mora biti pozitivan integer/,
)

const negativeMoneyFixture = publicReadyFixture()
negativeMoneyFixture.items.find(
  (item) => item.id === 'photorealistic-visualization',
).price.amountCents = -1
expectFailure(
  () => validatePricingDocument(negativeMoneyFixture),
  /amountCents mora biti pozitivan integer/,
)

const badRangeFixture = structuredClone(rangeFixture)
badRangeFixture.items.find((item) => item.id === 'additional-3d-complexity').price.minCents =
  2000
expectFailure(
  () => validatePricingDocument(badRangeFixture),
  /minCents ne smije biti veći/,
)

const zeroUnitFixture = publicReadyFixture()
zeroUnitFixture.items.find((item) => item.id === 'additional-3d-complexity').price.amountCents = 0
expectFailure(
  () => validatePricingDocument(zeroUnitFixture),
  /amountCents mora biti pozitivan integer/,
)

const validNonMonetaryFixture = publicReadyFixture()
assert.doesNotThrow(() => validatePricingDocument(validNonMonetaryFixture))
assert.equal(
  validNonMonetaryFixture.items.find((item) => item.id === 'included-minor-revision').price.type,
  'included',
)
assert.equal(
  validNonMonetaryFixture.items.find((item) => item.id === 'major-revision').price.type,
  'quote',
)
assert.equal(
  validNonMonetaryFixture.items.find((item) => item.id === 'multi-room-package').price.percent,
  10,
)

const includedWithMoneyFixture = publicReadyFixture()
includedWithMoneyFixture.items.find(
  (item) => item.id === 'included-minor-revision',
).price.amountCents = 0
expectFailure(
  () => validatePricingDocument(includedWithMoneyFixture),
  /nedopušteno polje "amountCents"/,
)

const quoteWithMoneyFixture = publicReadyFixture()
quoteWithMoneyFixture.items.find((item) => item.id === 'major-revision').price.amountCents = 0
expectFailure(
  () => validatePricingDocument(quoteWithMoneyFixture),
  /nedopušteno polje "amountCents"/,
)

const discountWithMoneyFixture = publicReadyFixture()
discountWithMoneyFixture.items.find(
  (item) => item.id === 'multi-room-package',
).price.amountCents = -1000
expectFailure(
  () => validatePricingDocument(discountWithMoneyFixture),
  /nedopušteno polje "amountCents"/,
)

const zeroDiscountFixture = publicReadyFixture()
zeroDiscountFixture.items.find((item) => item.id === 'multi-room-package').price.percent = 0
expectFailure(
  () => validatePricingDocument(zeroDiscountFixture),
  /percent mora biti broj veći od 0/,
)

const overMaximumDiscountFixture = publicReadyFixture()
overMaximumDiscountFixture.items.find(
  (item) => item.id === 'multi-room-package',
).price.percent = 101
expectFailure(
  () => validatePricingDocument(overMaximumDiscountFixture),
  /percent mora biti broj veći od 0/,
)

const maximumDiscountFixture = publicReadyFixture()
maximumDiscountFixture.items.find(
  (item) => item.id === 'multi-room-package',
).price.percent = 100
assert.doesNotThrow(() => validatePricingDocument(maximumDiscountFixture))

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'interiors-pricing-'))
try {
  const sourcePath = path.join(tempDir, 'pricing.json')
  const currentPath = path.join(tempDir, 'public', 'interijeri.csv')
  const archiveDir = path.join(tempDir, 'public', 'arhiva')
  await writeFile(sourcePath, JSON.stringify(fixture), 'utf8')

  const first = await generatePricingFiles({ sourcePath, currentPath, archiveDir })
  await generatePricingFiles({ sourcePath, currentPath, archiveDir })
  assert.equal(await readFile(currentPath, 'utf8'), first.csv)

  const reusedSequenceFixture = publicReadyFixture()
  reusedSequenceFixture.version = '2026-10-02T09-00-00Z'
  reusedSequenceFixture.validFrom = '2026-10-02T09:00:00Z'
  reusedSequenceFixture.publishedAt = '2026-10-02T08:30:00Z'
  for (const item of reusedSequenceFixture.items) {
    item.introducedAt = '2026-10-01'
  }
  await writeFile(sourcePath, JSON.stringify(reusedSequenceFixture), 'utf8')
  await assert.rejects(
    generatePricingFiles({ sourcePath, currentPath, archiveDir }),
    /publication identity mora imati novu version, sequence i publishedAt/,
  )

  await writeFile(sourcePath, JSON.stringify(fixture), 'utf8')
  const archivePath = path.join(archiveDir, archiveFilename(fixture))
  await writeFile(archivePath, `${first.csv}changed`, 'utf8')
  await assert.rejects(
    generatePricingFiles({ sourcePath, currentPath, archiveDir }),
    /već postoji s drukčijim sadržajem/,
  )
} finally {
  await rm(tempDir, { recursive: true, force: true })
}

console.log('Interiors pricing generator checks passed.')
