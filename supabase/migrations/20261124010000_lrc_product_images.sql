-- New LRC product photos uploaded from the admin.
-- The three approved boxes stay on /lrc_image/proizvodi/slike/ and are not copied here.
-- Public bucket so product pages can use getPublicUrl. Listing and writes require is_admin().
-- Do not apply this migration to production from this branch.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lrc-product-images',
  'lrc-product-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lrc_product_images_admin_select" on storage.objects;
drop policy if exists "lrc_product_images_admin_insert" on storage.objects;
drop policy if exists "lrc_product_images_admin_update" on storage.objects;
drop policy if exists "lrc_product_images_admin_delete" on storage.objects;

create policy "lrc_product_images_admin_select"
on storage.objects
for select
to authenticated
using (bucket_id = 'lrc-product-images' and (select public.is_admin()) is true);

create policy "lrc_product_images_admin_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'lrc-product-images' and (select public.is_admin()) is true);

create policy "lrc_product_images_admin_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'lrc-product-images' and (select public.is_admin()) is true)
with check (bucket_id = 'lrc-product-images' and (select public.is_admin()) is true);

create policy "lrc_product_images_admin_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'lrc-product-images' and (select public.is_admin()) is true);
