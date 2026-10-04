-- F2.4.15E — Narrow public Interijeri inquiry creation.
--
-- The public forms must not INSERT ... RETURNING / .select('*') on projects
-- or project_files. Anonymous SELECT stays closed.
--
-- create_public_inquiry_project inserts one inquiry and returns the new
-- project id plus a short-lived upload token. create_public_project_file
-- accepts that token, not an arbitrary project_id, and returns only the new
-- metadata id.
--
-- Does not change Storage policies, bucket settings, or admin RLS.
-- Direct anon INSERT policies are left in place for a later hardening step.

-- ---------------------------------------------------------------------------
-- Upload grants. Not readable through the Data API.
-- ---------------------------------------------------------------------------

create table public.project_upload_grants (
  token uuid primary key default pg_catalog.gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.now()
);

comment on table public.project_upload_grants is
  'Bearer token returned once when a public inquiry is created. Required to attach project_files metadata. Not a general project read capability.';

alter table public.project_upload_grants enable row level security;

revoke all on table public.project_upload_grants from public;
revoke all on table public.project_upload_grants from anon;
revoke all on table public.project_upload_grants from authenticated;
revoke all on table public.project_upload_grants from service_role;

-- ---------------------------------------------------------------------------
-- Schema shape this migration writes. Fail before the functions exist if a
-- column the functions depend on has disappeared.
-- ---------------------------------------------------------------------------

do $preflight$
declare
  missing text;
begin
  select string_agg(expected.column_name, ', ' order by expected.column_name)
    into missing
  from (
    values
      ('projects', 'id'),
      ('projects', 'title'),
      ('projects', 'user_type'),
      ('projects', 'client_id'),
      ('projects', 'carpenter_id'),
      ('projects', 'drawn_by'),
      ('projects', 'uses_corpus'),
      ('projects', 'wants_vr'),
      ('projects', 'vr_location_preference'),
      ('projects', 'vr_package_preference'),
      ('projects', 'status'),
      ('projects', 'space_type'),
      ('projects', 'area_m2'),
      ('projects', 'budget'),
      ('projects', 'notes'),
      ('projects', 'review_request_sent_at'),
      ('project_files', 'id'),
      ('project_files', 'project_id'),
      ('project_files', 'file_type'),
      ('project_files', 'storage_bucket'),
      ('project_files', 'storage_path'),
      ('project_files', 'original_name'),
      ('project_files', 'mime_type'),
      ('project_files', 'size_bytes'),
      ('project_files', 'notes')
  ) as expected(table_name, column_name)
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = expected.table_name
      and c.column_name = expected.column_name
  );

  if missing is not null then
    raise exception
      'F2.4.15E: public inquiry RPCs require missing columns: %',
      missing;
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- Public inquiry project. Status is always inquiry. Caller cannot set it.
-- ---------------------------------------------------------------------------

