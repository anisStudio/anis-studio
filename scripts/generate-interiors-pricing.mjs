import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_SOURCE = 'src/data/interiorsPricing.json'
const DEFAULT_CURRENT = 'public/cjenik/interijeri.csv'
const DEFAULT_ARCHIVE_DIR = 'public/cjenik/arhiva'
const STABLE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ISO_UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const FILENAME_TOKEN_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CSV_EOL = '\r\n'
const EXPECTED_PRICING_ITEM_IDS = new Set([
  'interior-small-set',
  'interior-room',
  'interior-kitchen',
  'photorealistic-visualization',
  'included-minor-revision',
  'additional-3d-complexity',
  'major-revision',
  'multi-room-package',
])

function fail(message) {
  throw new Error(`[interiors-pricing] ${message}`)
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${field} mora biti neprazan string.`)
  }
}

function requireIntegerCents(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(`${field} mora biti nenegativan integer iznos u centima.`)
  }
}

function requirePositiveIntegerCents(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail(`${field} mora biti pozitivan integer iznos u centima.`)
  }
}

function requirePositiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail(`${field} mora biti pozitivan integer.`)
  }
}

function validateIsoTimestamp(value, field) {
  requireNonEmptyString(value, field)
  if (!ISO_UTC_TIMESTAMP_PATTERN.test(value)) {
    fail(`${field} mora biti UTC datum/vrijeme u obliku YYYY-MM-DDTHH:mm:ssZ.`)
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().replace('.000Z', 'Z') !== value) {
    fail(`${field} nije valjan UTC datum/vrijeme.`)
  }
}

function validateVersion(value) {
  requireNonEmptyString(value, 'version')
  if (!VERSION_PATTERN.test(value)) {
    fail('version mora biti URL-safe UTC oznaka YYYY-MM-DDTHH-mm-ssZ.')
  }
  validateIsoTimestamp(
    `${value.slice(0, 13)}:${value.slice(14, 16)}:${value.slice(17, 19)}Z`,
    'version',
  )
}

function validateCalendarDate(value, field) {
  requireNonEmptyString(value, field)
  if (!DATE_PATTERN.test(value)) {
    fail(`${field} mora biti u obliku YYYY-MM-DD.`)
  }
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    fail(`${field} nije valjan kalendarski datum.`)
  }
}

function rejectUnexpectedKeys(record, allowedKeys, field) {
  for (const key of Object.keys(record)) {
    if (!allowedKeys.includes(key)) {
      fail(`${field} sadrži nedopušteno polje "${key}".`)
    }
  }
}

function validateLocalizedText(value, field) {
  if (!isRecord(value)) fail(`${field} mora biti objekt.`)
  requireNonEmptyString(value.hr, `${field}.hr`)
  requireNonEmptyString(value.en, `${field}.en`)
}

function validateFilenameToken(value, field) {
  requireNonEmptyString(value, field)
  if (!FILENAME_TOKEN_PATTERN.test(value)) {
    fail(`${field} mora biti filesystem/URL-safe token malim slovima.`)
  }
}

function validatePublicationMetadata(document, { requireComplete = false } = {}) {
  if (!isRecord(document.publication)) fail('publication mora biti objekt.')
  rejectUnexpectedKeys(document.publication, ['sequence', 'filename'], 'publication')
  if (!isRecord(document.publication.filename)) {
    fail('publication.filename mora biti objekt.')
  }
  rejectUnexpectedKeys(
    document.publication.filename,
    ['serviceObjectTypeToken'],
    'publication.filename',
  )

  if (document.publication.sequence !== null) {
    requirePositiveInteger(document.publication.sequence, 'publication.sequence')
  } else if (requireComplete) {
    fail('publication.sequence mora biti postavljen prije javne objave.')
  }

  const objectTypeToken = document.publication.filename.serviceObjectTypeToken
  if (objectTypeToken !== null) {
    validateFilenameToken(
      objectTypeToken,
      'publication.filename.serviceObjectTypeToken',
    )
  } else if (requireComplete) {
    fail(
      'publication.filename.serviceObjectTypeToken mora biti potvrđen prije javne objave.',
    )
  }
}

function validateRegulatoryMappings(document, { requireResolved = false } = {}) {
  if (!isRecord(document.regulatoryMappings)) {
    fail('regulatoryMappings mora biti objekt.')
  }
  rejectUnexpectedKeys(
    document.regulatoryMappings,
    ['kitchenReferencePriceTreatment'],
    'regulatoryMappings',
  )

  const kitchen = document.regulatoryMappings.kitchenReferencePriceTreatment
  if (!isRecord(kitchen)) {
    fail('regulatoryMappings.kitchenReferencePriceTreatment mora biti objekt.')
  }
  rejectUnexpectedKeys(
    kitchen,
    ['status', 'resolutionCode'],
    'regulatoryMappings.kitchenReferencePriceTreatment',
  )
  if (kitchen.status !== 'unresolved' && kitchen.status !== 'resolved') {
    fail(
      'regulatoryMappings.kitchenReferencePriceTreatment.status mora biti unresolved ili resolved.',
    )
  }
  if (kitchen.status === 'unresolved') {
    if (kitchen.resolutionCode !== null) {
      fail(
        'Neriješeni kitchen reference-price tretman ne smije imati resolutionCode.',
      )
    }
  } else {
    validateFilenameToken(
      kitchen.resolutionCode,
      'regulatoryMappings.kitchenReferencePriceTreatment.resolutionCode',
    )
  }
  if (requireResolved && kitchen.status !== 'resolved') {
    fail(
      'Kitchen anchor/reference price tretman je neriješen; javna objava nije dopuštena.',
    )
  }
}

function validatePrice(price, itemId, knownIds) {
  if (!isRecord(price) || typeof price.type !== 'string') {
    fail(`${itemId}.price mora biti objekt s price type vrijednošću.`)
  }

  const field = `${itemId}.price`
  switch (price.type) {
    case 'from':
      rejectUnexpectedKeys(price, ['type', 'minCents'], field)
      requirePositiveIntegerCents(price.minCents, `${field}.minCents`)
      break
    case 'fixed':
      rejectUnexpectedKeys(price, ['type', 'amountCents'], field)
      requirePositiveIntegerCents(price.amountCents, `${field}.amountCents`)
      break
    case 'unit':
      rejectUnexpectedKeys(price, ['type', 'amountCents', 'appliesTo'], field)
      requirePositiveIntegerCents(price.amountCents, `${field}.amountCents`)
      validateIdReferences(price.appliesTo, `${field}.appliesTo`, knownIds)
      break
    case 'range':
      rejectUnexpectedKeys(price, ['type', 'minCents', 'maxCents'], field)
      requirePositiveIntegerCents(price.minCents, `${field}.minCents`)
      requirePositiveIntegerCents(price.maxCents, `${field}.maxCents`)
      if (price.minCents > price.maxCents) {
        fail(`${field}.minCents ne smije biti veći od maxCents.`)
      }
      break
    case 'quote':
      rejectUnexpectedKeys(price, ['type'], field)
      break
    case 'included':
      rejectUnexpectedKeys(price, ['type', 'quantity', 'appliesTo'], field)
      if (!Number.isSafeInteger(price.quantity) || price.quantity <= 0) {
        fail(`${field}.quantity mora biti pozitivan integer.`)
      }
      validateIdReferences(price.appliesTo, `${field}.appliesTo`, knownIds)
      break
    case 'discount':
      rejectUnexpectedKeys(
        price,
        ['type', 'percent', 'minimumRooms', 'appliesTo', 'excludes'],
        field,
      )
      if (typeof price.percent !== 'number' || price.percent <= 0 || price.percent > 100) {
        fail(`${field}.percent mora biti broj veći od 0 i manji ili jednak 100.`)
      }
      if (!Number.isSafeInteger(price.minimumRooms) || price.minimumRooms < 1) {
        fail(`${field}.minimumRooms mora biti pozitivan integer.`)
      }
      validateIdReferences(price.appliesTo, `${field}.appliesTo`, knownIds)
      validateIdReferences(price.excludes, `${field}.excludes`, knownIds)
      break
    default:
      fail(`${field}.type "${price.type}" nije podržan.`)
  }
}

function validateIdReferences(value, field, knownIds) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${field} mora biti neprazan popis ID-eva.`)
  }
  for (const id of value) {
    if (typeof id !== 'string' || !knownIds.has(id)) {
      fail(`${field} sadrži nepoznat ID "${String(id)}".`)
    }
  }
}

