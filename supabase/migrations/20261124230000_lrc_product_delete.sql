-- Permanent delete of an LRC catalog row.
-- Earlier inquiries keep the product text already stored on lrc_inquiries.
-- There is no foreign key from inquiries to this table.
-- Do not apply this migration to production from this branch.

begin;

grant delete on public.lrc_products to authenticated;

drop policy if exists "Admins delete LRC products" on public.lrc_products;
create policy "Admins delete LRC products"
on public.lrc_products
for delete
to authenticated
using ((select public.is_admin()) is true);

commit;
