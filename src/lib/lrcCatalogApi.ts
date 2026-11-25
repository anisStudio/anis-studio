import { supabase, isSupabaseConfigured } from './supabase'
import {
  isMissingLrcCatalogError,
  lrcProductFromParts,
  lrcProductContent,
  lrcProductImageDirectUrl,
  lrcProductImageObjectPath,
  newLrcProductInsert,
  unusedLrcStorageObjectPaths,
  publicCatalogFromFetch,
  publicCatalogWhenUnconfigured,
  sortLrcProducts,
  type LrcProduct,
  type LrcProductDraft,
  type PublicLrcCatalogResult,
} from './lrcCatalog'
import { frameColorFromImageFile } from './lrcPhotoFrame'

const TABLE = 'lrc_products'
const BUCKET = 'lrc-product-images'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

export type LrcCatalogErrorCode = 'not_configured' | 'missing_table' | 'request'

export function lrcCatalogError(code: LrcCatalogErrorCode, message: string): Error {
  const error = new Error(message)
  error.name = 'LrcCatalogError'
  ;(error as Error & { catalogCode: LrcCatalogErrorCode }).catalogCode = code
  return error
}

export function lrcCatalogErrorCode(error: unknown): LrcCatalogErrorCode | null {
  if (!(error instanceof Error) || error.name !== 'LrcCatalogError') return null
  const code = (error as Error & { catalogCode?: LrcCatalogErrorCode }).catalogCode
  return code ?? 'request'
}

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw lrcCatalogError('not_configured', 'Supabase nije konfiguriran. Katalog se ne može uređivati.')
  }
  return supabase
}

async function requireAuth(client: ReturnType<typeof requireClient>): Promise<void> {
  const { data, error } = await client.auth.getUser()
  if (error) throw lrcCatalogError('request', `Prijava: ${error.message}`)
  if (!data.user) throw lrcCatalogError('request', 'Morate biti prijavljeni za tu radnju.')
}

function throwQueryError(error: { code?: string; message?: string }, context: string): never {
  if (isMissingLrcCatalogError(error)) {
    throw lrcCatalogError(
      'missing_table',
      'Tablica lrc_products još nije na ovoj bazi. Javne stranice i dalje prikazuju tri odobrene kutije.',
    )
  }
  throw lrcCatalogError('request', `${context}: ${error.message ?? 'nepoznata greška'}`)
}

interface LrcProductRow {
  code: string
  is_visible: boolean
  sort_order: number
  content: unknown
}

async function fetchRows(visibleOnly: boolean, strict: boolean): Promise<LrcProduct[]> {
  const client = requireClient()
  let query = client
    .from(TABLE)
    .select('code, is_visible, sort_order, content')
    .order('sort_order', { ascending: true })
    .order('code', { ascending: true })
  if (visibleOnly) query = query.eq('is_visible', true)
  const { data, error } = await query
  if (error) throwQueryError(error, 'Dohvat LRC proizvoda')
  const products: LrcProduct[] = []
  for (const row of (data ?? []) as LrcProductRow[]) {
    const product = lrcProductFromParts(row.code, row.is_visible === true, Number(row.sort_order), row.content)
    if (!product) {
      if (strict) throw lrcCatalogError('request', `Proizvod ${row.code} ima neispravan sadržaj.`)
      console.error(`[LRC catalog] Preskačem neispravan proizvod ${row.code}.`)
      continue
    }
    products.push(product)
  }
  return sortLrcProducts(products)
}

export async function fetchPublicLrcProducts(): Promise<PublicLrcCatalogResult> {
  if (!isSupabaseConfigured || !supabase) return publicCatalogWhenUnconfigured()
  try {
    const products = await fetchRows(true, false)
    return publicCatalogFromFetch({ ok: true, products })
  } catch (error) {
    const code = lrcCatalogErrorCode(error)
    if (code === 'not_configured' || code === 'missing_table') return publicCatalogWhenUnconfigured()
    console.error('[LRC catalog]', error)
    return publicCatalogFromFetch({
      ok: false,
      error: { message: error instanceof Error ? error.message : 'request failed' },
    })
  }
}

export async function fetchAdminLrcProducts(): Promise<LrcProduct[]> {
  return fetchRows(false, true)
}

export async function createLrcProduct(draft: LrcProductDraft): Promise<void> {
  const client = requireClient()
  await requireAuth(client)
  const row = newLrcProductInsert(draft)
  const { data, error } = await client.from(TABLE).insert(row).select('code, is_visible')
  if (error) throwQueryError(error, 'Dodavanje proizvoda')
  const inserted = (data ?? []) as { is_visible?: boolean }[]
  if (inserted.length === 0) {
    throw lrcCatalogError('request', 'Proizvod nije dodan. Provjeri administratorske ovlasti.')
  }
  if (inserted[0]?.is_visible !== false) {
    throw lrcCatalogError('request', 'Novi proizvod mora početi skriven.')
  }
}

