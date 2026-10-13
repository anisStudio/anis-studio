-- F2.4.16B1 — Web Atelier inquiry persistence.
--
-- Additive. Does not create offers, projects, invoices, payments, drafts,
-- or the web-atelier-files bucket. Does not change Interijeri tables, RPCs,
-- Storage policies, or public visibility flags.
--
-- web_atelier_drafts is intentionally absent. draft_id is a nullable uuid
-- with no foreign key so a later migration can add
--   references public.web_atelier_drafts (id)
-- without rewriting existing inquiry rows. Planned draft retention is
-- 30 days with a 7-day reminder. Those jobs are not created here.
--
-- BLOCKER before the public Web Atelier route is opened:
-- This migration does NOT implement CAPTCHA, rate limiting, or an Edge
-- Function. Do not set web_atelier_public_visible and do not treat
-- /web-atelier/upit as publicly open until a trusted server or edge
-- control sits in front of create_public_web_atelier_inquiry.
-- That control must not trust client-supplied IP headers inside this RPC
-- and must not place a secret in the frontend.
-- risk_state stays unreviewed until an administrator sets it.

-- ---------------------------------------------------------------------------
-- Preflight. Fail before any new object if the foundation is missing or
-- this migration was already applied.
-- ---------------------------------------------------------------------------

do $preflight$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'F2.4.16B1: public.is_admin() is missing';
  end if;

  if to_regclass('public.web_atelier_inquiries') is not null then
    raise exception 'F2.4.16B1: public.web_atelier_inquiries already exists';
  end if;

  if to_regprocedure(
    'public.create_public_web_atelier_inquiry(uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text)'
  ) is not null then
    raise exception 'F2.4.16B1: public.create_public_web_atelier_inquiry(...) already exists';
  end if;

  if to_regprocedure('extensions.digest(text, text)') is null then
    raise exception 'F2.4.16B1: extensions.digest(text, text) is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto'
      and n.nspname = 'extensions'
  ) then
    raise exception 'F2.4.16B1: pgcrypto must already be installed in schema extensions';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- Inquiry table. A row is a submitted configurator snapshot, not an offer
-- and not a project. Future web_atelier_projects will reference this id.
-- ---------------------------------------------------------------------------

create sequence public.web_atelier_inquiry_ref_seq;

revoke all on sequence public.web_atelier_inquiry_ref_seq from public;
revoke all on sequence public.web_atelier_inquiry_ref_seq from anon;
revoke all on sequence public.web_atelier_inquiry_ref_seq from authenticated;
revoke all on sequence public.web_atelier_inquiry_ref_seq from service_role;

