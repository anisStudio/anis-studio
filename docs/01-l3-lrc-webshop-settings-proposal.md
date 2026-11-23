# 01-L3 — prijedlog postavki LRC webshopa

Ovaj korak ne mijenja bazu i ne uključuje webshop poveznicu. Aplikacija je pripremljena
da poveznicu prikaže samo kada su istodobno zadovoljena oba uvjeta:

1. zasebna postavka `lrc_webshop_enabled` ima vrijednost `true`
2. `lrc_webshop_url` sadrži valjanu HTTPS adresu bez ugrađenih pristupnih podataka

Dok polja ne postoje u retku `settings`, klijentski zadani podaci su `false` i `null`,
pa je poveznica „Idi na webshop” skrivena. Postavka
`lrc_public_visible` ostaje potpuno neovisna.

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

Nakon primjene migracije u zasebnom odobrenom koraku, u Admin → Postavke može se
dodati sklopka „Prikaži poveznicu na LRC webshop” i polje za adresu. Sklopka se ne
smije moći uključiti dok adresa nije spremljena i potvrđena.