export async function updateLrcProduct(code: string, draft: LrcProductDraft): Promise<void> {
  const client = requireClient()
  await requireAuth(client)
  const { data, error } = await client
    .from(TABLE)
    .update({ sort_order: draft.sortOrder, content: lrcProductContent(draft) })
    .eq('code', code)
    .select('code')
  if (error) throwQueryError(error, 'Spremanje proizvoda')
  if (!data?.length) {
    throw lrcCatalogError('request', 'Promjena nije spremljena. Provjeri administratorske ovlasti.')
  }
}

export async function deleteLrcProduct(code: string): Promise<void> {
  const client = requireClient()
  await requireAuth(client)
  const { data, error } = await client.from(TABLE).delete().eq('code', code).select('code')
  if (error) throwQueryError(error, 'Brisanje proizvoda')
  if (!data?.length) {
    throw lrcCatalogError('request', 'Proizvod nije obrisan. Provjeri administratorske ovlasti.')
  }
}

export async function setLrcProductVisibility(code: string, isVisible: boolean): Promise<void> {
  const client = requireClient()
  await requireAuth(client)
  const { data, error } = await client
    .from(TABLE)
    .update({ is_visible: isVisible })
    .eq('code', code)
    .select('code, is_visible')
  if (error) throwQueryError(error, 'Promjena vidljivosti')
  const updated = (data ?? []) as { is_visible?: boolean }[]
  if (updated.length === 0 || updated[0]?.is_visible !== isVisible) {
    throw lrcCatalogError('request', 'Vidljivost nije spremljena. Provjeri administratorske ovlasti.')
  }
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/^.*[/\\]/, '')
  const cleaned = base.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 180)
  return cleaned.length > 0 ? cleaned : 'image'
}

export async function uploadLrcProductImage(file: File, code: string): Promise<{ src: string; frame: string }> {
  const client = requireClient()
  await requireAuth(client)
  const mime = (file.type || '').toLowerCase()
  if (!ALLOWED_IMAGE_MIME.has(mime)) {
    throw lrcCatalogError('request', 'Dopušteni formati slike su JPEG, PNG i WebP.')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw lrcCatalogError('request', 'Datoteka je prevelika. Maksimalno 10 MB.')
  }
  const frame = await frameColorFromImageFile(file)
  const objectPath = `${code}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
  const { error } = await client.storage.from(BUCKET).upload(objectPath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: mime,
  })
  if (error) throw lrcCatalogError('request', `Upload fotografije: ${error.message}`)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (typeof supabaseUrl !== 'string' || supabaseUrl.trim().length === 0) {
    throw lrcCatalogError('not_configured', 'Supabase nije konfiguriran. Katalog se ne može uređivati.')
  }
  return { src: lrcProductImageDirectUrl(supabaseUrl, objectPath), frame }
}

/** Admin preview for every product, including hidden ones. Static card images stay as plain URLs. */
export async function loadLrcAdminImage(src: string): Promise<string> {
  const objectPath = lrcProductImageObjectPath(src)
  if (!objectPath) return src
  const client = requireClient()
  await requireAuth(client)
  const { data, error } = await client.storage.from(BUCKET).download(objectPath)
  if (error || !data) throw lrcCatalogError('request', 'Fotografija nije učitana.')
  return URL.createObjectURL(data)
}

export async function deleteLrcProductImage(src: string): Promise<void> {
  const objectPath = lrcProductImageObjectPath(src)
  if (!objectPath) return
  await deleteLrcStorageObjects([objectPath])
}

/** Removes storage files only when none of the given products still reference them. */
export async function deleteUnusedLrcProductImages(
  candidateSrcs: readonly string[],
  products: readonly { photos: readonly { src: string }[] }[],
): Promise<void> {
  const paths = unusedLrcStorageObjectPaths(candidateSrcs, products)
  if (paths.length === 0) return
  await deleteLrcStorageObjects(paths)
}

async function deleteLrcStorageObjects(objectPaths: readonly string[]): Promise<void> {
  const client = requireClient()
  await requireAuth(client)
  for (const objectPath of objectPaths) {
    const { data, error } = await client.storage.from(BUCKET).remove([objectPath])
    if (error) {
      const message = error.message.toLowerCase()
      if (message.includes('not found') || message.includes('does not exist')) continue
      throw lrcCatalogError('request', `Uklanjanje fotografije: ${error.message}`)
    }
    if (!data?.length) {
      throw lrcCatalogError('request', 'Fotografija nije uklonjena iz pohrane.')
    }
  }
}
