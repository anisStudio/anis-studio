# Upravljanje administratorskom lozinkom

## U aplikaciji

| Radnja | Put |
| --- | --- |
| Promjena lozinke (prijavljen admin) | Admin → **Postavke** → **Sigurnost administratorskog računa** |
| Zaboravljena lozinka | `/admin/login` → **Zaboravljena lozinka?** → `/admin/forgot-password` |
| Recovery obrazac | `/admin/reset-password` |

Promjena lozinke:

1. Zahtijeva prijavljenog admina (`is_admin()`).
2. Ponovna prijava trenutačnom lozinkom (`signInWithPassword`).
3. Ažuriranje preko `supabase.auth.updateUser({ password })`.
4. Lozinka se **ne** sprema u tablice aplikacije.

Reset (zaboravljena lozinka):

1. `resetPasswordForEmail` s `redirectTo = {origin}/admin/reset-password`.
2. Supabase šalje e-mail (produkcijski mailer).
3. Poveznica otvara recovery sesiju; aplikacija prikaže obrazac.
4. Nakon uspjeha sesija se zatvara; potrebna je nova prijava.

Ako recovery završi na početnoj (`/`) s `error_code=otp_expired`, `AdminAuthCallbackRedirect` preusmjerava na `/admin/reset-password` s razumljivom porukom i poveznicom za novi zahtjev.

## Uzrok `otp_expired` (analiza)

Najčešći uzroci (mogu se pojaviti zajedno):

1. **Nije bilo recovery rute** — Site URL je `https://anislrc.hr`, pa je korisnica završila na početnoj s Auth greškom u URL-u umjesto na obrazcu.
2. **Istek ili ponovno korištenje OTP-a** — poveznica je stara, već iskorištena, ili ju je prefetch skener e-pošte „potrošio” prije klika.
3. **Redirect URL nije na allow-listi** — Supabase tada često padne natrag na Site URL.

Aplikacija sada hvata tu grešku; i dalje treba ispravna Dashboard konfiguracija ispod.

## Ručna konfiguracija u Supabase Dashboardu (OBAVEZNO prije produkcije)

**Nemojte mijenjati secrets.** Samo Auth URL postavke:

1. Otvorite: [Authentication → URL Configuration](https://supabase.com/dashboard/project/cpvofgaknmgnmusypoev/auth/url-configuration)
2. **Site URL:** `https://anislrc.hr`
3. **Redirect URLs** — dodajte (svaki u novom redu):

```text
https://anislrc.hr/admin/reset-password
http://localhost:5173/admin/reset-password
```

Za Vercel Preview (ako Supabase dopušta wildcard na vašem planu):

```text
https://*-anamarijas-projects-bbe91a00.vercel.app/admin/reset-password
```

Ako wildcard nije dostupan, dodajte konkretni Preview URL nakon deploya, npr.:

```text
https://anis-studio-xxxx-anamarijas-projects-bbe91a00.vercel.app/admin/reset-password
```

4. Provjerite predložak **Reset password** (Authentication → Email Templates): poveznica treba koristiti `{{ .ConfirmationURL }}` (službeni recovery link), ne proizvoljni vanjski URL.
5. Spremi → test na Preview/produkciji: Forgot password → e-mail → otvoriti poveznicu **jednom**.

Ne dodavajte proizvoljne vanjske domene u Redirect URLs.
