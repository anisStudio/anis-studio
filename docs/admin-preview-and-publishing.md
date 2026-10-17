# Admin pregled odjela i Vercel Preview workflow

Dva odvojena koncepta:

| Koncept | Što kontrolira | Gdje |
| --- | --- | --- |
| **A. Vidljivost odjela** | Smiju li javni posjetitelji otvoriti Interijere / LRC / Web Atelier | Admin → Postavke (`*_public_visible`) + `PublicServiceGuard` |
| **B. Objavljivanje koda** | Kada nove izmjene u repou postanu produkcija | Git merge na `main` → Vercel Production |

Admin pregled **nije** zamjena za staging / Vercel Preview.

## Administratorski pregled (produkcijska app)

1. Prijavite se na `/admin/login` (Supabase Auth).
2. Ovlast se potvrđuje RPC-om `public.is_admin()` (fail closed).
3. Otvorite **Admin → Pregled stranice** (`/admin/preview`).
4. Za svaki odjel vidite stvarni status javne vidljivosti i poveznice na postojeće rute.
5. Poveznice otvaraju **stvarne** React stranice (ne mockupe).
6. Ako je odjel skriven, `PublicServiceGuard` dopušta pristup samo dok je `isAdmin === true`, uz traku „Administratorski pregled” i `noindex`.

Zaštićene javne rute (guard):

- Interijeri: `/interijeri`, `/interijeri/klijenti`, `/interijeri/stolari`, `/cjenici/interijeri`
- LRC: `/lrc`, `/lrc/upit`
- Web Atelier: `/web-atelier`, `/web-atelier/upit`, `/web-atelier/demo/:slug`

Napomena: `/pracenje-projekta` ostaje token-auth izvan WA launch guarda (postojeće ponašanje).

### Sigurnost

- Nema tajnih URL-ova, `?admin=true`, ni localStorage zastavica kao jedine zaštite.
- Sadržaj se ne renderira dok traju učitavanje postavki i admin provjere.
- RLS, Edge, rate-limit i Turnstile nisu oslabljeni.
- Slanje obrasca / rezervacije i dalje piše **produkcijske** podatke.

## Vercel Preview workflow (razvojne izmjene)

Cilj: korisnica vidi feature granu prije mergea na `main`.

1. Cursor razvija na feature grani (npr. `feature/universal-admin-preview`).
2. Lokalno: TypeScript, Vite build, relevantni testovi.
3. Push feature grane na GitHub → Vercel kreira Preview deployment (ako je projekt povezan).
4. Korisnica otvara Preview URL iz Vercel / GitHub deployment statusa.
5. Provjera izgleda i funkcionalnosti.
6. Tek nakon odobrenja: merge u `main` → Production.

### Status zaštite Preview deploymenta

Za granu `feature/universal-admin-preview` potvrđeno je da Preview URL preusmjerava na
**Vercel Authentication / SSO** (zaštita je uključena). To nije zamjena za Supabase admin
prijavu: nakon Vercel prolaza i dalje treba `/admin/login` s produkcijskim Auth računom.

**Ne pretpostavljajte** da je Preview privatan samo zato što URL nije oglašen.

Ne mijenjajte produkcijske domene ni Vercel projekt bez odobrenja.

### Admin prijava na Preview — okruženje

Vite ugrađuje `VITE_*` varijable u build. Preview i Production moraju koristiti **isti**
Supabase projekt (`cpvofgaknmgnmusypoev`) ako želite istu admin e-poštu/lozinku.

1. Vercel → Project → **Settings** → **Environment Variables**
2. Provjerite da su za **Preview** (i Production) postavljene:
   - `VITE_SUPABASE_URL` = `https://cpvofgaknmgnmusypoev.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = ista vrijednost kao na Production (anon/publishable, ne service role)
3. Ako Preview nema te varijable ili ima drugi projekt — to je uzrok neuspješne prijave.
4. Nakon ispravke: **Redeploy** Preview deploymenta (env se ne primijeni na stari build).
5. Na `/admin/login` provjerite redak **Auth projekt:** — mora pisati `cpvofgaknmgnmusypoev`.

Poruka „Neispravna e-pošta ili lozinka.” dolazi od Supabase `signInWithPassword` (autentifikacija),
ne od `is_admin()` (autorizacija). Produkcijska sesija na `anislrc.hr` ne dokazuje Preview prijavu.

`VITE_ADMIN_PASSWORD` više nije u upotrebi za admin login — ignorirajte stare upute koje ga traže.

**Nemojte mijenjati Vercel env bez odobrenja vlasnice.** Ako Preview nije usklađen, zatražite
usklađivanje Preview varijabli s Production.

## SEO

- `public/sitemap.xml` uključuje javne Interijere; **ne** uključuje LRC / Web Atelier dok nisu javni.
- `public/robots.txt` zabranjuje `/admin/`.
- Skriveni odjel: nedostupna stranica ima `noindex`; admin preview forsira `noindex` i bez kanonikal URL-a.

## Migracije

Nisu potrebne nove SQL migracije za ovaj workflow.