create function public.create_public_inquiry_project(
  p_title text,
  p_user_type text,
  p_client_id uuid,
  p_carpenter_id uuid,
  p_uses_corpus boolean,
  p_wants_vr boolean,
  p_vr_location_preference text,
  p_vr_package_preference text,
  p_space_type text,
  p_area_m2 numeric,
  p_budget numeric,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_notes text := p_notes;
  v_space_type text := nullif(btrim(coalesce(p_space_type, '')), '');
  v_project_id uuid;
  v_token uuid;
begin
  if v_title is null or char_length(v_title) > 1000 then
    raise exception 'create_public_inquiry_project: naslov mora imati 1 do 1000 znakova';
  end if;

  if v_notes is not null and char_length(v_notes) >= 10000 then
    raise exception 'create_public_inquiry_project: bilješke smiju imati najviše 9999 znakova';
  end if;

  if p_user_type is distinct from 'client' and p_user_type is distinct from 'carpenter' then
    raise exception 'create_public_inquiry_project: user_type mora biti client ili carpenter';
  end if;

  if p_user_type = 'client' and (p_client_id is null or p_carpenter_id is not null) then
    raise exception 'create_public_inquiry_project: klijentski upit mora imati samo client_id';
  end if;

  if p_user_type = 'carpenter' and (p_carpenter_id is null or p_client_id is not null) then
    raise exception 'create_public_inquiry_project: stolarski upit mora imati samo carpenter_id';
  end if;

  if p_uses_corpus is null or p_wants_vr is null then
    raise exception 'create_public_inquiry_project: uses_corpus i wants_vr su obavezni';
  end if;

  if p_vr_location_preference is not null
    and p_vr_location_preference not in ('studio', 'client_home', 'unsure')
  then
    raise exception 'create_public_inquiry_project: neispravna vr_location_preference';
  end if;

  if p_vr_package_preference is not null
    and p_vr_package_preference not in ('3d_vr', '3d_vr_online', 'unsure')
  then
    raise exception 'create_public_inquiry_project: neispravna vr_package_preference';
  end if;

  if v_space_type is not null and char_length(v_space_type) > 200 then
    raise exception 'create_public_inquiry_project: space_type je predugačak';
  end if;

  if p_area_m2 is not null and (p_area_m2 < 0 or p_area_m2 > 1000000) then
    raise exception 'create_public_inquiry_project: neispravna površina';
  end if;

  if p_budget is not null and (p_budget < 0 or p_budget > 1000000000) then
    raise exception 'create_public_inquiry_project: neispravan budžet';
  end if;

  insert into public.projects (
    title,
    user_type,
    client_id,
    carpenter_id,
    drawn_by,
    uses_corpus,
    wants_vr,
    vr_location_preference,
    vr_package_preference,
    status,
    space_type,
    area_m2,
    budget,
    notes,
    review_request_sent_at
  )
  values (
    v_title,
    p_user_type,
    p_client_id,
    p_carpenter_id,
    'ani',
    p_uses_corpus,
    p_wants_vr,
    p_vr_location_preference,
    p_vr_package_preference,
    'inquiry',
    v_space_type,
    p_area_m2,
    p_budget,
    v_notes,
    null
  )
  returning id into v_project_id;

  insert into public.project_upload_grants (project_id, expires_at)
  values (v_project_id, pg_catalog.now() + interval '2 hours')
  returning token into v_token;

  return pg_catalog.jsonb_build_object(
    'project_id', v_project_id,
    'upload_token', v_token
  );
end;
$$;

comment on function public.create_public_inquiry_project(
  text, text, uuid, uuid, boolean, boolean, text, text, text, numeric, numeric, text
) is
  'Creates one public Interijeri inquiry (status inquiry) and a 2-hour upload token. Returns those two ids only.';

-- ---------------------------------------------------------------------------
-- Metadata for a file already uploaded under that inquiry's token.
-- project_id is taken from the grant, never from the caller.
-- ---------------------------------------------------------------------------

create function public.create_public_project_file(
  p_upload_token uuid,
  p_file_type text,
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_prefix text;
  v_name text := p_original_name;
  v_mime text := nullif(btrim(coalesce(p_mime_type, '')), '');
  v_file_id uuid;
begin
  if p_upload_token is null then
    raise exception 'create_public_project_file: nedostaje upload token';
  end if;

  select g.project_id
    into v_project_id
  from public.project_upload_grants g
  join public.projects p on p.id = g.project_id
  where g.token = p_upload_token
    and g.expires_at > pg_catalog.now()
    and p.status = 'inquiry';

  if v_project_id is null then
    raise exception 'create_public_project_file: upload token nije važeći za ovaj upit';
  end if;

  if p_file_type is null
    or p_file_type not in (
      'plan',
      'inspiration',
      'space_photo',
      'kitchen_sketch',
      'carpenter_3d_export',
      'vr_asset',
      'other'
    )
  then
    raise exception 'create_public_project_file: neispravan tip datoteke';
  end if;

  v_prefix := v_project_id::text || '/';

  if p_storage_path is null
    or char_length(p_storage_path) > 1024
    or position('..' in p_storage_path) > 0
    or position(chr(92) in p_storage_path) > 0
    or left(p_storage_path, char_length(v_prefix)) is distinct from v_prefix
    or char_length(p_storage_path) <= char_length(v_prefix)
  then
    raise exception 'create_public_project_file: neispravna putanja datoteke';
  end if;

  if v_name is null
    or length(btrim(v_name)) = 0
    or length(v_name) >= 500
  then
    raise exception 'create_public_project_file: naziv datoteke mora imati 1 do 499 znakova';
  end if;

  if v_mime is not null and char_length(v_mime) > 200 then
    raise exception 'create_public_project_file: MIME tip je predugačak';
  end if;

  if p_size_bytes is not null and (p_size_bytes < 0 or p_size_bytes > 20971520) then
    raise exception 'create_public_project_file: neispravna veličina datoteke';
  end if;

  if p_notes is not null and char_length(p_notes) >= 10000 then
    raise exception 'create_public_project_file: bilješke datoteke su predugačke';
  end if;

  insert into public.project_files (
    project_id,
    file_type,
    storage_bucket,
    storage_path,
    original_name,
    mime_type,
    size_bytes,
    notes
  )
  values (
    v_project_id,
    p_file_type,
    'project-files',
    p_storage_path,
    v_name,
    v_mime,
    p_size_bytes,
    p_notes
  )
  returning id into v_file_id;

  return v_file_id;
end;
$$;

comment on function public.create_public_project_file(uuid, text, text, text, text, bigint, text) is
  'Attaches one project-files metadata row to the inquiry identified by a live upload token. Returns the new file id only.';

revoke all on function public.create_public_inquiry_project(
  text, text, uuid, uuid, boolean, boolean, text, text, text, numeric, numeric, text
) from public;
revoke all on function public.create_public_inquiry_project(
  text, text, uuid, uuid, boolean, boolean, text, text, text, numeric, numeric, text
) from anon;
revoke all on function public.create_public_inquiry_project(
  text, text, uuid, uuid, boolean, boolean, text, text, text, numeric, numeric, text
) from authenticated;
revoke all on function public.create_public_inquiry_project(
  text, text, uuid, uuid, boolean, boolean, text, text, text, numeric, numeric, text
) from service_role;

grant execute on function public.create_public_inquiry_project(
  text, text, uuid, uuid, boolean, boolean, text, text, text, numeric, numeric, text
) to anon, authenticated;

revoke all on function public.create_public_project_file(uuid, text, text, text, text, bigint, text) from public;
revoke all on function public.create_public_project_file(uuid, text, text, text, text, bigint, text) from anon;
revoke all on function public.create_public_project_file(uuid, text, text, text, text, bigint, text) from authenticated;
revoke all on function public.create_public_project_file(uuid, text, text, text, text, bigint, text) from service_role;

grant execute on function public.create_public_project_file(uuid, text, text, text, text, bigint, text)
  to anon, authenticated;
