-- ============================================================
-- MIGRATION — credit security fix (2026-07-02)
-- Run this ONCE in the Supabase SQL Editor of your LIVE project.
-- (schema.sql has also been updated for fresh installs.)
--
-- Fixes: any logged-in user could update their own `plan` and
-- `credits_remaining` directly via the client API, and the
-- read-then-write credit deduction had a race condition.
-- ============================================================

-- 1. Remove the unsafe policy (allowed unrestricted self-updates).
drop policy if exists "profiles_update_own" on public.profiles;

-- 2. Atomic credit consumption. Runs as the calling user (auth.uid()),
--    deducts exactly 1 credit only if one is available. Returns the new
--    balance, or NULL when out of credits.
create or replace function public.consume_credit()
returns integer
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set credits_remaining = credits_remaining - 1
   where id = auth.uid()
     and credits_remaining > 0
  returning credits_remaining;
$$;

revoke all on function public.consume_credit() from public;
revoke execute on function public.consume_credit() from anon;
grant execute on function public.consume_credit() to authenticated;

-- The signup trigger function should not be callable via the REST API.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- 3. Credit refund — SERVER ONLY (service role). Users must never be
--    able to call this, or they could mint free credits.
create or replace function public.refund_credit(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set credits_remaining = credits_remaining + 1
   where id = p_user_id
  returning credits_remaining;
$$;

revoke all on function public.refund_credit(uuid) from public;
revoke execute on function public.refund_credit(uuid) from anon, authenticated;
grant execute on function public.refund_credit(uuid) to service_role;
