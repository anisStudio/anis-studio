export function resolveLrcWebshopUrl(
  enabled: boolean,
  candidate: string | null | undefined,
): string | null {
  if (!enabled || !candidate?.trim()) return null

  try {
    const url = new URL(candidate.trim())
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
      return null
    }
    return url.href
  } catch {
    return null
  }
}

/** True only for an explicit on value. Missing, loading, and false stay off. */
export function isLrcWebshopEnabled(value: boolean | null | undefined): boolean {
  return value === true
}

export const LRC_WEBSHOP_PREVIEW_KEY = 'anis-lrc-webshop-local-preview'

/** Cart persistence. The webshop switch must never read or write these keys. */
export const CART_STORAGE_KEYS = ['cart', 'anis_cart_v1'] as const

export interface LrcWebshopPreview {
  enabled: boolean
  url: string | null
}

export interface LrcWebshopStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function readLrcWebshopPreview(
  storage: Pick<LrcWebshopStorage, 'getItem'> | null,
): LrcWebshopPreview | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(LRC_WEBSHOP_PREVIEW_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { enabled?: unknown; url?: unknown }
    if (typeof parsed.enabled !== 'boolean') return null
    return {
      enabled: parsed.enabled,
      url: typeof parsed.url === 'string' && parsed.url.trim() ? parsed.url : null,
    }
  } catch {
    return null
  }
}

export function writeLrcWebshopPreview(
  storage: LrcWebshopStorage,
  preview: LrcWebshopPreview,
): void {
  const cartBefore = CART_STORAGE_KEYS.map((key) => storage.getItem(key))
  storage.setItem(
    LRC_WEBSHOP_PREVIEW_KEY,
    JSON.stringify({
      enabled: preview.enabled === true,
      url: preview.url?.trim() ? preview.url.trim() : null,
    }),
  )
  CART_STORAGE_KEYS.forEach((key, index) => {
    if (storage.getItem(key) !== cartBefore[index]) {
      throw new Error('Webshop preview must not change cart storage')
    }
  })
}

export function removeLrcWebshopPreview(storage: LrcWebshopStorage): void {
  const cartBefore = CART_STORAGE_KEYS.map((key) => storage.getItem(key))
  storage.removeItem(LRC_WEBSHOP_PREVIEW_KEY)
  CART_STORAGE_KEYS.forEach((key, index) => {
    if (storage.getItem(key) !== cartBefore[index]) {
      throw new Error('Webshop preview must not change cart storage')
    }
  })
}

export interface ResolvedLrcWebshop {
  enabled: boolean
  /** HTTPS link, only when the shop is on and the URL is confirmed. */
  webshopUrl: string | null
  /** Address shown in admin, including a draft that is not yet a valid HTTPS URL. */
  draftUrl: string
  /** Local browser preview, used when the database column is not applied. */
  localPreview: boolean
}

/**
 * Fail closed until settings have loaded. A local preview then overrides the
 * server value so both states can be shown before the migration is applied.
 */
export function resolveLrcWebshopState(input: {
  settingsReady: boolean
  serverEnabled: boolean | null | undefined
  serverUrl: string | null | undefined
  preview: LrcWebshopPreview | null
}): ResolvedLrcWebshop {
  if (!input.settingsReady) {
    return { enabled: false, webshopUrl: null, draftUrl: '', localPreview: false }
  }

  const enabled = input.preview
    ? input.preview.enabled === true
    : isLrcWebshopEnabled(input.serverEnabled)
  const draftSource = input.preview ? input.preview.url : input.serverUrl
  const draftUrl = draftSource?.trim() ? draftSource.trim() : ''

  return {
    enabled,
    webshopUrl: resolveLrcWebshopUrl(enabled, draftUrl),
    draftUrl,
    localPreview: input.preview !== null,
  }
}
