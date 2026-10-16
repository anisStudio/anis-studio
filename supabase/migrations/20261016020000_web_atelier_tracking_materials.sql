-- F2.4.16E-F — Web Atelier client project tracking tokens + material requirements.
--
-- STATUS: DRAFT FOR LOCAL REVIEW. NOT APPLIED to any database. Do not run
-- `supabase db push` until signed off. Additive only.
--
-- Phase E: purpose-scoped tracking tokens for accepted projects.
--   * No client accounts. Admin creates a token; plaintext is returned once.
--   * Only SHA-256 hashes are stored. Tokens expire and can be revoked.
--   * Public RPC returns a minimal status payload (no email, phone, notes,
--     acceptance evidence, or financial fields). Never sends e-mail.
--
-- Phase F: administrator-defined material requirements per project.
--   * Admin checklist only in this migration. Client upload authorization is
--     intentionally NOT implemented (design blocker documented below).
--   * Private Storage bucket design is conditional (skipped when storage
--     schema is absent, e.g. local Docker SQL tests).
--   * No public buckets. No anonymous uploads. No fabricated file rows.
--
-- Lock order extension (deadlock prevention), always ascending:
--   1) web_atelier_inquiries by id
--   2) web_atelier_offers by id
--   3) web_atelier_projects by id
--   4) web_atelier_project_tracking_tokens by id
--   5) web_atelier_material_requirements by id
--
-- BLOCKER (client materials upload): a secure client upload path would need a
-- purpose-scoped upload grant (separate from status-read tokens), virus/type
-- limits, size caps, and retention policy. Until those decisions land, only
-- admin-side requirement metadata is writable.

-- ---------------------------------------------------------------------------
-- Preflight
-- ---------------------------------------------------------------------------

do $preflight$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'F2.4.16E: public.is_admin() is missing';
  end if;

  if to_regprocedure('public.web_atelier_require_admin()') is null then
    raise exception 'F2.4.16E: public.web_atelier_require_admin() is missing (apply C-D first)';
  end if;

  if to_regclass('public.web_atelier_projects') is null then
    raise exception 'F2.4.16E: public.web_atelier_projects is missing (apply C-D first)';
  end if;

  if to_regprocedure('extensions.digest(text, text)') is null then
    raise exception 'F2.4.16E: extensions.digest(text, text) is missing';
  end if;

  if to_regclass('public.web_atelier_project_tracking_tokens') is not null
    or to_regclass('public.web_atelier_material_requirements') is not null
    or to_regclass('public.web_atelier_material_file_meta') is not null
  then
    raise exception 'F2.4.16E: tracking/materials tables already exist';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.web_atelier_lock_project(p_project_id uuid)
returns public.web_atelier_projects
language plpgsql
set search_path = ''
as $$
declare
  v_row public.web_atelier_projects%rowtype;
begin
  select * into v_row
  from public.web_atelier_projects p
  where p.id = p_project_id
  for update;
  if not found then
    raise exception 'project_not_found';
  end if;
  return v_row;
end;
$$;

revoke all on function public.web_atelier_lock_project(uuid)
  from public, anon, authenticated, service_role;

create function public.web_atelier_hash_tracking_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

revoke all on function public.web_atelier_hash_tracking_token(text)
  from public, anon, authenticated, service_role;

