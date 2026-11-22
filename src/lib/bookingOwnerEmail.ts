import type { BookingSubmission } from './smartBookingGatewayPolicy'

export type BookingEmailProvider = 'mock' | 'resend' | 'off'

export interface BookingOwnerEmailEnv {
  ownerEmail: string
  fromEmail: string
  provider: BookingEmailProvider
  resendApiKey: string
}

export interface BookingOwnerEmailInput {
  reservationId: string
  department: string
  startsAt: string
  endsAt: string
  submission: Pick<
    BookingSubmission,
    'contactName' | 'contactEmail' | 'contactPhone' | 'description'
  >
}

const DEPARTMENT_LABEL_HR: Record<string, string> = {
  interiors: "Ani's Interijeri",
  lrc: 'LRC',
  web_atelier: 'Web Atelier',
}

function formatZagrebRange(startsAt: string, endsAt: string): string {
  const fmt = new Intl.DateTimeFormat('hr-HR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Zagreb',
  })
  return `${fmt.format(new Date(startsAt))} – ${fmt.format(new Date(endsAt))}`
}

export function buildBookingOwnerEmail(input: BookingOwnerEmailInput): {
  subject: string
  text: string
} {
  const dept = DEPARTMENT_LABEL_HR[input.department] ?? input.department
  const lines = [
    'Nova potvrđena rezervacija termina (Ani\'s Studio).',
    '',
    `ID rezervacije: ${input.reservationId}`,
    `Odjel: ${dept}`,
    `Termin (Europe/Zagreb): ${formatZagrebRange(input.startsAt, input.endsAt)}`,
    `Ime: ${input.submission.contactName}`,
    `E-mail: ${input.submission.contactEmail}`,
    `Telefon: ${input.submission.contactPhone || '—'}`,
  ]
  if (input.submission.description.trim()) {
    lines.push('', 'Poruka:', input.submission.description.trim())
  }
  return {
    subject: `[Rezervacija] ${dept} — ${input.submission.contactName}`,
    text: lines.join('\n'),
  }
}

export type BookingOwnerEmailResult =
  | { ok: true; provider: BookingEmailProvider; skipped: false }
  | { ok: true; provider: 'off'; skipped: true; reason: string }
  | { ok: false; provider: BookingEmailProvider; error: string }

export function readBookingOwnerEmailEnv(
  source: Record<string, string | undefined>,
): BookingOwnerEmailEnv | null {
  const ownerEmail = (source.BOOKING_OWNER_EMAIL ?? '').trim()
  if (!ownerEmail) return null
  const providerRaw = (source.BOOKING_EMAIL_PROVIDER ?? 'off').trim().toLowerCase()
  const provider: BookingEmailProvider =
    providerRaw === 'mock' || providerRaw === 'resend' ? providerRaw : 'off'
  return {
    ownerEmail,
    fromEmail: (source.BOOKING_EMAIL_FROM ?? 'Ani\'s Studio <noreply@anislrc.hr>').trim(),
    provider,
    resendApiKey: (source.RESEND_API_KEY ?? '').trim(),
  }
}

/** Sends owner notification; failures are reported but must not reject bookings. */
export async function sendBookingOwnerEmail(
  input: BookingOwnerEmailInput,
  env: BookingOwnerEmailEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<BookingOwnerEmailResult> {
  if (env.provider === 'off') {
    return { ok: true, provider: 'off', skipped: true, reason: 'provider_off' }
  }

  const { subject, text } = buildBookingOwnerEmail(input)

  if (env.provider === 'mock') {
    console.info(
      JSON.stringify({
        event: 'booking_owner_email_mock',
        reservation_id: input.reservationId,
        to: env.ownerEmail,
        subject,
      }),
    )
    return { ok: true, provider: 'mock', skipped: false }
  }

  if (!env.resendApiKey) {
    return { ok: false, provider: 'resend', error: 'missing_resend_api_key' }
  }

  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.fromEmail,
        to: [env.ownerEmail],
        subject,
        text,
      }),
    })
    if (!res.ok) {
      return { ok: false, provider: 'resend', error: `resend_http_${res.status}` }
    }
    return { ok: true, provider: 'resend', skipped: false }
  } catch {
    return { ok: false, provider: 'resend', error: 'resend_unreachable' }
  }
}