create table public.web_atelier_inquiries (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  reference_code text not null,
  status text not null default 'submitted',
  risk_state text not null default 'unreviewed',
  archived_at timestamptz,
  idempotency_key uuid not null,
  payload_sha256 text not null,
  language text not null,
  package_preference text,
  contact_name text not null,
  email text not null,
  phone text,
  existing_website text,
  referral text,
  project_types text[] not null,
  project_types_other text,
  goals text[] not null default '{}',
  goals_other text,
  content_ready text,
  visuals_ready text,
  content_links text,
  design_mood text[] not null default '{}',
  design_mood_other text,
  design_inspiration text,
  features text[] not null default '{}',
  features_other text,
  features_notes text,
  budget_range text not null,
  launch_deadline date,
  deadline_flexibility text,
  contact_preference text not null,
  contact_time text,
  extra_notes text not null,
  configurator_snapshot jsonb not null,
  draft_id uuid,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint web_atelier_inquiries_reference_code_key unique (reference_code),
  constraint web_atelier_inquiries_reference_code_check check (
    reference_code ~ '^WA-[0-9]{4}-[0-9]{6,}$'
  ),
  constraint web_atelier_inquiries_idempotency_key_key unique (idempotency_key),
  constraint web_atelier_inquiries_payload_sha256_check check (
    payload_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint web_atelier_inquiries_status_check check (
    status in (
      'submitted',
      'under_review',
      'accepted',
      'needs_info',
      'declined',
      'spam'
    )
  ),
  constraint web_atelier_inquiries_risk_state_check check (
    risk_state in ('unreviewed', 'clear', 'suspected', 'blocked')
  ),
  constraint web_atelier_inquiries_language_check check (
    language in ('hr', 'en')
  ),
  constraint web_atelier_inquiries_package_preference_check check (
    package_preference is null
    or package_preference in ('start', 'pro', 'premium')
  ),
  constraint web_atelier_inquiries_referral_check check (
    referral is null
    or referral in ('google', 'social', 'recommendation', 'other')
  ),
  constraint web_atelier_inquiries_budget_range_check check (
    budget_range in ('under-1000', '1000-3000', '3000-7000', '7000+')
  ),
  constraint web_atelier_inquiries_readiness_check check (
    (content_ready is null or content_ready in ('yes', 'partial', 'no'))
    and (visuals_ready is null or visuals_ready in ('yes', 'partial', 'no'))
  ),
  constraint web_atelier_inquiries_deadline_flexibility_check check (
    deadline_flexibility is null
    or deadline_flexibility in ('fixed', 'flexible', 'very-flexible')
  ),
  constraint web_atelier_inquiries_contact_preference_check check (
    contact_preference in ('email', 'phone', 'whatsapp', 'viber')
  ),
  constraint web_atelier_inquiries_contact_name_length_check check (
    char_length(contact_name) between 1 and 200
  ),
  constraint web_atelier_inquiries_email_length_check check (
    char_length(email) between 3 and 320
    and position('@' in email) > 1
  ),
  constraint web_atelier_inquiries_extra_notes_length_check check (
    char_length(extra_notes) between 10 and 10000
  ),
  constraint web_atelier_inquiries_project_types_check check (
    cardinality(project_types) between 1 and 12
  )
);

comment on table public.web_atelier_inquiries is
  'Submitted Web Atelier configurator inquiry. Not an offer, not an invoice, and not a project. package_preference and budget_range are informational only.';

comment on column public.web_atelier_inquiries.draft_id is
  'Reserved for a future web_atelier_drafts row. Null in B1, with no foreign key. The update guard currently freezes it; a later migration can replace that guard before attaching drafts.';

comment on column public.web_atelier_inquiries.package_preference is
  'Optional URL preference start/pro/premium. Not a price and not a binding offer.';

comment on column public.web_atelier_inquiries.status is
  'Inquiry workflow only. Archiving is archived_at, not a status value.';

comment on column public.web_atelier_inquiries.archived_at is
  'Set when an administrator archives the inquiry. Null means not archived. Independent of status and risk_state.';

comment on column public.web_atelier_inquiries.payload_sha256 is
  'Lowercase hex SHA-256 of the canonical jsonb snapshot. Detects idempotency-key reuse. Not a client secret.';

comment on column public.web_atelier_inquiries.reference_code is
  'WA-YYYY-NNNNNN from a global sequence. The year is UTC and the number never resets, so a new year continues the sequence instead of reusing 000001.';

create index web_atelier_inquiries_email_idx
  on public.web_atelier_inquiries (email);

create index web_atelier_inquiries_status_created_idx
  on public.web_atelier_inquiries (status, created_at desc)
  where archived_at is null;

create index web_atelier_inquiries_risk_state_idx
  on public.web_atelier_inquiries (risk_state);

create function public.web_atelier_inquiries_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.reference_code := old.reference_code;
  new.idempotency_key := old.idempotency_key;
  new.payload_sha256 := old.payload_sha256;
  new.language := old.language;
  new.package_preference := old.package_preference;
  new.contact_name := old.contact_name;
  new.email := old.email;
  new.phone := old.phone;
  new.existing_website := old.existing_website;
  new.referral := old.referral;
  new.project_types := old.project_types;
  new.project_types_other := old.project_types_other;
  new.goals := old.goals;
  new.goals_other := old.goals_other;
  new.content_ready := old.content_ready;
  new.visuals_ready := old.visuals_ready;
  new.content_links := old.content_links;
  new.design_mood := old.design_mood;
  new.design_mood_other := old.design_mood_other;
  new.design_inspiration := old.design_inspiration;
  new.features := old.features;
  new.features_other := old.features_other;
  new.features_notes := old.features_notes;
  new.budget_range := old.budget_range;
  new.launch_deadline := old.launch_deadline;
  new.deadline_flexibility := old.deadline_flexibility;
  new.contact_preference := old.contact_preference;
  new.contact_time := old.contact_time;
  new.extra_notes := old.extra_notes;
  new.configurator_snapshot := old.configurator_snapshot;
  new.draft_id := old.draft_id;
  new.created_at := old.created_at;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

comment on function public.web_atelier_inquiries_guard_update() is
  'Before update, keeps every submitted field unchanged. status, risk_state and archived_at pass through. No direct EXECUTE grant: PostgreSQL fires the trigger without exposing it as an API call.';

revoke all on function public.web_atelier_inquiries_guard_update() from public;
revoke all on function public.web_atelier_inquiries_guard_update() from anon;
revoke all on function public.web_atelier_inquiries_guard_update() from authenticated;
revoke all on function public.web_atelier_inquiries_guard_update() from service_role;

create trigger web_atelier_inquiries_guard_update
  before update on public.web_atelier_inquiries
  for each row
  execute function public.web_atelier_inquiries_guard_update();

alter table public.web_atelier_inquiries enable row level security;

revoke all on table public.web_atelier_inquiries from public;
revoke all on table public.web_atelier_inquiries from anon;
revoke all on table public.web_atelier_inquiries from authenticated;
revoke all on table public.web_atelier_inquiries from service_role;

grant select on table public.web_atelier_inquiries to authenticated;
grant update (status, risk_state, archived_at, updated_at)
  on table public.web_atelier_inquiries to authenticated;

create policy web_atelier_inquiries_admin_select
  on public.web_atelier_inquiries
  for select
  to authenticated
  using (public.is_admin());

create policy web_atelier_inquiries_admin_update
  on public.web_atelier_inquiries
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Public create. Caller cannot set status, risk, reference, price, or project.
-- ---------------------------------------------------------------------------

create function public.create_public_web_atelier_inquiry(
  p_idempotency_key uuid,
  p_language text,
  p_package_preference text,
  p_contact_name text,
  p_email text,
  p_phone text,
  p_existing_website text,
  p_referral text,
  p_project_types text[],
  p_project_types_other text,
  p_goals text[],
  p_goals_other text,
  p_content_ready text,
  p_visuals_ready text,
  p_content_links text,
  p_design_mood text[],
  p_design_mood_other text,
  p_design_inspiration text,
  p_features text[],
  p_features_other text,
  p_features_notes text,
  p_budget_range text,
  p_launch_deadline date,
  p_deadline_flexibility text,
  p_contact_preference text,
  p_contact_time text,
  p_extra_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(coalesce(p_contact_name, '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_website text := nullif(btrim(coalesce(p_existing_website, '')), '');
  v_referral text := nullif(btrim(coalesce(p_referral, '')), '');
  v_types_other text := nullif(btrim(coalesce(p_project_types_other, '')), '');
  v_goals_other text := nullif(btrim(coalesce(p_goals_other, '')), '');
  v_content_ready text := nullif(btrim(coalesce(p_content_ready, '')), '');
  v_visuals_ready text := nullif(btrim(coalesce(p_visuals_ready, '')), '');
  v_links text := nullif(btrim(coalesce(p_content_links, '')), '');
  v_mood_other text := nullif(btrim(coalesce(p_design_mood_other, '')), '');
  v_inspiration text := nullif(btrim(coalesce(p_design_inspiration, '')), '');
  v_features_other text := nullif(btrim(coalesce(p_features_other, '')), '');
  v_features_notes text := nullif(btrim(coalesce(p_features_notes, '')), '');
  v_flexibility text := nullif(btrim(coalesce(p_deadline_flexibility, '')), '');
  v_contact_time text := nullif(btrim(coalesce(p_contact_time, '')), '');
  v_notes text := nullif(btrim(coalesce(p_extra_notes, '')), '');
  v_package text := nullif(btrim(coalesce(p_package_preference, '')), '');
  v_types text[];
  v_goals text[];
  v_mood text[];
  v_features text[];
  v_snapshot jsonb;
  v_hash text;
  v_id uuid;
  v_reference text;
  v_ref_seq bigint;
  v_existing_id uuid;
  v_existing_reference text;
  v_existing_hash text;
  v_constraint text;
begin
  if p_idempotency_key is null then
    raise exception 'create_public_web_atelier_inquiry: idempotency key je obavezan';
  end if;

  if p_language is distinct from 'hr' and p_language is distinct from 'en' then
    raise exception 'create_public_web_atelier_inquiry: jezik mora biti hr ili en';
  end if;

  if v_package is not null and v_package not in ('start', 'pro', 'premium') then
    raise exception 'create_public_web_atelier_inquiry: neispravna informativna oznaka paketa';
  end if;

  if v_name is null or char_length(v_name) > 200 then
    raise exception 'create_public_web_atelier_inquiry: ime mora imati 1 do 200 znakova';
  end if;

  if v_email is null
    or char_length(v_email) > 320
    or position('@' in v_email) < 2
    or position('.' in split_part(v_email, '@', 2)) = 0
  then
    raise exception 'create_public_web_atelier_inquiry: email nije valjan';
  end if;

  if v_phone is not null and char_length(v_phone) > 40 then
    raise exception 'create_public_web_atelier_inquiry: telefon je predugačak';
  end if;

  if v_website is not null and char_length(v_website) > 500 then
    raise exception 'create_public_web_atelier_inquiry: URL stranice je predugačak';
  end if;

  if v_referral is not null
    and v_referral not in ('google', 'social', 'recommendation', 'other')
  then
    raise exception 'create_public_web_atelier_inquiry: neispravan izvor';
  end if;

  if p_project_types is null
    or cardinality(p_project_types) < 1
    or cardinality(p_project_types) > 12
  then
    raise exception 'create_public_web_atelier_inquiry: odaberi barem jedan tip projekta';
  end if;

  select coalesce(array_agg(distinct item order by item), array[]::text[])
    into v_types
  from unnest(p_project_types) as item
  where nullif(btrim(item), '') is not null;

  if cardinality(v_types) < 1
    or exists (
      select 1
      from unnest(v_types) as item
      where item not in (
        'Nova web stranica od nule',
        'Redizajn postojeće stranice',
        'Landing stranica za kampanju',
        'Web shop',
        'Portfolio / osobna stranica',
        'Sustav za rezervacije / termine',
        'Web aplikacija / SaaS',
        'Interna aplikacija / alat (za firmu)',
        'Drugo'
      )
    )
  then
    raise exception 'create_public_web_atelier_inquiry: neispravan tip projekta';
  end if;

  if v_types_other is not null and char_length(v_types_other) > 500 then
    raise exception 'create_public_web_atelier_inquiry: opis drugog tipa je predugačak';
  end if;

  select coalesce(array_agg(distinct item order by item), array[]::text[])
    into v_goals
  from unnest(coalesce(p_goals, '{}')) as item
  where nullif(btrim(item), '') is not null;

  if cardinality(v_goals) > 12
    or exists (
      select 1
      from unnest(v_goals) as item
      where item not in (
        'Predstaviti usluge / brand',
        'Prodavati proizvode online (web shop)',
        'Prikazati radove / portfolio',
        'Dobiti upite (leadove)',
        'Educirati (blog, članci, tutorijali)',
        'Primati rezervacije / termine online',
        'Omogućiti prijave / članstva (user accounti)',
        'Automatizirati interne procese (interna aplikacija / alat)',
        'Drugo'
      )
    )
  then
    raise exception 'create_public_web_atelier_inquiry: neispravan cilj';
  end if;

  if v_goals_other is not null and char_length(v_goals_other) > 500 then
    raise exception 'create_public_web_atelier_inquiry: opis drugih ciljeva je predugačak';
  end if;

  if v_content_ready is not null and v_content_ready not in ('yes', 'partial', 'no') then
    raise exception 'create_public_web_atelier_inquiry: neispravna spremnost tekstova';
  end if;

  if v_visuals_ready is not null and v_visuals_ready not in ('yes', 'partial', 'no') then
    raise exception 'create_public_web_atelier_inquiry: neispravna spremnost vizuala';
  end if;

  if v_links is not null and char_length(v_links) > 2000 then
    raise exception 'create_public_web_atelier_inquiry: linkovi na materijale su predugački';
  end if;

  select coalesce(array_agg(distinct item order by item), array[]::text[])
    into v_mood
  from unnest(coalesce(p_design_mood, '{}')) as item
  where nullif(btrim(item), '') is not null;

  if cardinality(v_mood) > 8
    or exists (
      select 1
      from unnest(v_mood) as item
      where item not in (
        'Ozbiljno / poslovno',
        'Svježe i moderno',
        'Elegantno i luksuzno',
        'Razigrano i kreativno',
        'Minimalistički',
        'Drugo'
      )
    )
  then
    raise exception 'create_public_web_atelier_inquiry: neispravan stil dizajna';
  end if;

  if v_mood_other is not null and char_length(v_mood_other) > 500 then
    raise exception 'create_public_web_atelier_inquiry: opis drugog stila je predugačak';
  end if;

  if v_inspiration is not null and char_length(v_inspiration) > 4000 then
    raise exception 'create_public_web_atelier_inquiry: inspiracija je predugačka';
  end if;

  select coalesce(array_agg(distinct item order by item), array[]::text[])
    into v_features
  from unnest(coalesce(p_features, '{}')) as item
  where nullif(btrim(item), '') is not null;

  if cardinality(v_features) > 16
    or exists (
      select 1
      from unnest(v_features) as item
      where item not in (
        'Kontakt forma i osnovni upiti',
        'Blog / novosti',
        'Web shop (košarica, naplata)',
        'Sustav za rezervacije (kalendar, termini)',
        'Korisnički računi / članstvo',
        'Administratorski panel / dashboard',
        'Višejezičnost (npr. HR/EN)',
        'Integracija s newsletterom (Mailchimp, sl.)',
        'Integracije s vanjskim servisima (npr. CRM, sustav naplate)',
        'Integracija s društvenim mrežama',
        'Drugo'
      )
    )
  then
    raise exception 'create_public_web_atelier_inquiry: neispravna funkcionalnost';
  end if;

  if v_features_other is not null and char_length(v_features_other) > 500 then
    raise exception 'create_public_web_atelier_inquiry: opis drugih funkcionalnosti je predugačak';
  end if;

  if v_features_notes is not null and char_length(v_features_notes) > 4000 then
    raise exception 'create_public_web_atelier_inquiry: napomene o funkcionalnostima su predugačke';
  end if;

  if p_budget_range is null
    or p_budget_range not in ('under-1000', '1000-3000', '3000-7000', '7000+')
  then
    raise exception 'create_public_web_atelier_inquiry: neispravan okvirni budžet';
  end if;

  if p_launch_deadline is not null
    and (p_launch_deadline < date '2000-01-01' or p_launch_deadline > date '2100-01-01')
  then
    raise exception 'create_public_web_atelier_inquiry: neispravan datum pokretanja';
  end if;

  if v_flexibility is not null
    and v_flexibility not in ('fixed', 'flexible', 'very-flexible')
  then
    raise exception 'create_public_web_atelier_inquiry: neispravna fleksibilnost roka';
  end if;

  if p_contact_preference is null
    or p_contact_preference not in ('email', 'phone', 'whatsapp', 'viber')
  then
    raise exception 'create_public_web_atelier_inquiry: neispravan način kontakta';
  end if;

  if v_contact_time is not null and char_length(v_contact_time) > 200 then
    raise exception 'create_public_web_atelier_inquiry: vrijeme kontakta je predugačko';
  end if;

  if v_notes is null or char_length(v_notes) < 10 or char_length(v_notes) > 10000 then
    raise exception 'create_public_web_atelier_inquiry: opis projekta mora imati 10 do 10000 znakova';
  end if;

  v_snapshot := pg_catalog.jsonb_build_object(
    'language', p_language,
    'package_preference', v_package,
    'contact_name', v_name,
    'email', v_email,
    'phone', v_phone,
    'existing_website', v_website,
    'referral', v_referral,
    'project_types', to_jsonb(v_types),
    'project_types_other', v_types_other,
    'goals', to_jsonb(v_goals),
    'goals_other', v_goals_other,
    'content_ready', v_content_ready,
    'visuals_ready', v_visuals_ready,
    'content_links', v_links,
    'design_mood', to_jsonb(v_mood),
    'design_mood_other', v_mood_other,
    'design_inspiration', v_inspiration,
    'features', to_jsonb(v_features),
    'features_other', v_features_other,
    'features_notes', v_features_notes,
    'budget_range', p_budget_range,
    'launch_deadline', p_launch_deadline,
    'deadline_flexibility', v_flexibility,
    'contact_preference', p_contact_preference,
    'contact_time', v_contact_time,
    'extra_notes', v_notes
  );
  v_hash := pg_catalog.encode(
    extensions.digest(v_snapshot::text, 'sha256'),
    'hex'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key::text, 0::bigint)
  );

  select i.id, i.reference_code, i.payload_sha256
    into v_existing_id, v_existing_reference, v_existing_hash
  from public.web_atelier_inquiries i
  where i.idempotency_key = p_idempotency_key;

  if v_existing_id is not null then
    if v_existing_hash is distinct from v_hash then
      raise exception 'create_public_web_atelier_inquiry: isti idempotency key ima različit sadržaj';
    end if;

    return pg_catalog.jsonb_build_object(
      'inquiry_id', v_existing_id,
      'reference_code', v_existing_reference
    );
  end if;

  -- UTC year plus a sequence that never resets. WA-2026-000100 is followed
  -- by WA-2027-000101, not by WA-2027-000001. nextval runs once into
  -- v_ref_seq. Values under 1000000 are left-padded to 6 digits; values
  -- with 6 or more digits use the full number as text because PostgreSQL
  -- lpad truncates longer strings to the requested length. A retried same
  -- key does not consume a number because this runs only after the
  -- existing-row check.
  v_ref_seq := pg_catalog.nextval('public.web_atelier_inquiry_ref_seq');
  v_reference :=
    'WA-'
    || pg_catalog.to_char(pg_catalog.timezone('UTC', pg_catalog.now()), 'YYYY')
    || '-'
    || case
         when char_length(v_ref_seq::text) >= 6 then v_ref_seq::text
         else pg_catalog.lpad(v_ref_seq::text, 6, '0')
       end;

  begin
    insert into public.web_atelier_inquiries (
      reference_code,
      status,
      risk_state,
      idempotency_key,
      payload_sha256,
      language,
      package_preference,
      contact_name,
      email,
      phone,
      existing_website,
      referral,
      project_types,
      project_types_other,
      goals,
      goals_other,
      content_ready,
      visuals_ready,
      content_links,
      design_mood,
      design_mood_other,
      design_inspiration,
      features,
      features_other,
      features_notes,
      budget_range,
      launch_deadline,
      deadline_flexibility,
      contact_preference,
      contact_time,
      extra_notes,
      configurator_snapshot,
      draft_id,
      archived_at
    )
    values (
      v_reference,
      'submitted',
      'unreviewed',
      p_idempotency_key,
      v_hash,
      p_language,
      v_package,
      v_name,
      v_email,
      v_phone,
      v_website,
      v_referral,
      v_types,
      v_types_other,
      v_goals,
      v_goals_other,
      v_content_ready,
      v_visuals_ready,
      v_links,
      v_mood,
      v_mood_other,
      v_inspiration,
      v_features,
      v_features_other,
      v_features_notes,
      p_budget_range,
      p_launch_deadline,
      v_flexibility,
      p_contact_preference,
      v_contact_time,
      v_notes,
      v_snapshot,
      null,
      null
    )
    returning id into v_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;

      if v_constraint is distinct from 'web_atelier_inquiries_idempotency_key_key' then
        raise;
      end if;

      select i.id, i.reference_code, i.payload_sha256
        into v_existing_id, v_existing_reference, v_existing_hash
      from public.web_atelier_inquiries i
      where i.idempotency_key = p_idempotency_key;

      if v_existing_id is null or v_existing_hash is distinct from v_hash then
        raise exception 'create_public_web_atelier_inquiry: isti idempotency key ima različit sadržaj';
      end if;

      return pg_catalog.jsonb_build_object(
        'inquiry_id', v_existing_id,
        'reference_code', v_existing_reference
      );
  end;

  return pg_catalog.jsonb_build_object(
    'inquiry_id', v_id,
    'reference_code', v_reference
  );
end;
$$;

comment on function public.create_public_web_atelier_inquiry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) is
  'SECURITY DEFINER, owned by the migration role, search_path empty. Inserts one inquiry or returns the same id and reference for the same key and SHA-256. No personal data in errors. No client status, price, or project.';

revoke all on function public.create_public_web_atelier_inquiry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) from public;
revoke all on function public.create_public_web_atelier_inquiry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) from anon;
revoke all on function public.create_public_web_atelier_inquiry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) from authenticated;
revoke all on function public.create_public_web_atelier_inquiry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) from service_role;

grant execute on function public.create_public_web_atelier_inquiry(
  uuid, text, text, text, text, text, text, text, text[], text, text[], text, text, text, text, text[], text, text, text[], text, text, text, date, text, text, text, text
) to anon, authenticated;

-- Manual verification after a later apply. Do not run as part of deployment automation from this comment.
-- select
--   p.proname,
--   p.prosecdef,
--   p.proconfig
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname = 'create_public_web_atelier_inquiry';
--
-- select policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'web_atelier_inquiries';
--
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'web_atelier_inquiries';
--
-- select grantee, column_name, privilege_type
-- from information_schema.column_privileges
-- where table_schema = 'public'
--   and table_name = 'web_atelier_inquiries';
--
-- select grantee, privilege_type
-- from information_schema.routine_privileges
-- where specific_schema = 'public'
--   and routine_name in (
--     'create_public_web_atelier_inquiry',
--     'web_atelier_inquiries_guard_update'
--   );
