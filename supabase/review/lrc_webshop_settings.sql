-- Review only. Do not apply this migration to production in the 01-L5 preview.
-- The local preview keeps the webshop switch in this browser until these
-- columns exist. Applying it is a separate, approved step.

alter table public.settings
  add column if not exists lrc_webshop_enabled boolean not null default false,
  add column if not exists lrc_webshop_url text;

alter table public.settings
  add constraint settings_lrc_webshop_url_https
  check (
    lrc_webshop_url is null
    or lrc_webshop_url ~ '^https://[^[:space:]]+$'
  );
