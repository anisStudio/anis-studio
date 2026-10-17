-- F2.6 security hardening — close anon/authenticated bypass of public booking RPC.
-- Additive after 20261017130000. Do NOT auto-apply to production from the app.
-- Public booking must go through Edge Function `book-consultation-slot`
-- which verifies Cloudflare Turnstile server-side, then calls this RPC with
-- service_role only. Capacity / closure / idempotency checks remain inside the RPC.

do $preflight$
begin
  if to_regprocedure(
    'public.public_book_consultation_slot(text,uuid,text,text,text,text,uuid,text,text,uuid)'
  ) is null then
    raise exception 'F2.6 hardening: public_book_consultation_slot missing (apply 20261017130000 first)';
  end if;
end
$preflight$;

-- Narrow grants: revoke browser roles; allow only service_role (Edge).
revoke all on function public.public_book_consultation_slot(
  text, uuid, text, text, text, text, uuid, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.public_book_consultation_slot(
  text, uuid, text, text, text, text, uuid, text, text, uuid
) to service_role;

comment on function public.public_book_consultation_slot(
  text, uuid, text, text, text, text, uuid, text, text, uuid
) is
  'F2.6 atomic booking. EXECUTE: service_role only (Edge Turnstile gateway). Not callable by anon/authenticated.';

-- Availability listing stays public (slots only, no PII / closure reasons).
-- Reaffirm grants explicitly after hardening.
revoke all on function public.public_list_consultation_availability(text, timestamptz, timestamptz)
  from public;
grant execute on function public.public_list_consultation_availability(text, timestamptz, timestamptz)
  to anon, authenticated, service_role;
