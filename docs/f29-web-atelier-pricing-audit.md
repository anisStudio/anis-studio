# F2.9 — Web Atelier pricing, configurator, quotation audit

**Branch:** `feature/f29-web-atelier-pricing-audit`  
**Base:** `feature/f210-web-atelier-premium-ux` @ `4aba6fd6f889696b86c306aec3815f362a76f3f9`  
**Scope:** Audit + safe integrity fixes only. No commercial price invention. No production deploy. No protected-path edits.

Status legend used below:

| Tag | Meaning |
| --- | --- |
| **VERIFIED** | Confirmed from repository evidence |
| **FIXED** | Safe code change in this branch (no price change) |
| **NOT VERIFIED** | Could not confirm in this environment (e.g. live RLS against prod) |
| **NEEDS BUSINESS DECISION** | Owner/accountant must decide; engineer must not guess |

---

## 1. Authoritative sources

| Concern | Authority | Evidence |
| --- | --- | --- |
| Public package floors (START/PRO/PREMIUM) | `WEB_ATELIER_INFORMATIVE_PRICES_EUR` / `_CENTS` | `src/lib/webAtelierOffers.ts` |
| Configurator add-on catalog | `WEB_ATELIER_ADDON_DEFINITIONS` | `src/lib/webAtelierConfigurator.ts` |
| Formal quotation amounts | Admin-entered `web_atelier_offer_items` (integer euro cents) | Migration `20261014010000_web_atelier_offers_projects.sql` |
| Accepted commercial total | Sent offer snapshot + `web_atelier_projects.agreed_total_cents` | Same migration; project created only from accepted offer |
| Inquiry “budget” | Soft bucket `budget_range` + `configurator_snapshot` JSON | Inquiry migrations; **not** a binding grand total |

**VERIFIED:** Configurator estimate is never the authoritative commercial price for an accepted project.

---

## 2. Complete pricing inventory

### 2.1 Package floors (informative)

| Package | EUR | Cents | Displayed | Calculated | Persisted (inquiry) | Used in quotations |
| --- | --- | --- | --- | --- | --- | --- |
| START | 300 | 30 000 | Public packages + configurator | `calculateConfiguratorEstimate` | `package_preference`, snapshot, budget hint | Admin “Predloži informativnu cijenu” only |
| PRO | 500 | 50 000 | same | same | same | same |
| PREMIUM | 800 | 80 000 | same | same | same | same |

**FIXED:** `WEB_ATELIER_INFORMATIVE_PRICES_CENTS` is derived from EUR (`×100`) so the two maps cannot silently drift.

### 2.2 Configurator add-ons (catalog)

| ID | Kind | Unit EUR | Notes |
| --- | --- | --- | --- |
| `extra_page` | fixed | 60 | qty 1–20 |
| `minor_revision` | fixed | 40 | qty 1–10 |
| `ai_localization` | fixed | 100 | |
| `external_booking` | fixed | 100 | exclusive vs `own_booking` |
| `own_booking` | fixed | 300 | wins exclusive group |
| `newsletter` | fixed | 80 | |
| `simple_functionality` | fixed | 50 | |
| `dark_light_mode` | fixed | 100 | |
| `ai_content` | estimate_from | 80 (“od”) | not in fixed subtotal |
| `shop_integration` | estimate_from | 1000 | exclusive vs `new_web_shop` |
| `new_web_shop` | estimate_from | 1500 | supersedes package base price |
| `advanced_copywriting` | custom_quote | null | individual quote |
| `advanced_ecommerce` | custom_quote | null | drops priced shop lines |

**NEEDS BUSINESS DECISION:** Whether these informative add-on amounts remain commercially approved for public display. This audit does **not** change them.

### 2.3 Other commercial concepts

| Concept | Status |
| --- | --- |
| Recurring costs (hosting, retainers) | **NOT VERIFIED** as a first-class WA catalog item — no dedicated recurring pricing module found |
| One-time setup beyond packages/addons | Covered only via custom/admin offer lines |
| Minimum prices | Package floors act as “od” floors; no separate minimum engine |
| Discounts | Offer `item_type = discount` in cents; cannot exceed subtotal |
| Tax / VAT on WA UI | No PDV/VAT labels on configurator (**VERIFIED** code search) |
| Payment terms / Stripe / Parra | Not connected for WA quotations (**VERIFIED** wiring checks) |
| Revisions beyond package includes | `minor_revision` add-on + package revision counts in copy |

---

## 3. Calculation rules

### Configurator (informative)

