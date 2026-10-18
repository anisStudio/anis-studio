# F2.6 Smart Calendar 2.0

Additive booking upgrade after `20261017140000`. **Do not apply to production without explicit authorization.**

## What changed

- Default **Mon–Fri 16:00–19:00 Europe/Zagreb** auto consultation slots (configurable duration, default 30 minutes, horizon default 90 days).
- **Croatian public holidays** (including Easter Monday + Corpus Christi) block new bookings for all departments.
- Manual closures support **one-time** (default) or **opt-in annual** recurrence. Existing Oct 2026 / Nov 14–18 2026 closures must remain `recurrence='none'` until an admin enables annual.
- **Monthly accepted-project capacity** per department (default 3). Distinct from shared simultaneous consultation capacity (= 1).
- LRC / interiors gaps use audited `department_capacity_allocations` (manual rows); inquiries and consultation bookings do **not** count.
- Anniversary **2024-10-01** → ordinal year−2024 (2026 = 2nd). Informative only; not a booking closure.
- Public booking still goes **Edge Turnstile → service_role RPC** only. Anon/auth cannot `EXECUTE` `public_book_consultation_slot`.

## Migration

1. `supabase/migrations/20261018100000_f26_smart_calendar_2.sql`
2. `supabase/migrations/20261018101000_f26_wa_capacity_sync.sql` — WA project create/cancel/month sync

### What counts toward monthly capacity (admin action)

| Department | Counts when… | Automatic? |
|---|---|---|
| **Web Atelier** | Admin creates project from an **accepted** offer (`admin_create_web_atelier_project_from_offer`) | **Yes** — allocates `web_atelier_project` row for `planned_start_month` (default: current Zagreb month). Cancel → release. Month change → move (capacity-checked). |
| **Interijeri** | Admin registers via **Dostupnost → Registriraj kapacitet** (manual). Public inquiry / `create_public_inquiry_project` does **not** count. Status values (`inquiry`…`presented`) are workflow labels, not acceptance. | **Manual** |
| **LRC** | Admin registers via **Registriraj kapacitet**. Inquiry statuses (`new`/`read`/`archived`) never count. | **Manual** |

Consultation bookings never count. Shared simultaneous consultation capacity remains separate (default 1).

## Local tests

```bash
npm run smart-booking:test
npm run smart-booking:edge:test
npm run smart-booking:sql
```

## Production activation checklist (later, explicit)

1. Fresh backup + restore test on a throwaway project.
2. Migration dry-run against staging / restored dump.
3. Privilege check: anon cannot execute book RPC; list RPC returns no PII.
4. Deploy Edge `book-consultation-slot` only if code changed (gateway already maps month capacity).
5. Confirm `web_atelier_public_visible=false`.
6. Smoke admin calendar + one non-production booking path.
7. Rollback plan: keep prior migration head deployable; do not delete historical windows/reservations/closures.