export function validatePricingDocument(
  document,
  { requirePublicReady = true, archivedIntroductions = new Map() } = {},
) {
  if (!isRecord(document)) fail('Korijenski JSON mora biti objekt.')
  if (document.schemaVersion !== 1) fail('Podržan je samo schemaVersion 1.')
  if (document.currency !== 'EUR') fail('currency mora biti EUR.')
  if (document.publicationStatus !== 'draft' && document.publicationStatus !== 'public-ready') {
    fail('publicationStatus mora biti draft ili public-ready.')
  }
  validatePublicationMetadata(document)
  validateRegulatoryMappings(document)
  if (!isRecord(document.issuer)) fail('issuer mora biti objekt.')

  for (const key of [
    'name',
    'department',
    'addressLine',
    'postalCode',
    'city',
    'country',
    'domain',
    'businessPremisesCode',
  ]) {
    requireNonEmptyString(document.issuer[key], `issuer.${key}`)
  }
  if (document.issuer.businessPremisesCode !== 'P1') {
    fail('issuer.businessPremisesCode mora koristiti postojeću oznaku P1.')
  }

  if (!Array.isArray(document.items) || document.items.length === 0) {
    fail('items mora biti neprazan popis.')
  }

  const ids = new Set()
  const displayOrders = new Set()
  for (const item of document.items) {
    if (!isRecord(item)) fail('Svaka stavka mora biti objekt.')
    requireNonEmptyString(item.id, 'items[].id')
    if (!STABLE_ID_PATTERN.test(item.id)) {
      fail(`ID "${item.id}" nije valjan stabilni slug.`)
    }
    if (ids.has(item.id)) fail(`Duplicate ID: ${item.id}.`)
    ids.add(item.id)

    if (!Number.isSafeInteger(item.displayOrder) || item.displayOrder <= 0) {
      fail(`${item.id}.displayOrder mora biti pozitivan integer.`)
    }
    if (displayOrders.has(item.displayOrder)) {
      fail(`Duplicate displayOrder: ${item.displayOrder}.`)
    }
    displayOrders.add(item.displayOrder)
  }

  if (document.items.length !== EXPECTED_PRICING_ITEM_IDS.size) {
    fail(`items mora sadržavati točno ${EXPECTED_PRICING_ITEM_IDS.size} stavki.`)
  }
  for (const id of ids) {
    if (!EXPECTED_PRICING_ITEM_IDS.has(id)) {
      fail(`Nepoznat pricing ID: ${id}.`)
    }
  }
  for (const expectedId of EXPECTED_PRICING_ITEM_IDS) {
    if (!ids.has(expectedId)) {
      fail(`Nedostaje očekivani pricing ID: ${expectedId}.`)
    }
  }

  for (const item of document.items) {
    validateLocalizedText(item.name, `${item.id}.name`)
    if (item.description !== undefined) {
      validateLocalizedText(item.description, `${item.id}.description`)
    }
    if (!isRecord(item.basis)) fail(`${item.id}.basis mora biti objekt.`)
    requireNonEmptyString(item.basis.code, `${item.id}.basis.code`)
    requireNonEmptyString(item.basis.hr, `${item.id}.basis.hr`)
    requireNonEmptyString(item.basis.en, `${item.id}.basis.en`)
    if (item.calculationNotes !== undefined) {
      validateLocalizedText(item.calculationNotes, `${item.id}.calculationNotes`)
    }
    if (typeof item.public !== 'boolean') fail(`${item.id}.public mora biti boolean.`)
    if (!['base', 'additional', 'included', 'discount'].includes(item.category)) {
      fail(`${item.id}.category nije podržana.`)
    }
    if (item.specialSale !== undefined) {
      if (!isRecord(item.specialSale) || typeof item.specialSale.applicable !== 'boolean') {
        fail(`${item.id}.specialSale nije valjan.`)
      }
      validateLocalizedText(item.specialSale.label, `${item.id}.specialSale.label`)
    }
    if (item.reference !== undefined) {
      if (!isRecord(item.reference)) fail(`${item.id}.reference nije valjan.`)
      requireIntegerCents(item.reference.amountCents, `${item.id}.reference.amountCents`)
      validateCalendarDate(item.reference.date, `${item.id}.reference.date`)
      if (item.reference.label !== undefined) {
        validateLocalizedText(item.reference.label, `${item.id}.reference.label`)
      }
    }

    validatePrice(item.price, item.id, ids)

    if (item.introducedAt !== null) {
      validateCalendarDate(item.introducedAt, `${item.id}.introducedAt`)
    }
    if (item.validFrom !== undefined && item.validFrom !== null) {
      validateCalendarDate(item.validFrom, `${item.id}.validFrom`)
      if (
        item.introducedAt !== null &&
        item.introducedAt > item.validFrom
      ) {
        fail(`${item.id}.introducedAt ne smije biti nakon validFrom.`)
      }
    }
    const archivedDate = archivedIntroductions.get(item.id)
    if (archivedDate && item.introducedAt !== archivedDate) {
      fail(
        `${item.id}.introducedAt (${String(item.introducedAt)}) ne odgovara arhiviranoj vrijednosti ${archivedDate}.`,
      )
    }
  }

  const isPublicReady = document.publicationStatus === 'public-ready'
  if (requirePublicReady && !isPublicReady) {
    fail('Cjenik je draft; javno generiranje nije dopušteno.')
  }

  if (isPublicReady || requirePublicReady) {
    validatePublicationMetadata(document, { requireComplete: true })
    validateRegulatoryMappings(document, { requireResolved: true })
    validateVersion(document.version)
    validateIsoTimestamp(document.validFrom, 'validFrom')
    validateIsoTimestamp(document.publishedAt, 'publishedAt')
    for (const item of document.items.filter((candidate) => candidate.public)) {
      if (item.introducedAt === null) {
        fail(`${item.id}.introducedAt mora biti potvrđen prije javne objave.`)
      }
      if (item.introducedAt > document.validFrom.slice(0, 10)) {
        fail(`${item.id}.introducedAt ne smije biti nakon datuma validFrom.`)
      }
    }
  } else {
    for (const [field, value] of [
      ['version', document.version],
      ['validFrom', document.validFrom],
      ['publishedAt', document.publishedAt],
    ]) {
      if (value !== null) {
        if (field === 'version') {
          validateVersion(value)
        } else {
          validateIsoTimestamp(value, field)
        }
      }
    }
  }

  return document
}