1. Normalize selection (clamp qty, exclusive groups, advanced ecommerce drop).
2. If `new_web_shop` selected → package EUR not stacked.
3. Sum **fixed** lines → `fixedTotalEur`.
4. Sum fixed + `estimate_from` floors → `estimateFloorEur` (null if nothing priced).
5. `custom_quote` lines never invent numbers.

**FIXED:** Totals are accumulated in integer euro cents then converted to EUR for display (same whole-euro catalog values; avoids float drift if quantities grow).

### Formal offers

1. Admin sets line `unit_price_cents` + `quantity`.
2. DB trigger recomputes `line_total_cents = round(quantity * unit_price_cents)`.
3. Offer totals recomputed from lines; client-submitted totals not trusted as authority.
4. Issue → snapshot hash; accept → project `agreed_total_cents` from that offer.

**VERIFIED (code + migration comments):** Accepted projects must not silently recalculate from later catalog changes.

---

## 4. Configuration → offer data flow

```
Public WA page (guarded; public_visible=false)
  → package + addons (sessionStorage key web-atelier-configurator-v1)
  → indicative estimate (client-side)
  → inquiry form patches (package, features, notes marker, budget_range, configurator_snapshot)
  → Supabase submit_web_atelier_inquiry / gateway
  → admin inquiry review (sees snapshot + notes)
  → admin creates draft offer lines (may suggest informative tier)
  → issue snapshot (manual delivery; not auto e-mail)
  → record delivery + acceptance evidence
  → project with agreed_total_cents
```

| Checkpoint | Status |
| --- | --- |
| Selection survives navigation (storage) | **VERIFIED** helpers exist |
| Options reach backend | **VERIFIED** snapshot + featuresNotes markers |
| Client grand total authoritative? | **VERIFIED no** — inquiry has no `total_cents` / `grandTotal` param |
| Estimate = binding contract? | **FIXED** sticky copy clarifies “Nije ugovor…” |
| Editing draft offer | **VERIFIED** `canEditOffer` only draft |
| Sent offer immutable lines | **VERIFIED** snapshot + edit blocked |
| Accepted price integrity | **VERIFIED** project total bound to offer |

**Gaps (document only):** End-to-end live submit against production was **not** run (safety). Local SQL RLS exercise against a live DB is **NOT VERIFIED** in this pass.

---

## 5. Estimate vs formal offer (wording)

**VERIFIED / strengthened:**

- Configurator intro and summary markers: informativan / neobvezujući / nije ponuda ni narudžba.
- Sticky hint (HR): explicitly “Nije ugovor ni prihvat projekta”.
- Inquiry page: upit ≠ rezervacija ≠ prihvat ponude.
- Admin suggested line: “informativno” / “Nije račun.”

No legal guarantees added. No auto-invoice. No Stripe/Parra.

---

## 6. VAT terminology review

| Finding | Tag |
| --- | --- |
| Ani's Studio operates outside the VAT system (owner statement in brief) | Assumed policy input — **NEEDS BUSINESS DECISION** for exact legal wording on offers/invoices |
| WA configurator/offers UI: no “PDV” / “VAT” / “s PDV” / “bez PDV” labels found | **VERIFIED** |
| No VAT amount added to catalog prices in this audit | **VERIFIED** (prices unchanged) |
| Fiscalization | Out of scope — not implemented |
| Offer currency formatting | `Intl` EUR (`formatEuroCents`) — presentation only |

**NEEDS BUSINESS DECISION (owner/accountant):** Whether future formal offer PDF/e-mail templates must state “nismo u sustavu PDV-a” or similar. Do not invent invoice language here.

---

## 7. Discrepancies

| Item | Finding | Action |
| --- | --- | --- |
| EUR vs CENTS package maps | Risk of silent drift if edited separately | **FIXED** — CENTS derived from EUR |
| Configurator float accumulation | Whole-euro today, but `unit * qty` float path | **FIXED** — cents accumulator |
| Configurator catalog vs formal offer | Different authorities by design | **VERIFIED** — documented, not a bug |
| Demo portfolio “prices” | Fictional demos must not drive catalog | **VERIFIED** tests reject fake €299 wiring |
| Informative vs commercial approval | Catalog values exist in code; owner sign-off not in repo | **NEEDS BUSINESS DECISION** |

No commercial list prices were changed.

---

## 8. Security / RLS findings

