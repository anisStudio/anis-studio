import { isSupabaseConfigured } from './supabase.ts'
import { parseInquiryBody, type PublicErrorCode } from './webAtelierGatewayPolicy.ts'
import { draftToWire, type WebAtelierDraft } from './webAtelierInquiry.ts'

export async function submitWebAtelierInquiry(
  draft: WebAtelierDraft,
  idempotencyKey: string,
  turnstileToken: string,
): Promise<
  | { ok: true; inquiryId: string; referenceCode: string }
  | { ok: false; error: PublicErrorCode }
> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!isSupabaseConfigured || !supabaseUrl || !anonKey) {
    return { ok: false, error: 'unavailable' }
  }
  const wire = draftToWire(draft, idempotencyKey, turnstileToken)
  if (!parseInquiryBody(wire)) return { ok: false, error: 'invalid_payload' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/functions/v1/submit-web-atelier-inquiry`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify(wire),
        signal: controller.signal,
      },
    )
    const payload = (await response.json()) as {
      error?: unknown
      inquiryId?: unknown
      referenceCode?: unknown
    }
    if (
      response.ok &&
      typeof payload.inquiryId === 'string' &&
      typeof payload.referenceCode === 'string'
    ) {
      return { ok: true, inquiryId: payload.inquiryId, referenceCode: payload.referenceCode }
    }
    const code = payload.error
    if (
      code === 'captcha_failed' ||
      code === 'rate_limited' ||
      code === 'invalid_payload' ||
      code === 'unavailable'
    ) {
      return { ok: false, error: code }
    }
    return { ok: false, error: 'unavailable' }
  } catch {
    return { ok: false, error: 'unavailable' }
  } finally {
    clearTimeout(timer)
  }
}
