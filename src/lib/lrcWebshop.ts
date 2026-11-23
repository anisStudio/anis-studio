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
