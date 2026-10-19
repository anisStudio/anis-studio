# F2.11 — Local Web Atelier bootstrap

Isolated local stack for F2.11 E2E. **Not** a full production schema clone.

## Isolation

| Service | Port |
|---------|------|
| API (Kong) | `http://127.0.0.1:54421` |
| Postgres | `127.0.0.1:54422` |
| Studio | `http://127.0.0.1:54423` |
| Inbucket | `http://127.0.0.1:54424` |

Do **not** use default `54321–54324` while `anis-ai-presenter` occupies them. Remap in `supabase/config.toml`.

Never point `.env.local` or Edge env at `*.supabase.co` / `anislrc.hr` for write tests.

## Prerequisites

- Docker Desktop running
- `npx supabase` CLI (repo uses npx; global install optional)
- Node 22+
- Free remapped ports above

## Start order

1. Confirm remapped ports in `supabase/config.toml` (`project_id = "anis-studio"`).
2. Migrations auto-apply on start is **disabled** (`[db.migrations] enabled = false`) because the migration chain assumes a pre-existing Interijeri base schema.
3. `npx supabase start` from the worktree.
4. Create synthetic admin auth user with UUID `eece9210-2fc5-42d5-aa02-e47a7cfaf160` (Auth Admin API or SQL into `auth.users` + `auth.identities`).
5. Apply base SQL then WA migrations (see below).
6. Create non-admin user for deny tests.
7. Write gitignored `.env.local` (`VITE_SUPABASE_URL=http://127.0.0.1:54421`, anon key, optional CF test sitekey).
8. `npm run edge:sync-shared`
9. Start Edge: `npx supabase functions serve --env-file <gitignored-edge-env> --no-verify-jwt`
10. `npm run dev` → `http://127.0.0.1:5173`

## Migrations actually executed (local WA path)

Applied for real:

- `supabase/settings_table.sql` (+ RLS helper if used)
- `20261004083000_admin_authorization_foundation.sql` (after auth user exists)
- `20261013224500_web_atelier_inquiries.sql`
- `20261013235000_web_atelier_inquiry_gateway.sql`
- `20261014010000_web_atelier_offers_projects.sql`
- `20261016020000_web_atelier_tracking_materials.sql`
- `20261017010000_f24_comms_finance_availability.sql`
- `20261017120000_f24_payment_receipt_confirmation.sql`
- `20261017130000_f26_smart_booking_shared_availability.sql`
- `20261017140000_f26_booking_turnstile_edge_hardening.sql`
- `20261018100000_f26_smart_calendar_2.sql`
- `20261018101000_f26_wa_capacity_sync.sql`

## Four migrations skipped locally (schema_migrations only)

These require a production-like Interijeri policy/table inventory and are **not** run on the thin local WA stack:

1. `20261004114000_admin_rls_is_admin.sql`
2. `20261004120000_project_files_storage_is_admin.sql`
3. `20261004124000_public_inquiry_creation_rpcs.sql`
4. `20261004130000_remove_anon_project_insert_bypass.sql`

**Do not treat this local schema as production-equivalent** for Interijeri, storage, or full RLS inventory.

## Synthetic users

| Role | Email (local only) |
|------|--------------------|
| Admin | `admin.local@anis-studio.test` (UUID above; row in `admin_users`) |
| Non-admin | `user.local@anis-studio.test` |

Passwords live only in gitignored env files. Never commit them.

## Edge functions

```bash
npm run edge:sync-shared          # copy src/lib → supabase/functions/_shared
npm run edge:sync-shared:check    # CI / regression
npx supabase functions serve --env-file scripts/.f211-c2-edge.env --no-verify-jwt
```

Required Edge env (values not documented here):

- `SUPABASE_URL` → local API (`http://127.0.0.1:54421`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `TURNSTILE_SECRET_KEY` — for local always-pass use Cloudflare test secret `1x000000…AA`
- `RATE_LIMIT_PEPPER`
- `TURNSTILE_ALLOW_DEV_HOSTS=true` (only effective when `SUPABASE_URL` host is localhost / 127.0.0.1 / kong)

Function entrypoints import `../_shared/*` so Docker does not need a manual `src/lib` mount.

## Local Turnstile

- Cloudflare always-pass sitekey/secret: documented `1x0000000000000000000000000000000AA`
- Siteverify reports hostname `example.com`
- Hostname is accepted **only** when `allowDevHosts` is true after `resolveDevHostAccess(localUrl)` — **cannot** activate on production Supabase URL
- Always-fail secret `2x000000…AA` for captcha_failed proofs
- Do **not** add `example.com` to production host allowlists unconditionally

## Visibility flags (local DB only)

Defaults remain interiors visible / LRC+WA hidden. For public browser E2E you may flip **local** `settings.web_atelier_public_visible` only. Never flip production.

## Re-running tests

```bash
npm run edge:sync-shared:check
npm run web-atelier:test
npm run web-atelier:offers:test
npm run web-atelier:configurator:test
npm run web-atelier:tracking:test
npm run smart-booking:test
npm run smart-booking:edge:test
npm run smart-calendar:test
npm run public-visibility:test
npm run admin-preview:test
npm run build:app
```

Live scripts (gitignored): `scripts/.f211-c1-e2e.mjs`, results under `scripts/.f211-c*-results.json`.

## Stop

```bash
npx supabase stop
```

Do not stop unrelated Docker projects (`anis-ai-presenter`, etc.).