export function escapeCsv(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function centsToCsv(cents) {
  return (cents / 100).toFixed(2)
}

function priceColumns(item) {
  const blank = {
    price_from: '',
    price_fixed: '',
    price_min: '',
    price_max: '',
    discount_percent: '',
    included_quantity: '',
    minimum_rooms: '',
    applies_to: '',
    excludes: '',
  }

  switch (item.price.type) {
    case 'from':
      return { ...blank, price_from: centsToCsv(item.price.minCents) }
    case 'fixed':
      return { ...blank, price_fixed: centsToCsv(item.price.amountCents) }
    case 'unit':
      return {
        ...blank,
        price_fixed: centsToCsv(item.price.amountCents),
        applies_to: item.price.appliesTo.join(';'),
      }
    case 'range':
      return {
        ...blank,
        price_min: centsToCsv(item.price.minCents),
        price_max: centsToCsv(item.price.maxCents),
      }
    case 'included':
      return {
        ...blank,
        included_quantity: item.price.quantity,
        applies_to: item.price.appliesTo.join(';'),
      }
    case 'discount':
      return {
        ...blank,
        discount_percent: item.price.percent,
        minimum_rooms: item.price.minimumRooms,
        applies_to: item.price.appliesTo.join(';'),
        excludes: item.price.excludes.join(';'),
      }
    case 'quote':
      return blank
  }
}

function displayPriceHr(item) {
  switch (item.price.type) {
    case 'from':
      return `od ${centsToCsv(item.price.minCents)} EUR`
    case 'fixed':
      return `${centsToCsv(item.price.amountCents)} EUR`
    case 'unit':
      return `${centsToCsv(item.price.amountCents)} EUR / obračunska jedinica`
    case 'range':
      return `${centsToCsv(item.price.minCents)}–${centsToCsv(item.price.maxCents)} EUR`
    case 'quote':
      return 'prema opsegu'
    case 'discount':
      return `${item.price.percent} % popusta`
    case 'included':
      return 'uključeno u osnovnu cijenu'
  }
}

function internalRowKind(item) {
  if (item.price.type === 'included') return 'included-scope'
  if (item.price.type === 'discount') return 'sales-condition'
  return 'chargeable-service'
}

const CSV_COLUMNS = [
  'schema_version',
  'price_list_version',
  'publication_sequence',
  'valid_from',
  'published_at',
  'service_object_type_token',
  'issuer_name',
  'department',
  'business_premises_code',
  'address',
  'postal_code',
  'city',
  'country',
  'item_id',
  'display_order',
  'category',
  'name_hr',
  'name_en',
  'description_hr',
  'description_en',
  'internal_row_kind',
  'internal_price_type',
  'currency',
  'price_from',
  'price_fixed',
  'price_min',
  'price_max',
  'discount_percent',
  'included_quantity',
  'minimum_rooms',
  'applies_to',
  'excludes',
  'price_display_hr',
  'basis_code',
  'basis_hr',
  'calculation_notes_hr',
  'special_sale',
  'special_sale_description_hr',
  'reference_price',
  'reference_date',
  'introduced_at',
]

export function renderPricingCsv(document) {
  const rows = [CSV_COLUMNS.map(escapeCsv).join(',')]
  const items = document.items
    .filter((item) => item.public)
    .sort((a, b) => a.displayOrder - b.displayOrder)

  for (const item of items) {
    const price = priceColumns(item)
    const row = {
      schema_version: document.schemaVersion,
      price_list_version: document.version,
      publication_sequence: document.publication.sequence,
      valid_from: document.validFrom,
      published_at: document.publishedAt,
      service_object_type_token:
        document.publication.filename.serviceObjectTypeToken,
      issuer_name: document.issuer.name,
      department: document.issuer.department,
      business_premises_code: document.issuer.businessPremisesCode,
      address: document.issuer.addressLine,
      postal_code: document.issuer.postalCode,
      city: document.issuer.city,
      country: document.issuer.country,
      item_id: item.id,
      display_order: item.displayOrder,
      category: item.category,
      name_hr: item.name.hr,
      name_en: item.name.en,
      description_hr: item.description?.hr ?? '',
      description_en: item.description?.en ?? '',
      internal_row_kind: internalRowKind(item),
      internal_price_type: item.price.type,
      currency: ['from', 'fixed', 'range', 'unit'].includes(item.price.type)
        ? document.currency
        : '',
      ...price,
      price_display_hr: displayPriceHr(item),
      basis_code: item.basis.code,
      basis_hr: item.basis.hr,
      calculation_notes_hr: item.calculationNotes?.hr ?? '',
      special_sale: item.specialSale?.applicable ? 'DA' : 'NE',
      special_sale_description_hr: item.specialSale?.label.hr ?? '',
      reference_price:
        item.reference?.amountCents === undefined
          ? ''
          : centsToCsv(item.reference.amountCents),
      reference_date: item.reference?.date ?? '',
      introduced_at: item.introducedAt,
    }
    rows.push(CSV_COLUMNS.map((column) => escapeCsv(row[column])).join(','))
  }

  return `${rows.join(CSV_EOL)}${CSV_EOL}`
}

export function parseCsv(csv) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    if (quoted) {
      if (char === '"' && csv[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\r' && csv[index + 1] === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      index += 1
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (quoted) fail('CSV završava unutar nezatvorenog navodnika.')
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

async function readArchivedIntroductions(archiveDir) {
  const result = new Map()
  let files
  try {
    files = await readdir(archiveDir)
  } catch (error) {
    if (error && error.code === 'ENOENT') return result
    throw error
  }

  for (const file of files.filter((name) => name.endsWith('.csv'))) {
    const csv = await readFile(path.join(archiveDir, file), 'utf8')
    const rows = parseCsv(csv)
    if (rows.length === 0) continue
    const header = rows[0]
    const idIndex = header.indexOf('item_id')
    const introducedIndex = header.indexOf('introduced_at')
    if (idIndex < 0 || introducedIndex < 0) {
      fail(`Arhiva ${file} nema item_id i introduced_at stupce.`)
    }
    for (const row of rows.slice(1)) {
      const id = row[idIndex]
      const introducedAt = row[introducedIndex]
      if (!id || !introducedAt) continue
      const existing = result.get(id)
      if (existing && existing !== introducedAt) {
        fail(`Arhive sadrže različite introducedAt vrijednosti za ${id}.`)
      }
      result.set(id, introducedAt)
    }
  }
  return result
}

async function readArchivedPublicationIdentities(archiveDir) {
  let files
  try {
    files = await readdir(archiveDir)
  } catch (error) {
    if (error && error.code === 'ENOENT') return []
    throw error
  }

  const identities = []
  for (const file of files.filter((name) => name.endsWith('.csv'))) {
    const rows = parseCsv(await readFile(path.join(archiveDir, file), 'utf8'))
    if (rows.length < 2) {
      fail(`Arhiva ${file} nema podatkovne retke.`)
    }
    const header = rows[0]
    const versionIndex = header.indexOf('price_list_version')
    const sequenceIndex = header.indexOf('publication_sequence')
    const publishedAtIndex = header.indexOf('published_at')
    if (versionIndex < 0 || sequenceIndex < 0 || publishedAtIndex < 0) {
      fail(
        `Arhiva ${file} nema price_list_version, publication_sequence i published_at stupce.`,
      )
    }
    identities.push({
      file,
      version: rows[1][versionIndex],
      sequence: rows[1][sequenceIndex],
      publishedAt: rows[1][publishedAtIndex],
    })
  }
  return identities
}

function filenamePart(value, field) {
  requireNonEmptyString(value, field)
  const normalized = value
    .replaceAll('Đ', 'D')
    .replaceAll('đ', 'd')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (normalized === '') {
    fail(`${field} nije moguće pretvoriti u filesystem/URL-safe dio naziva.`)
  }
  return normalized
}

function publicationTimestampPart(value) {
  validateIsoTimestamp(value, 'publishedAt')
  return value.replaceAll('-', '').replaceAll(':', '')
}

export function publicationFilename(document) {
  validatePublicationMetadata(document, { requireComplete: true })
  validateVersion(document.version)
  const objectTypeToken =
    document.publication.filename.serviceObjectTypeToken
  const address = filenamePart(
    [
      document.issuer.addressLine,
      document.issuer.postalCode,
      document.issuer.city,
      document.issuer.country,
    ].join(' '),
    'issuer address',
  )
  const premises = document.issuer.businessPremisesCode
  if (premises !== 'P1') {
    fail('issuer.businessPremisesCode mora koristiti postojeću oznaku P1.')
  }
  const timestamp = publicationTimestampPart(document.publishedAt)
  return [
    objectTypeToken,
    address,
    premises,
    document.publication.sequence,
    timestamp,
    document.version,
  ].join('_') + '.csv'
}

export function archiveFilename(document) {
  return publicationFilename(document)
}

function validateArchivePublicationIdentity(document, identities) {
  const expectedFilename = archiveFilename(document)
  const sequence = String(document.publication.sequence)
  for (const archived of identities) {
    const sameVersion = archived.version === document.version
    const sameSequence = archived.sequence === sequence
    const sameTimestamp = archived.publishedAt === document.publishedAt
    if (!sameVersion && !sameSequence && !sameTimestamp) continue

    if (!(sameVersion && sameSequence && sameTimestamp)) {
      fail(
        `Arhivski publication identity mora imati novu version, sequence i publishedAt vrijednost (konflikt: ${archived.file}).`,
      )
    }
    if (archived.file !== expectedFilename) {
      fail(
        `Publication identity već postoji pod drukčijim nazivom arhive: ${archived.file}.`,
      )
    }
  }
}

export async function generatePricingFiles({
  sourcePath = DEFAULT_SOURCE,
  currentPath = DEFAULT_CURRENT,
  archiveDir = DEFAULT_ARCHIVE_DIR,
} = {}) {
  const raw = await readFile(sourcePath, 'utf8')
  const document = JSON.parse(raw)
  const archivedIntroductions = await readArchivedIntroductions(archiveDir)
  const archivedPublications =
    await readArchivedPublicationIdentities(archiveDir)
  validatePricingDocument(document, { requirePublicReady: true, archivedIntroductions })
  validateArchivePublicationIdentity(document, archivedPublications)
  const csv = renderPricingCsv(document)

  const parsed = parseCsv(csv)
  if (parsed.length !== document.items.filter((item) => item.public).length + 1) {
    fail('CSV round-trip provjera nije uspjela.')
  }

  const archivePath = path.join(archiveDir, archiveFilename(document))
  let existingArchive = null
  try {
    existingArchive = await readFile(archivePath, 'utf8')
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error
  }
  if (existingArchive !== null && existingArchive !== csv) {
    fail(`Arhivska verzija ${archivePath} već postoji s drukčijim sadržajem.`)
  }

  await mkdir(path.dirname(currentPath), { recursive: true })
  await mkdir(archiveDir, { recursive: true })
  if (existingArchive === null) {
    await writeFile(archivePath, csv, 'utf8')
  }
  await writeFile(currentPath, csv, 'utf8')

  const current = await readFile(currentPath, 'utf8')
  const archived = await readFile(archivePath, 'utf8')
  if (current !== archived) {
    fail('Aktualni CSV nije identičan aktualnoj arhivskoj verziji.')
  }

  return { currentPath, archivePath, csv }
}

async function runCli() {
  const args = new Set(process.argv.slice(2))
  const allowDraft = args.has('--allow-draft')
  const validateOnly = args.has('--validate-only')
  if (allowDraft && !validateOnly) {
    fail('--allow-draft smije se koristiti samo uz --validate-only.')
  }

  if (validateOnly) {
    const raw = await readFile(DEFAULT_SOURCE, 'utf8')
    const document = JSON.parse(raw)
    const archivedIntroductions = await readArchivedIntroductions(DEFAULT_ARCHIVE_DIR)
    const archivedPublications =
      await readArchivedPublicationIdentities(DEFAULT_ARCHIVE_DIR)
    validatePricingDocument(document, {
      requirePublicReady: !allowDraft,
      archivedIntroductions,
    })
    if (document.publicationStatus === 'public-ready') {
      validateArchivePublicationIdentity(document, archivedPublications)
    }
    console.log(
      allowDraft
        ? 'Interiors pricing draft is structurally valid.'
        : 'Interiors pricing is valid and public-ready.',
    )
    return
  }

  const result = await generatePricingFiles()
  console.log(`Generated ${result.currentPath}`)
  console.log(`Archived ${result.archivePath}`)
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
