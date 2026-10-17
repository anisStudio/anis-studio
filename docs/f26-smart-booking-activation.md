# F2.6 Smart Booking — production activation notes

Additive migration (do **not** auto-apply from the app):

- `supabase/migrations/20261017130000_f26_smart_booking_shared_availability.sql`

## Defaults chosen

- Shared consultation capacity: **1** confirmed overlapping consultation across `web_atelier` / `interiors` / `lrc`.
- Existing G–I reservations keep status; drafts are **not** auto-confirmed.
- Booking = confirmed consultation / start-of-cooperation slot only (not offer, project, invoice, payment).
- Closures never silently move/cancel bookings; admin receives a conflict warning.
- Closure reasons are admin-only (omitted from public RPCs).
- Public booking uses DB locks + idempotency + rate limit; Turnstile token is collected client-side as a fingerprint signal. Full Turnstile Edge verification is **pending** (no Edge deploy in F2.6).
- Europe/Zagreb for business-facing calendar UX; timestamps stored as `timestamptz` (UTC).

## Safe push rationale

Frontend degrades when F2.6 RPCs are missing (`SmartBookingUnavailableError`):

- Admin calendar falls back to G–I list/create windows.
- Public booking section shows “pending activation” instead of crashing.

## Activation checklist (manual)

1. Backup production DB.
2. Apply `20261017130000_f26_smart_booking_shared_availability.sql` via controlled Supabase SQL path.
3. Verify RPCs: `public_list_consultation_availability`, `public_book_consultation_slot`, `admin_list_booking_calendar`.
4. Create a few availability windows per department in Admin → Kapacitet.
5. Smoke-test public booking on Interijeri / LRC (no real customer spam).
6. Keep Web Atelier public visibility **OFF** until F2.11.
7. Optional later: Edge Function wrapper that verifies Turnstile before calling `public_book_consultation_slot`.

## Not in F2.6

- Automatic email / SMS / messaging
- Stripe / invoices / offer auto-accept
- Production Edge deploy or secrets changes
- Public Web Atelier launch