create function public.web_atelier_project_status_public_copy(p_status text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
begin
  case p_status
    when 'preparing' then
      return jsonb_build_object(
        'label', 'Priprema',
        'description', 'Pripremamo projekt i dogovaramo sljedeće korake.'
      );
    when 'waiting_for_client' then
      return jsonb_build_object(
        'label', 'Čekamo vas',
        'description', 'Potrebne su informacije ili materijali s vaše strane da nastavimo.'
      );
    when 'ready_to_start' then
      return jsonb_build_object(
        'label', 'Spremno za početak',
        'description', 'Sve je spremno; uskoro krećemo s izradom.'
      );
    when 'scheduled' then
      return jsonb_build_object(
        'label', 'Zakazano',
        'description', 'Početak izrade je dogovoren i zakazan.'
      );
    when 'in_progress' then
      return jsonb_build_object(
        'label', 'U izradi',
        'description', 'Aktivno radimo na vašem web projektu.'
      );
    when 'client_review' then
      return jsonb_build_object(
        'label', 'Na vašem pregledu',
        'description', 'Pripremili smo materijal za vaš pregled i povratne informacije.'
      );
    when 'revision' then
      return jsonb_build_object(
        'label', 'Revizija',
        'description', 'Uvodimo dogovorene izmjene nakon pregleda.'
      );
    when 'final_approval' then
      return jsonb_build_object(
        'label', 'Završna potvrda',
        'description', 'Čekamo završnu potvrdu prije zatvaranja projekta.'
      );
    when 'completed' then
      return jsonb_build_object(
        'label', 'Završeno',
        'description', 'Projekt je završen.'
      );
    when 'on_hold' then
      return jsonb_build_object(
        'label', 'Na čekanju',
        'description', 'Projekt je privremeno pauziran.'
      );
    when 'cancelled' then
      return jsonb_build_object(
        'label', 'Otkazano',
        'description', 'Projekt je otkazan.'
      );
    else
      raise exception 'project_status_invalid';
  end case;
end;
$$;

revoke all on function public.web_atelier_project_status_public_copy(text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- E: tracking tokens (hash only)
-- ---------------------------------------------------------------------------

create table public.web_atelier_project_tracking_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.web_atelier_projects (id) on delete restrict,
  purpose text not null default 'project_status_read',
  token_hash text not null,
  token_prefix text not null,
  label text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  last_used_at timestamptz,
  use_count integer not null default 0,
  constraint web_atelier_tracking_purpose_check check (purpose = 'project_status_read'),
  constraint web_atelier_tracking_token_hash_key unique (token_hash),
  constraint web_atelier_tracking_token_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint web_atelier_tracking_token_prefix_check check (
    char_length(token_prefix) between 8 and 24
  ),
  constraint web_atelier_tracking_label_check check (
    label is null or char_length(label) between 1 and 200
  ),
  constraint web_atelier_tracking_use_count_check check (use_count >= 0),
  constraint web_atelier_tracking_expires_after_created_check check (expires_at > created_at)
);

comment on table public.web_atelier_project_tracking_tokens is
  'Purpose-scoped project status tracking tokens. Plaintext never stored; only SHA-256 hashes.';

create index web_atelier_tracking_tokens_project_idx
  on public.web_atelier_project_tracking_tokens (project_id, created_at desc);

create index web_atelier_tracking_tokens_active_idx
  on public.web_atelier_project_tracking_tokens (project_id)
  where revoked_at is null;

create function public.web_atelier_tracking_tokens_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'tracking_token_immutable_delete';
  end if;

  if tg_op = 'INSERT' then
    if new.purpose is distinct from 'project_status_read' then
      raise exception 'tracking_purpose_invalid';
    end if;
    if new.token_hash is null or new.token_hash !~ '^[0-9a-f]{64}$' then
      raise exception 'tracking_token_hash_invalid';
    end if;
    if new.revoked_at is not null then
      raise exception 'tracking_token_insert_revoked';
    end if;
    if new.use_count <> 0 or new.last_used_at is not null then
      raise exception 'tracking_token_insert_usage';
    end if;
    return new;
  end if;

  -- UPDATE: identity and secret material immutable; only revoke/usage clocks.
  if new.id is distinct from old.id
    or new.project_id is distinct from old.project_id
    or new.purpose is distinct from old.purpose
    or new.token_hash is distinct from old.token_hash
    or new.token_prefix is distinct from old.token_prefix
    or new.label is distinct from old.label
    or new.expires_at is distinct from old.expires_at
    or new.created_at is distinct from old.created_at
    or new.created_by is distinct from old.created_by
  then
    raise exception 'tracking_token_immutable';
  end if;

  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'tracking_token_already_revoked';
  end if;

  if new.use_count < old.use_count then
    raise exception 'tracking_token_use_count_invalid';
  end if;

  return new;
end;
$$;

revoke all on function public.web_atelier_tracking_tokens_guard()
  from public, anon, authenticated, service_role;

create trigger web_atelier_tracking_tokens_guard
  before insert or update or delete on public.web_atelier_project_tracking_tokens
  for each row execute function public.web_atelier_tracking_tokens_guard();

alter table public.web_atelier_project_tracking_tokens enable row level security;

revoke all on table public.web_atelier_project_tracking_tokens
  from public, anon, authenticated, service_role;

-- No SELECT grant: admins inspect tokens only via list RPC (hash never exposed).

-- ---------------------------------------------------------------------------
-- F: material requirements + future file metadata
-- ---------------------------------------------------------------------------

create table public.web_atelier_material_requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.web_atelier_projects (id) on delete restrict,
  kind text not null,
  title text not null,
  description text,
  is_required boolean not null default true,
  deadline date,
  status text not null default 'pending',
  admin_notes text,
  planned_storage_path text not null,
  position integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint web_atelier_material_kind_check check (
    kind in ('logo', 'text', 'images', 'brand_colors', 'other')
  ),
  constraint web_atelier_material_status_check check (
    status in ('pending', 'received', 'waived', 'cancelled')
  ),
  constraint web_atelier_material_title_check check (char_length(title) between 1 and 200),
  constraint web_atelier_material_description_check check (
    description is null or char_length(description) <= 2000
  ),
  constraint web_atelier_material_admin_notes_check check (
    admin_notes is null or char_length(admin_notes) <= 4000
  ),
  constraint web_atelier_material_position_check check (position >= 1 and position <= 500),
  constraint web_atelier_material_storage_path_check check (
    planned_storage_path ~ '^web-atelier-materials/[0-9a-f-]{36}/[0-9a-f-]{36}/$'
  )
);

