-- ============================================================
-- ListingLab — Supabase schema (Phase 1)
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ============================================================
-- profiles
-- One row per auth user. Created automatically on signup via
-- the handle_new_user trigger below.
-- ============================================================
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  plan              text not null default 'free'
                      check (plan in ('free', 'starter', 'pro', 'business')),
  credits_remaining int  not null default 3,
  created_at        timestamptz not null default now()
);

-- ============================================================
-- listings
-- ============================================================
create table if not exists public.listings (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  product_name       text,
  original_image_url text,
  status             text not null default 'pending'
                       check (status in ('pending', 'processing', 'complete', 'error')),
  created_at         timestamptz not null default now()
);
create index if not exists listings_user_id_idx on public.listings (user_id);

-- ============================================================
-- listing_images
-- ============================================================
create table if not exists public.listing_images (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  type       text not null
               check (type in ('white_bg', 'lifestyle_1', 'lifestyle_2', 'lifestyle_3', 'lifestyle_4')),
  image_url  text,
  created_at timestamptz not null default now()
);
create index if not exists listing_images_listing_id_idx on public.listing_images (listing_id);

-- ============================================================
-- listing_copy
-- ============================================================
create table if not exists public.listing_copy (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings (id) on delete cascade,
  title        text,
  bullet_1     text,
  bullet_2     text,
  bullet_3     text,
  bullet_4     text,
  bullet_5     text,
  description  text,
  search_terms text,
  created_at   timestamptz not null default now()
);
create index if not exists listing_copy_listing_id_idx on public.listing_copy (listing_id);

-- ============================================================
-- Trigger: create a free profile (3 credits) on new auth user
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, plan, credits_remaining)
  values (new.id, 'free', 3)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.listings       enable row level security;
alter table public.listing_images enable row level security;
alter table public.listing_copy   enable row level security;

-- profiles: a user can read/update only their own row
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- listings: owner-only access
drop policy if exists "listings_select_own" on public.listings;
create policy "listings_select_own" on public.listings
  for select using (auth.uid() = user_id);

drop policy if exists "listings_insert_own" on public.listings;
create policy "listings_insert_own" on public.listings
  for insert with check (auth.uid() = user_id);

drop policy if exists "listings_update_own" on public.listings;
create policy "listings_update_own" on public.listings
  for update using (auth.uid() = user_id);

drop policy if exists "listings_delete_own" on public.listings;
create policy "listings_delete_own" on public.listings
  for delete using (auth.uid() = user_id);

-- listing_images: access if the parent listing belongs to the user
drop policy if exists "listing_images_select_own" on public.listing_images;
create policy "listing_images_select_own" on public.listing_images
  for select using (
    exists (
      select 1 from public.listings l
      where l.id = listing_images.listing_id and l.user_id = auth.uid()
    )
  );

drop policy if exists "listing_images_modify_own" on public.listing_images;
create policy "listing_images_modify_own" on public.listing_images
  for all using (
    exists (
      select 1 from public.listings l
      where l.id = listing_images.listing_id and l.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_images.listing_id and l.user_id = auth.uid()
    )
  );

-- listing_copy: access if the parent listing belongs to the user
drop policy if exists "listing_copy_select_own" on public.listing_copy;
create policy "listing_copy_select_own" on public.listing_copy
  for select using (
    exists (
      select 1 from public.listings l
      where l.id = listing_copy.listing_id and l.user_id = auth.uid()
    )
  );

drop policy if exists "listing_copy_modify_own" on public.listing_copy;
create policy "listing_copy_modify_own" on public.listing_copy
  for all using (
    exists (
      select 1 from public.listings l
      where l.id = listing_copy.listing_id and l.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_copy.listing_id and l.user_id = auth.uid()
    )
  );

-- ============================================================
-- NOTE: The generation pipeline / webhooks write to these tables
-- using the SERVICE ROLE key, which bypasses RLS. The policies
-- above protect normal client-side reads/writes.
-- ============================================================
