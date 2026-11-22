# F2.6 — vlasnički e-mail za novu rezervaciju

Nakon uspješnog poziva `public_book_consultation_slot` (Edge `book-consultation-slot`), opcionalno se šalje **jedan** tekstualni e-mail vlasniku studija. Duplikati istog zahtjeva (`replay: true` u odgovoru) **ne** okidaju novo slanje.

## Varijable okruženja (Supabase Edge)

| Varijabla | Obavezno | Opis |
|-----------|----------|------|
| `BOOKING_OWNER_EMAIL` | Da (za aktivaciju) | Primatelj obavijesti |
| `BOOKING_EMAIL_PROVIDER` | Ne | `off` (zadano), `mock` (log bez slanja), `resend` |
| `BOOKING_EMAIL_FROM` | Ne | Pošiljatelj za Resend (npr. `Ani's Studio <noreply@domena.hr>`) |
| `RESEND_API_KEY` | Za `resend` | API ključ Resend usluge |

Postojeće Turnstile i Supabase varijable ostaju nepromijenjene.

## Ponašanje

- Slanje se događa **samo na poslužitelju** nakon uspješnog spremanja rezervacije.
- Greška slanja **ne** mijenja HTTP 200 niti uzrokuje ponovnu rezervaciju.
- Sadržaj uključuje termin u zoni `Europe/Zagreb`, odjel, ime, kontakt i poruku ako je unesena.
- Lokalno testiranje: `BOOKING_EMAIL_PROVIDER=mock` + `BOOKING_OWNER_EMAIL` (vidi `scripts/test-smart-booking-edge.ts`).

## Aktivacija produkcije

1. Postavite `BOOKING_OWNER_EMAIL` i `BOOKING_EMAIL_PROVIDER=resend`.
2. Postavite `RESEND_API_KEY` i `BOOKING_EMAIL_FROM` u Supabase Secrets.
3. Re-deploy funkcije `book-consultation-slot`.
4. Jedan probni termin u stagingu; provjerite inbox i da ponovljeni idempotentni zahtjev ne šalje drugi mail.

Bez gore navedenog provider ostaje `off` i slanje se preskače (bez greške za klijenta).