comment on table public.web_atelier_material_requirements is
  'Admin-defined material checklist for accepted Web Atelier projects. Client upload not enabled.';

create index web_atelier_material_requirements_project_idx
  on public.web_atelier_material_requirements (project_id, position, created_at);

create table public.web_atelier_material_file_meta (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.web_atelier_material_requirements (id) on delete restrict,
  storage_object_path text not null,
  original_filename text not null,
  content_type text not null,
  byte_size bigint not null,
  sha256 text,
  uploaded_at timestamptz,
  uploaded_by_role text not null,
  created_at timestamptz not null default now(),
  constraint web_atelier_material_file_role_check check (
    uploaded_by_role in ('admin', 'client_token')
  ),
  constraint web_atelier_material_file_name_check check (
    char_length(original_filename) between 1 and 260
  ),
  constraint web_atelier_material_file_type_check check (
    char_length(content_type) between 3 and 120
  ),
  constraint web_atelier_material_file_size_check check (
    byte_size >= 0 and byte_size <= 52428800
  ),
  constraint web_atelier_material_file_sha_check check (
    sha256 is null or sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint web_atelier_material_file_path_check check (
    storage_object_path ~ '^web-atelier-materials/'
  )
);

comment on table public.web_atelier_material_file_meta is
  'Future private-storage file metadata only. No anonymous uploads; no seed/customer files in V1.';

create index web_atelier_material_file_meta_requirement_idx
  on public.web_atelier_material_file_meta (requirement_id);

create function public.web_atelier_material_requirements_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'material_requirement_delete_forbidden';
  end if;

  if tg_op = 'INSERT' then
    if new.planned_storage_path is null
      or new.planned_storage_path
        !~ ('^web-atelier-materials/' || new.project_id::text || '/' || new.id::text || '/$')
    then
      raise exception 'material_storage_path_invalid';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.project_id is distinct from old.project_id
    or new.planned_storage_path is distinct from old.planned_storage_path
    or new.created_at is distinct from old.created_at
    or new.created_by is distinct from old.created_by
  then
    raise exception 'material_requirement_identity_immutable';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.web_atelier_material_requirements_guard()
  from public, anon, authenticated, service_role;

create trigger web_atelier_material_requirements_guard
  before insert or update or delete on public.web_atelier_material_requirements
  for each row execute function public.web_atelier_material_requirements_guard();

create function public.web_atelier_material_file_meta_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- V1: refuse all direct writes. Future client/admin upload RPCs will be definer-owned.
  raise exception 'material_file_meta_writes_disabled';
end;
$$;

revoke all on function public.web_atelier_material_file_meta_guard()
  from public, anon, authenticated, service_role;

create trigger web_atelier_material_file_meta_guard
  before insert or update or delete on public.web_atelier_material_file_meta
  for each row execute function public.web_atelier_material_file_meta_guard();

alter table public.web_atelier_material_requirements enable row level security;
alter table public.web_atelier_material_file_meta enable row level security;

revoke all on table public.web_atelier_material_requirements
  from public, anon, authenticated, service_role;
revoke all on table public.web_atelier_material_file_meta
  from public, anon, authenticated, service_role;

grant select on table public.web_atelier_material_requirements to authenticated;
grant select on table public.web_atelier_material_file_meta to authenticated;

create policy web_atelier_material_requirements_admin_select
  on public.web_atelier_material_requirements for select to authenticated
  using (public.is_admin());

create policy web_atelier_material_file_meta_admin_select
  on public.web_atelier_material_file_meta for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Private Storage bucket design (conditional)
-- ---------------------------------------------------------------------------

do $storage$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'F2.4.16F: storage schema absent — skipping private bucket bootstrap';
    return;
  end if;

  -- PRODUCTION GATE (manual): Storage RLS is OR across policies. This block adds
  -- admin-only policies for this bucket and does NOT revoke legacy anon policies
  -- that may already exist on storage.objects for other buckets. Before go-live,
  -- confirm in Supabase that no anon policy allows bucket_id = 'web-atelier-materials'.
  -- Docker plain Postgres cannot verify Storage — do not treat SQL suite as proof.

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'web-atelier-materials',
    'web-atelier-materials',
    false,
    52428800,
    array[
      'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml',
      'application/pdf', 'text/plain', 'application/zip'
    ]
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Object `name` is the path inside the bucket (no bucket id prefix).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'web_atelier_materials_admin_select'
  ) then
    execute $pol$
      create policy web_atelier_materials_admin_select
        on storage.objects for select to authenticated
        using (bucket_id = 'web-atelier-materials' and public.is_admin())
    $pol$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'web_atelier_materials_admin_insert'
  ) then
    execute $pol$
      create policy web_atelier_materials_admin_insert
        on storage.objects for insert to authenticated
        with check (
          bucket_id = 'web-atelier-materials'
          and public.is_admin()
          and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/'
        )
    $pol$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'web_atelier_materials_admin_update'
  ) then
    execute $pol$
      create policy web_atelier_materials_admin_update
        on storage.objects for update to authenticated
        using (bucket_id = 'web-atelier-materials' and public.is_admin())
        with check (bucket_id = 'web-atelier-materials' and public.is_admin())
    $pol$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'web_atelier_materials_admin_delete'
  ) then
    execute $pol$
      create policy web_atelier_materials_admin_delete
        on storage.objects for delete to authenticated
        using (bucket_id = 'web-atelier-materials' and public.is_admin())
    $pol$;
  end if;