| Risk | Finding | Tag |
| --- | --- | --- |
| Forged client grand total | Inquiry RPC params do not accept a client total as offer authority | **VERIFIED** (client libs) |
| Malformed option ids | Parse ignores unknown ids; clamp quantities | **VERIFIED** (tests) |
| Duplicate submission | Gateway idempotency key pattern exists | **VERIFIED** (migration comments); live stress **NOT VERIFIED** |
| Cross-user offer access | Admin RPCs + RLS in offers migration | Code-reviewed; live policy matrix **NOT VERIFIED** |
| Stale quotation versions | Snapshot SHA on issue; accept bound to SHA | **VERIFIED** (code paths) |
| Privilege escalation / service_role in browser | No service_role in frontend pricing libs | **VERIFIED** search of WA pricing files |
| Internal cost disclosure | Catalog is public informative; no separate “cost” field | **VERIFIED** |
| Production RLS mutation | Not performed | Policy compliance |

**No production RLS/grants modified. No new production migration applied.**

Additive migration: **not required** for this audit’s safe fixes (client integrity + tests + docs only).

---

## 9. Test coverage

| Suite | Script | Focus |
| --- | --- | --- |
| Configurator (existing) | `npm run web-atelier:configurator:test` | Packages, exclusions, patches |
| Offers (existing) | `npm run web-atelier:offers:test` | Cents math, transitions, snapshots rules |
| Pricing audit (new) | `npm run web-atelier:pricing-audit:test` | Full regression matrix §9 of brief |
| Integrity helper | `src/lib/webAtelierPricingIntegrity.ts` | Inventory + catalog assert |

Regression matrix covered: each package; each priced addon; min/max config; incompatibles; invalid ids; duplicates; negative/zero/large qty; decimal offer rounding; discounts; custom items; persistence roundtrip; snapshot authority notes; malformed input; stale package id; unauthorized price override attempts on inquiry path.

Where commercial expected values are policy questions, tests assert **invariants** and document **NEEDS BUSINESS DECISION** rather than inventing prices.

---

## 10. Production migration requirements

| Item | Required now? |
| --- | --- |
| New Supabase migration | **No** for F2.9 safe fixes |
| Edge function change | **No** |
| Env / Vercel change | **No** |
| Keep `web_atelier_public_visible=false` | **Yes — preserve** |
| Preserve LRC / Interijeri visibility | **Yes — untouched** |

Rollback for this branch: revert the feature commit(s); no DB rollback needed.

---

## 11. Integration sequence (proposal only — not performed)

Ancestry (merge-base with `main` = `4ae57c7` for all listed feature branches):

1. `feature/universal-admin-preview` → `0c2c62b` (includes preview + password recovery).
2. `feature/f26-smart-calendar-2` → `54d384c` (calendar + WA capacity sync).  
   Note: **already contained in** `feature/f210-web-atelier-premium-ux` history.
3. `feature/f210-web-atelier-premium-ux` → `4aba6fd` (premium UX + SEO hygiene).
4. `feature/f29-web-atelier-pricing-audit` → this branch (based on F2.10).

**Suggested order into a release candidate (later):**

1. universal-admin-preview (if not already in target)  
2. f26-smart-calendar-2  
3. f210-web-atelier-premium-ux  
4. f29-web-atelier-pricing-audit  

Because F2.10 already includes F2.6 + preview commits, integrating **f210 then f29** is the lowest-conflict path for Web Atelier. Do **not** merge into `main` until owner sign-off.

### Integration risks

| Risk | Detail |
| --- | --- |
| `package.json` scripts | f26/f29 add scripts; expect merge conflict on scripts block |
| Routes | WA + booking + admin preview overlap — reconcile `App.tsx` carefully |
| Supabase migrations | f26 capacity/calendar migrations vs WA offers (already co-present on f210) |
| Admin auth | Preview `is_admin` gate must remain |
| Visibility guards | Keep WA public OFF; don’t flip Interijeri/LRC |
| Pricing/configurator | f29 cents integrity must not be overwritten by older configurator copies |

---

## 12. Unresolved business decisions

1. Confirm public informative floors 300 / 500 / 800 EUR still approved.  
2. Confirm each add-on catalog EUR amount for public “od” display.  
3. Exact Croatian VAT-outside wording for formal offer documents.  
4. Whether recurring hosting/maintenance should become a catalog line.  
5. Payment schedule language for WA (installments vs advance) — FAQ mentions general rules; WA-specific terms **NEEDS BUSINESS DECISION**.

---

## 13. Protected paths

Never modified in this work:

- `src/index.css`
- `src/components/DecorativeSkyBackdrop.tsx`
- `src/components/Footer.tsx`
- `public/backgrounds/`
- `supabase/.temp/`
- `NUL`
