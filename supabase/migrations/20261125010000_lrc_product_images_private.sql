-- New LRC photos stay in a private bucket.
-- The earlier migration created lrc-product-images as a public bucket. This one closes it.
-- Anonymous visitors do not receive a storage URL. The stable direct link is the
-- lrc-product-image function, which calls lrc_product_image_is_public on every request.
-- Signed URLs are intentionally unused: they would keep working after the product is hidden.
-- Admin storage policies from the earlier migration still allow preview and edits.
-- The three approved boxes stay on /lrc_image/proizvodi/slike/. This file does not change them.
-- Do not apply this migration to production from this branch.

do $private$
begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets
    set public = false
    where id = 'lrc-product-images';
  end if;
end
$private$;

create or replace function public.lrc_photo_object_name(src text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  cleaned text;
  marker text;
  marker_at int;
  object_name text;
begin
  if src is null or src = '' then
    return null;
  end if;
  cleaned := split_part(src, '?', 1);
  marker := '/lrc-product-images/';
  marker_at := position(marker in cleaned);
  if marker_at = 0 then
    marker := '/lrc-product-image/';
    marker_at := position(marker in cleaned);
  end if;
  if marker_at = 0 then
    return null;
  end if;
  object_name := substring(cleaned from marker_at + char_length(marker));
  if object_name = '' or object_name like '%..%' or left(object_name, 1) = '/' then
    return null;
  end if;
  return object_name;
end;
$$;

create or replace function public.lrc_product_image_is_public(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lrc_products as product
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(product.content -> 'photos') = 'array' then product.content -> 'photos'
        else '[]'::jsonb
      end
    ) as photo
    where product.is_visible is true
      and public.lrc_photo_object_name(photo ->> 'src') = object_name
  );
$$;

create or replace function public.lrc_product_image_is_allowed(object_name text, user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      user_id is not null
      and exists (
        select 1
        from public.admin_users
        where admin_users.user_id = lrc_product_image_is_allowed.user_id
      )
    )
    or public.lrc_product_image_is_public(object_name);
$$;

revoke all on function public.lrc_photo_object_name(text) from public;
revoke all on function public.lrc_photo_object_name(text) from anon;
revoke all on function public.lrc_photo_object_name(text) from authenticated;
revoke all on function public.lrc_product_image_is_public(text) from public;
revoke all on function public.lrc_product_image_is_public(text) from anon;
revoke all on function public.lrc_product_image_is_public(text) from authenticated;
revoke all on function public.lrc_product_image_is_allowed(text, uuid) from public;
revoke all on function public.lrc_product_image_is_allowed(text, uuid) from anon;
revoke all on function public.lrc_product_image_is_allowed(text, uuid) from authenticated;
grant execute on function public.lrc_product_image_is_public(text) to service_role;
grant execute on function public.lrc_product_image_is_allowed(text, uuid) to service_role;
