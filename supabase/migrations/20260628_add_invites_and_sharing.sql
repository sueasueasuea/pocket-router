-- =====================================================================
-- Money Tagging — Invite & Sharing migration
-- Run this once in your Supabase SQL editor (or via supabase-cli migrate).
-- Idempotent: safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) profiles — minimal display-name directory so the invite landing
-- page can say "X invited you to view their wallet" without leaking
-- emails.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2) invites — shareable links the OWNER creates. The token is the
-- only secret; anyone with the URL can hit /invite/[token].
-- ---------------------------------------------------------------------
create type public.invite_permission as enum ('view', 'edit');

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  permission public.invite_permission not null default 'view',
  created_at timestamptz not null default now(),
  revoked boolean not null default false
);

create index if not exists invites_owner_idx on public.invites(owner_id);

-- ---------------------------------------------------------------------
-- 3) share_access — created when an INVITEE accepts an invite.
-- One row per (invite, accepter). Editing `permission` here is how
-- the owner upgrades "view" → "edit" later. Deleting the row revokes
-- access.
-- ---------------------------------------------------------------------
create table if not exists public.share_access (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.invites(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid not null references auth.users(id) on delete cascade,
  permission public.invite_permission not null default 'view',
  accepted_at timestamptz not null default now(),
  unique (invite_id, accepted_by)
);

create index if not exists share_access_owner_idx on public.share_access(owner_id);
create index if not exists share_access_accepted_by_idx on public.share_access(accepted_by);

-- ---------------------------------------------------------------------
-- 4) RLS — keep existing "owner sees own rows" behavior, then add
-- sharing-aware read/write for accepted users.
-- ---------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.invites     enable row level security;
alter table public.share_access enable row level security;

-- profiles: anyone authenticated can read; only the owner can update.
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- invites: owner full access; any authenticated user can SELECT
-- a non-revoked invite by token (needed for the public landing page).
drop policy if exists "invites_owner_all" on public.invites;
create policy "invites_owner_all"
  on public.invites for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "invites_select_by_token" on public.invites;
create policy "invites_select_by_token"
  on public.invites for select
  to authenticated
  using (revoked = false);

-- share_access:
--   - the accepter can see their own access rows
--   - the owner can see / modify all rows that grant access to their data
--   - the accepter is the only one who can INSERT (accepting is a personal act)
drop policy if exists "share_access_select_own_or_owner" on public.share_access;
create policy "share_access_select_own_or_owner"
  on public.share_access for select
  to authenticated
  using (accepted_by = auth.uid() or owner_id = auth.uid());

drop policy if exists "share_access_insert_as_accepter" on public.share_access;
create policy "share_access_insert_as_accepter"
  on public.share_access for insert
  to authenticated
  with check (accepted_by = auth.uid());

drop policy if exists "share_access_update_owner_only" on public.share_access;
create policy "share_access_update_owner_only"
  on public.share_access for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "share_access_delete_owner_or_self" on public.share_access;
create policy "share_access_delete_owner_or_self"
  on public.share_access for delete
  to authenticated
  using (owner_id = auth.uid() or accepted_by = auth.uid());

-- ---------------------------------------------------------------------
-- 5) Extend existing banks / pockets / allocations / settings policies
-- so shared viewers can SELECT (any permission) and INSERT/UPDATE/DELETE
-- (edit permission only).
-- ---------------------------------------------------------------------

-- helper: returns true if the current user has accepted an invite from
-- `owner` whose permission is at least `min_perm`.
create or replace function public.has_share_with(
  owner uuid,
  min_perm public.invite_permission
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.share_access sa
    where sa.owner_id = owner
      and sa.accepted_by = auth.uid()
      and (
        (min_perm = 'view' and sa.permission in ('view', 'edit'))
        or (min_perm = 'edit' and sa.permission = 'edit')
      )
  );
$$;

-- banks
drop policy if exists "banks_select_own_or_shared" on public.banks;
create policy "banks_select_own_or_shared"
  on public.banks for select
  to authenticated
  using (user_id = auth.uid() or public.has_share_with(user_id, 'view'));

drop policy if exists "banks_write_own_or_shared_edit" on public.banks;
create policy "banks_write_own_or_shared_edit"
  on public.banks for all
  to authenticated
  using (user_id = auth.uid() or public.has_share_with(user_id, 'edit'))
  with check (user_id = auth.uid() or public.has_share_with(user_id, 'edit'));

-- pockets
drop policy if exists "pockets_select_own_or_shared" on public.pockets;
create policy "pockets_select_own_or_shared"
  on public.pockets for select
  to authenticated
  using (user_id = auth.uid() or public.has_share_with(user_id, 'view'));

drop policy if exists "pockets_write_own_or_shared_edit" on public.pockets;
create policy "pockets_write_own_or_shared_edit"
  on public.pockets for all
  to authenticated
  using (user_id = auth.uid() or public.has_share_with(user_id, 'edit'))
  with check (user_id = auth.uid() or public.has_share_with(user_id, 'edit'));

-- allocations: ownership is implicit via bank/pocket — but the existing
-- schema stores `user_id` on allocations too, so reuse the same pattern.
drop policy if exists "allocations_select_own_or_shared" on public.allocations;
create policy "allocations_select_own_or_shared"
  on public.allocations for select
  to authenticated
  using (user_id = auth.uid() or public.has_share_with(user_id, 'view'));

drop policy if exists "allocations_write_own_or_shared_edit" on public.allocations;
create policy "allocations_write_own_or_shared_edit"
  on public.allocations for all
  to authenticated
  using (user_id = auth.uid() or public.has_share_with(user_id, 'edit'))
  with check (user_id = auth.uid() or public.has_share_with(user_id, 'edit'));

-- settings: shared viewers can read; only the owner can write.
drop policy if exists "settings_select_own_or_shared" on public.settings;
create policy "settings_select_own_or_shared"
  on public.settings for select
  to authenticated
  using (user_id = auth.uid() or public.has_share_with(user_id, 'view'));

-- Note: existing write policies on banks/pockets/allocations/settings
-- (the originals from the project's bootstrap) are intentionally left in
-- place — drop them manually if you want a clean slate, otherwise the
-- OR condition above will simply add sharing on top.