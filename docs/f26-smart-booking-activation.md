# F2.6 Smart Booking — controlled production activation

Development code is on `main`. **Do not** apply migrations or deploy Edge from the app automatically.

## Defaults

- Shared consultation capacity: **1** overlapping confirmed consultation across departments (admin-configurable).
- Booking = start-of-cooperation slot only (not offer / project / invoice / payment).
- Closures never auto-move or cancel bookings.
- Closure reasons are admin-only.
- Europe/Zagreb for UI; `timestamptz` storage.
- Public booking requires **server-side Cloudflare Turnstile** via Edge Function; anon/authenticated cannot `EXECUTE` `public_book_consultation_slot`.

## Production migration order

Apply **only** with explicit authorization, after backup:

1. `20261017130000_f26_smart_booking_shared_availability.sql`  
   (skip if already applied)
2. `20261017140000_f26_booking_turnstile_edge_hardening.sql`  
   (revokes anon/authenticated execute on booking RPC; grants `service_role` only)

Frontend on `main` already calls Edge and degrades if RPCs/Edge are missing.

## Required Edge Function

| Name | Path |
|------|------|
| `book-consultation-slot` | `supabase/functions/book-consultation-slot` |

Flow:

1. Browser POST JSON + Turnstile token (anon key auth header only).
2. Edge verifies token with Cloudflare Siteverify (**secret never in frontend**).
3. On success, Edge calls `public_book_consultation_slot` with **service_role**.
4. RPC still enforces capacity, closures, idempotency, rate limit.
5. Response is minimal (`reservationId`, times, notices) — no foreign PII / closure reasons.

Service role is used **only** to invoke that single RPC with validated fields. It must not open broader table access for the client.

## Secrets and config (names only — no values)

Set on the Supabase project for the Edge Function (same pattern as WA inquiry):

| Secret / env | Purpose |
|--------------|---------|
| `SUPABASE_URL` | Project URL (usually auto) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server RPC caller (never ship to Vite) |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret |
| `TURNSTILE_ALLOW_WWW` | `true` only if www hostname must pass siteverify |
| `TURNSTILE_ALLOW_DEV_HOSTS` | `true` only on local Supabase; ignored on production hosts |

Frontend (already used elsewhere):

| Vite env | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Public API URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |
| `VITE_TURNSTILE_SITE_KEY` | Public Turnstile site key |

## Database backup and restore check

1. Create a full Postgres backup of the production project (SQL dump / Supabase backup).
2. Store backup **outside** the repo (private backup folder).
3. Verify restore on a **throwaway** database or confirm backup file integrity (checksum / restore dry-run).
4. **Important:** a Postgres dump does **not** automatically include all Supabase Auth user store details or Storage object binaries. Plan Auth/Storage separately if those need recovery.

## Access checks before public enablement

After migrations:

```sql
-- Expect: anon / authenticated cannot execute booking RPC
select has_function_privilege('anon', 'public.public_book_consultation_slot(text,uuid,text,text,text,text,uuid,text,text,uuid)', 'EXECUTE');
-- → false

select has_function_privilege('authenticated', 'public.public_book_consultation_slot(text,uuid,text,text,text,text,uuid,text,text,uuid)', 'EXECUTE');
-- → false

select has_function_privilege('service_role', 'public.public_book_consultation_slot(text,uuid,text,text,text,text,uuid,text,text,uuid)', 'EXECUTE');
-- → true

-- Availability list remains public (slots only)
select has_function_privilege('anon', 'public.public_list_consultation_availability(text,timestamptz,timestamptz)', 'EXECUTE');
-- → true
```

## Edge deploy procedure (manual — requires authorization)

1. Confirm secrets above are set in Supabase (do not commit values).
2. Deploy **only** `book-consultation-slot` (do not redeploy unrelated functions unless intended):

   `supabase functions deploy book-consultation-slot --project-ref <ref>`

3. Do **not** run `supabase db push` as part of this step.
4. Smoke-test Siteverify path with a **non-customer** test booking on a dedicated test window, then cancel/release in admin.

## Server Turnstile verification checklist

- [ ] Missing token → Edge `400 captcha_failed` / `invalid_payload` (no RPC book).
- [ ] Invalid / expired token → `400 captcha_failed` (no RPC book).
- [ ] Wrong hostname → `400 captcha_failed`.
- [ ] Valid token → RPC called; capacity rules still apply.
- [ ] Direct PostgREST `rpc/public_book_consultation_slot` as anon → permission denied.
- [ ] Logs contain no Turnstile token, secret, or customer email/phone.

## Manual smoke tests (all three departments)

Use throwaway contacts only.

1. **Interijeri** (`/interijeri/klijenti`): existing inquiry + upload still works; booking calendar books one slot; failed captcha shows HR/EN error; no false success.
2. **LRC** (inquiry page when form enabled): minimal booking fields; no WA-only fields forced.
3. **Web Atelier** (`/web-atelier/upit`): remains behind `PublicServiceGuard`; **keep `web_atelier_public_visible = false`**. Booking UI may exist behind the guard but must not be publicly reachable.

Also: admin calendar closures, reschedule, cancel with reason, shared capacity across departments.

## Web Atelier OFF

Do **not** flip `web_atelier_public_visible` during F2.6 activation. WA public launch is F2.11.

## Rollback (preserves reservation history)

1. Disable or undeploy `book-consultation-slot` Edge Function → public booking stops (safe fail).
2. Optionally leave migrations applied (tables/history remain).
3. **Do not** `DELETE` from `department_reservations` or reschedule events.
4. To re-open a temporary anon bypass is **not** recommended; fix Edge/secrets instead.
5. Frontend already shows unavailable / pending messages when Edge or RPC path fails.

## GO / NO-GO prerequisites

**GO** only if all are true:

1. Postgres backup taken and restore-checked.
2. Both F2.6 migrations applied in order.
3. Privilege checks above pass (anon cannot book RPC).
4. Edge `book-consultation-slot` deployed with Turnstile secret set.
5. Server Turnstile checklist passed.
6. Smoke tests for Interijeri + LRC OK; WA still OFF.
7. No production `db push` / secret commit / real customer spam bookings.

**NO-GO** if any of: missing backup, anon still has EXECUTE on book RPC, Edge missing/secret missing, WA accidentally public, or captcha can be skipped.

## Safe frontend push rationale

Frontend uses Edge for booking and falls back to “pending / unavailable” when F2.6 RPCs or Edge are absent. Admin falls back to G–I list when F2.6 admin RPCs are missing. Therefore code may ship before controlled backend activation.
