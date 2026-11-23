# 01-L3 — prijedlog postavki LRC webshopa

Ovaj korak ne mijenja bazu i ne uključuje webshop poveznicu. Aplikacija je pripremljena
da poveznicu prikaže samo kada su istodobno zadovoljena oba uvjeta:

1. zasebna postavka `lrc_webshop_enabled` ima vrijednost `true`
2. `lrc_webshop_url` sadrži valjanu HTTPS adresu bez ugrađenih pristupnih podataka

Dok polja ne postoje u retku `settings`, klijentski zadani podaci su `false` i `null`.
Prekidač u Admin → Postavke može se uključiti i bez adrese: tada se vidi postojeća
košarica, a poveznica „Otvori webshop” ostaje skrivena. Poveznica se prikazuje samo
uz uključen prekidač i valjanu HTTPS adresu. `lrc_public_visible` ostaje neovisna.
Dok migracija nije primijenjena, prekidač se pamti samo u pregledniku.

## Predložena buduća migracija

```sql
alter table public.settings
  add column if not exists lrc_webshop_enabled boolean not null default false,
  add column if not exists lrc_webshop_url text;

alter table public.settings
  add constraint settings_lrc_webshop_url_https
  check (
    lrc_webshop_url is null
    or lrc_webshop_url ~ '^https://[^[:space:]]+$'
  );
```

SQL za pregled je u `supabase/review/lrc_webshop_settings.sql`. Ne primjenjivati ga
na produkciju u ovom koraku. Nakon odobrenog koraka ista se polja spremaju kroz
postojeći `updateSettings`.