end
$storage$;

-- ---------------------------------------------------------------------------
-- E RPCs
-- ---------------------------------------------------------------------------

create function public.admin_create_web_atelier_project_tracking_token(
  p_project_id uuid,
  p_expires_at timestamptz,
  p_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.web_atelier_projects%rowtype;
  v_token text;
  v_hash text;
  v_prefix text;
  v_id uuid := gen_random_uuid();
  v_label text;
begin
  perform public.web_atelier_require_admin();

  if p_project_id is null then
    raise exception 'project_id_required';
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'tracking_expires_invalid';
  end if;

  if p_expires_at > now() + interval '90 days' then
    raise exception 'tracking_expires_too_far';
  end if;

  v_label := nullif(btrim(coalesce(p_label, '')), '');
  if v_label is not null and char_length(v_label) > 200 then
    raise exception 'tracking_label_invalid';
  end if;

  -- Lock order: inquiry → project (never project before its inquiry).
  select * into v_project
  from public.web_atelier_projects p
  where p.id = p_project_id;
  if not found then
    raise exception 'project_not_found';
  end if;

  if v_project.inquiry_id is not null then
    perform public.web_atelier_lock_inquiry(v_project.inquiry_id);
  end if;
  v_project := public.web_atelier_lock_project(p_project_id);

  v_token := 'wat_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := public.web_atelier_hash_tracking_token(v_token);
  v_prefix := left(v_token, 12);

  insert into public.web_atelier_project_tracking_tokens (
    id, project_id, purpose, token_hash, token_prefix, label,
    expires_at, created_by
  ) values (
    v_id, p_project_id, 'project_status_read', v_hash, v_prefix, v_label,
    p_expires_at, auth.uid()
  );

  -- Plaintext returned once; never persisted.
  return jsonb_build_object(
    'token_id', v_id,
    'token', v_token,
    'token_prefix', v_prefix,
    'purpose', 'project_status_read',
    'expires_at', p_expires_at,
    'project_id', p_project_id,
    'label', v_label
  );
end;
$$;

create function public.admin_revoke_web_atelier_project_tracking_token(p_token_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.web_atelier_project_tracking_tokens%rowtype;
begin
  perform public.web_atelier_require_admin();

  if p_token_id is null then
    raise exception 'tracking_token_id_required';
  end if;

  -- Lock order: project → token (never token before its project).
  select * into v_row
  from public.web_atelier_project_tracking_tokens t
  where t.id = p_token_id;

  if not found then
    raise exception 'tracking_token_not_found';
  end if;

  perform public.web_atelier_lock_project(v_row.project_id);

  select * into v_row
  from public.web_atelier_project_tracking_tokens t
  where t.id = p_token_id
  for update;

  if not found then
    raise exception 'tracking_token_not_found';
  end if;

  if v_row.revoked_at is not null then
    return jsonb_build_object(
      'token_id', v_row.id,
      'revoked_at', v_row.revoked_at,
      'already_revoked', true
    );
  end if;

  update public.web_atelier_project_tracking_tokens t
  set revoked_at = now()
  where t.id = p_token_id
  returning * into v_row;

  return jsonb_build_object(
    'token_id', v_row.id,
    'revoked_at', v_row.revoked_at,
    'already_revoked', false
  );
end;
$$;

create function public.admin_list_web_atelier_project_tracking_tokens(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  perform public.web_atelier_require_admin();

  if p_project_id is null then
    raise exception 'project_id_required';
  end if;

  perform public.web_atelier_lock_project(p_project_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'project_id', t.project_id,
      'purpose', t.purpose,
      'token_prefix', t.token_prefix,
      'label', t.label,
      'expires_at', t.expires_at,
      'revoked_at', t.revoked_at,
      'created_at', t.created_at,
      'last_used_at', t.last_used_at,
      'use_count', t.use_count,
      'is_expired', t.expires_at <= now(),
      'is_active', t.revoked_at is null and t.expires_at > now()
    )
    order by t.created_at desc
  ), '[]'::jsonb)
  into v_out
  from public.web_atelier_project_tracking_tokens t
  where t.project_id = p_project_id;

  -- Defense: never include token_hash in the payload.
  return v_out;
end;
$$;

create function public.get_web_atelier_project_public_status(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_hash text;
  v_tok public.web_atelier_project_tracking_tokens%rowtype;
  v_project public.web_atelier_projects%rowtype;
  v_copy jsonb;
begin
  v_token := btrim(coalesce(p_token, ''));
  if v_token !~ '^wat_[0-9a-f]{64}$' then
    raise exception 'tracking_token_invalid';
  end if;

  v_hash := public.web_atelier_hash_tracking_token(v_token);

  select * into v_tok
  from public.web_atelier_project_tracking_tokens t
  where t.token_hash = v_hash
  for update;

  if not found then
    raise exception 'tracking_token_invalid';
  end if;

  if v_tok.revoked_at is not null then
    raise exception 'tracking_token_revoked';
  end if;

  if v_tok.expires_at <= now() then
    raise exception 'tracking_token_expired';
  end if;

  if v_tok.purpose is distinct from 'project_status_read' then
    raise exception 'tracking_token_invalid';
  end if;

  select * into v_project
  from public.web_atelier_projects p
  where p.id = v_tok.project_id;

  if not found then
    raise exception 'tracking_token_invalid';
  end if;

  update public.web_atelier_project_tracking_tokens t
  set last_used_at = now(),
      use_count = t.use_count + 1
  where t.id = v_tok.id;

  v_copy := public.web_atelier_project_status_public_copy(v_project.status);

  -- Least-privilege public payload. No PII, notes, money, or evidence.
  return jsonb_build_object(
    'project_number', v_project.project_number,
    'title', v_project.title,
    'status', v_project.status,
    'status_label_hr', v_copy ->> 'label',
    'status_description_hr', v_copy ->> 'description',
    'checked_at', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- F RPCs (admin checklist)
-- ---------------------------------------------------------------------------

create function public.admin_create_web_atelier_material_requirement(
  p_project_id uuid,
  p_kind text,
  p_title text,
  p_description text default null,
  p_is_required boolean default true,
  p_deadline date default null,
  p_admin_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.web_atelier_projects%rowtype;
  v_id uuid := gen_random_uuid();
  v_title text;
  v_description text;
  v_notes text;
  v_pos integer;
  v_path text;
begin
  perform public.web_atelier_require_admin();

  if p_project_id is null then
    raise exception 'project_id_required';
  end if;

  if p_kind is null or p_kind not in ('logo', 'text', 'images', 'brand_colors', 'other') then
    raise exception 'material_kind_invalid';
  end if;

  v_title := btrim(coalesce(p_title, ''));
  if char_length(v_title) < 1 or char_length(v_title) > 200 then
    raise exception 'material_title_invalid';
  end if;

  v_description := nullif(btrim(coalesce(p_description, '')), '');
  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'material_description_invalid';
  end if;

  v_notes := nullif(btrim(coalesce(p_admin_notes, '')), '');
  if v_notes is not null and char_length(v_notes) > 4000 then
    raise exception 'material_admin_notes_invalid';
  end if;

  if p_deadline is not null and p_deadline < public.web_atelier_business_date() then
    raise exception 'material_deadline_past';
  end if;

  v_project := public.web_atelier_lock_project(p_project_id);

  select coalesce(max(r.position), 0) + 1 into v_pos
  from public.web_atelier_material_requirements r
  where r.project_id = p_project_id;

  v_path := 'web-atelier-materials/' || p_project_id::text || '/' || v_id::text || '/';

  insert into public.web_atelier_material_requirements (
    id, project_id, kind, title, description, is_required, deadline,
    status, admin_notes, planned_storage_path, position, created_by, updated_by
  ) values (
    v_id, p_project_id, p_kind, v_title, v_description, coalesce(p_is_required, true),
    p_deadline, 'pending', v_notes, v_path, v_pos, auth.uid(), auth.uid()
  );

  return v_id;
end;
$$;

create function public.admin_update_web_atelier_material_requirement(
  p_requirement_id uuid,
  p_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.web_atelier_material_requirements%rowtype;
  v_key text;
  v_title text;
  v_description text;
  v_notes text;
  v_status text;
  v_deadline date;
  v_is_required boolean;
begin
  perform public.web_atelier_require_admin();

  if p_requirement_id is null then
    raise exception 'material_id_required';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'material_patch_invalid';
  end if;

  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in (
      'title', 'description', 'is_required', 'deadline', 'status', 'admin_notes', 'kind'
    ) then
      raise exception 'material_patch_unknown_key';
    end if;
  end loop;

  -- Lock order: project → material_requirement.
  select * into v_row
  from public.web_atelier_material_requirements r
  where r.id = p_requirement_id;

  if not found then
    raise exception 'material_not_found';
  end if;

  perform public.web_atelier_lock_project(v_row.project_id);

  select * into v_row
  from public.web_atelier_material_requirements r
  where r.id = p_requirement_id
  for update;

  if not found then
    raise exception 'material_not_found';
  end if;

  v_title := v_row.title;
  v_description := v_row.description;
  v_notes := v_row.admin_notes;
  v_status := v_row.status;
  v_deadline := v_row.deadline;
  v_is_required := v_row.is_required;

  if p_patch ? 'title' then
    v_title := btrim(coalesce(p_patch ->> 'title', ''));
    if char_length(v_title) < 1 or char_length(v_title) > 200 then
      raise exception 'material_title_invalid';
    end if;
  end if;

  if p_patch ? 'description' then
    if p_patch ->> 'description' is null then
      v_description := null;
    else
      v_description := nullif(btrim(p_patch ->> 'description'), '');
      if v_description is not null and char_length(v_description) > 2000 then
        raise exception 'material_description_invalid';
      end if;
    end if;
  end if;

  if p_patch ? 'admin_notes' then
    if p_patch ->> 'admin_notes' is null then
      v_notes := null;
    else
      v_notes := nullif(btrim(p_patch ->> 'admin_notes'), '');
      if v_notes is not null and char_length(v_notes) > 4000 then
        raise exception 'material_admin_notes_invalid';
      end if;
    end if;
  end if;

  if p_patch ? 'is_required' then
    if jsonb_typeof(p_patch -> 'is_required') <> 'boolean' then
      raise exception 'material_is_required_invalid';
    end if;
    v_is_required := (p_patch ->> 'is_required')::boolean;
  end if;

  if p_patch ? 'deadline' then
    if p_patch ->> 'deadline' is null or p_patch ->> 'deadline' = '' then
      v_deadline := null;
    else
      begin
        v_deadline := (p_patch ->> 'deadline')::date;
      exception when others then
        raise exception 'material_deadline_invalid';
      end;
    end if;
  end if;

  if p_patch ? 'status' then
    v_status := p_patch ->> 'status';
    if v_status not in ('pending', 'received', 'waived', 'cancelled') then
      raise exception 'material_status_invalid';
    end if;
  end if;

  if p_patch ? 'kind' then
    if (p_patch ->> 'kind') not in ('logo', 'text', 'images', 'brand_colors', 'other') then
      raise exception 'material_kind_invalid';
    end if;
  end if;

  update public.web_atelier_material_requirements r
  set title = v_title,
      description = v_description,
      admin_notes = v_notes,
      is_required = v_is_required,
      deadline = v_deadline,
      status = v_status,
      kind = case when p_patch ? 'kind' then p_patch ->> 'kind' else r.kind end,
      updated_by = auth.uid()
  where r.id = p_requirement_id;
end;
$$;

create function public.admin_list_web_atelier_material_requirements(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  perform public.web_atelier_require_admin();

  if p_project_id is null then
    raise exception 'project_id_required';
  end if;

  if not exists (
    select 1 from public.web_atelier_projects p where p.id = p_project_id
  ) then
    raise exception 'project_not_found';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'project_id', r.project_id,
      'kind', r.kind,
      'title', r.title,
      'description', r.description,
      'is_required', r.is_required,
      'deadline', r.deadline,
      'status', r.status,
      'admin_notes', r.admin_notes,
      'planned_storage_path', r.planned_storage_path,
      'position', r.position,
      'created_at', r.created_at,
      'updated_at', r.updated_at
    )
    order by r.position, r.created_at
  ), '[]'::jsonb)
  into v_out
  from public.web_atelier_material_requirements r
  where r.project_id = p_project_id;

  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.admin_create_web_atelier_project_tracking_token(uuid, timestamptz, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_revoke_web_atelier_project_tracking_token(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_web_atelier_project_tracking_tokens(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_web_atelier_project_public_status(text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_create_web_atelier_material_requirement(uuid, text, text, text, boolean, date, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_update_web_atelier_material_requirement(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_web_atelier_material_requirements(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_create_web_atelier_project_tracking_token(uuid, timestamptz, text)
  to authenticated;
grant execute on function public.admin_revoke_web_atelier_project_tracking_token(uuid)
  to authenticated;
grant execute on function public.admin_list_web_atelier_project_tracking_tokens(uuid)
  to authenticated;
grant execute on function public.get_web_atelier_project_public_status(text)
  to anon, authenticated;
grant execute on function public.admin_create_web_atelier_material_requirement(uuid, text, text, text, boolean, date, text)
  to authenticated;
grant execute on function public.admin_update_web_atelier_material_requirement(uuid, jsonb)
  to authenticated;
grant execute on function public.admin_list_web_atelier_material_requirements(uuid)
  to authenticated;

comment on function public.admin_create_web_atelier_project_tracking_token(uuid, timestamptz, text) is
  'Admin creates a project_status_read token. Plaintext returned once; only hash stored. No e-mail.';

comment on function public.get_web_atelier_project_public_status(text) is
  'Public minimal project status by tracking token. No PII, notes, evidence, or financial fields.';

comment on function public.admin_create_web_atelier_material_requirement(uuid, text, text, text, boolean, date, text) is
  'Admin material checklist item. Client upload authorization is not implemented in V1.';
