# F2 Controlled Integration Report

**Branch:** `feature/f2-controlled-integration`  
**Purpose:** Release-candidate integration of admin preview + Smart Calendar 2.0 + Web Atelier premium UX + pricing audit.  
**Not a production deployment.**

## Branch ancestry

| Branch | SHA (verified) | Role |
| --- | --- | --- |
| `main` | `4ae57c7` (merge-base) | Production base |
| `feature/universal-admin-preview` | `0c2c62b` | Ancestor of F2.9 |
| `feature/f210-web-atelier-premium-ux` | `4aba6fd` | Ancestor of F2.9 |
| `feature/f29-web-atelier-pricing-audit` | `e7ee1e8` | Integration base |
| `feature/f26-smart-calendar-2` | `54d384c` | Merged into RC |

**Strategy:** Create `feature/f2-controlled-integration` from F2.9, then `git merge --no-ff` of F2.6.

**Why not reverse?** F2.9 already contains preview + F2.10 + F2.9 pricing. F2.6 tip was **not** an ancestor of F2.9 (unique commits `c17be28`, `54d384c`).

**Starting SHA:** `e7ee1e862be35438378a2d4f010b0298819441f7`  
**Merge-base (f29 ∩ f26):** `4ae57c79e43f38c3ffd3f1bb0e8fe9a9daa71e96`  
**Merge commit:** `81f49fdb5bd8357e5fc737b27ee6f21c50966fd1`

## Conflict resolutions

| File | Resolution |
| --- | --- |
| `package.json` | Kept **both** script sets: `smart-calendar:test` (F2.6) + `admin-preview` / `admin-auth` / `admin-password` (F2.9 line) + added `f2:integration:test` |

No other conflict markers remained. Auto-merged paths include Smart Calendar migrations, booking libs, AdminAvailabilityPage, and WA offer capacity hooks while preserving F2.9 cents-derived informative prices.

## Migrations

| Timestamp | File | Notes |
| --- | --- | --- |
| `20261017140000` | Turnstile edge hardening | Prior known prod head candidate |
| `20261018100000` | `f26_smart_calendar_2.sql` | Smart Calendar 2.0 |
| `20261018101000` | `f26_wa_capacity_sync.sql` | WA accepted-project capacity sync |

**Production apply:** NOT performed.  
**Production head verification against live project `cpvofgaknmgnmusypoev`:** NOT VERIFIED in this pass (no production queries).

**Checks (local evidence):** no duplicate timestamps in these files; additive F2.6 migrations after `20261017140000`.

## Visibility / SEO

- Required default: `web_atelier_public_visible=false` — must remain OFF until explicit owner activation.
- Interijeri remains public; LRC visibility unchanged by this merge.
- Admin preview / hidden WA: fail-closed `is_admin` gate (preserved from preview ancestry).

## Security notes

- Public booking remains Turnstile → Edge → service_role RPC path (F2.6 / prior F2.6 hardening).
- No service_role credentials added to browser bundles in this integration.
- Offer totals remain admin/DB-authoritative; configurator totals informative only (F2.9).
- Production RLS/grants not modified in this task.

## Test matrix (executed on `C:\anis-f2-integration`)

| Check | Result |
| --- | --- |
| `tsc --noEmit` | PASS |
| ESLint (targeted) | PASS (package.json ignored warning only) |
| `npm run build` | PASS |
| `f2:integration:test` | PASS |
| `web-atelier:pricing-audit:test` | PASS |
| `web-atelier:configurator:test` | PASS |
| `web-atelier:offers:test` | PASS |
| `web-atelier:premium-ux:test` | PASS |
| `web-atelier:demos:test` | PASS |
| `admin-preview:test` | PASS |
| `smart-booking:test` | PASS |
| `smart-booking:edge:test` | PASS |
| `smart-booking:sql` | PASS (45 + concurrency + capacity race) |
| `test-web-atelier-offers-sql.mjs` | PASS (217 + concurrency) |
| Visual/browser QA | SKIPPED |
| Live production migration head | NOT VERIFIED |

## Remaining risks

1. Live production migration head may differ from `20261017140000` — verify before any apply.
2. Edge function deploy required for booking Turnstile path when activating calendar features in prod.
3. Commercial catalog price owner sign-off still pending (F2.9).
4. VAT-outside formal offer wording still NEEDS BUSINESS DECISION.
5. Historical `merge_*.bat` files in tree that push `main` must **never** be executed for this RC.

## Production backup / rollback (for later activation — not executed)

1. Backup Supabase (dashboard backup / point-in-time) before applying `20261018100000`+.
2. Dry-run migrations on staging/restore clone.
3. Deploy Edge `book-consultation-slot` only after DB migrations succeed.
4. Vercel: deploy Preview first; confirm WA public flag remains false.
5. Rollback: revert app deploy; do not casually reverse applied SQL without a written down-migration plan.

## Manual smoke checklist (post-Preview)

- [ ] Admin login + `/admin/preview` for hidden WA
- [ ] Configurator estimate non-binding copy (HR)
- [ ] Admin availability calendar Mon–Fri 16:00–19:00 Zagreb
- [ ] Capacity rejection when department month full
- [ ] Accept WA offer allocates capacity (staging only)
- [ ] Interijeri public inquiry still works
- [ ] LRC visibility unchanged
- [ ] Password recovery routes still work

## Commercial approvals still pending

- Informative floors 300 / 500 / 800 EUR  
- Add-on catalog public display amounts  
- VAT terminology on formal offers  
