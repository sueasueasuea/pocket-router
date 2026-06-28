-- =====================================================================
-- Patch for the invite migration on an already-initialised database.
--
-- Run this once in the Supabase SQL editor after the original
-- migration failed with:
--   "permission denied for table invites" (SQLSTATE 42501)
--
-- Two cases hit this error:
--   1) The owner visiting /settings/sharing → needs `authenticated`
--      role to have table privileges.
--   2) A friend opening the invite link BEFORE signing up → needs
--      `anon` role to have SELECT on `invites` (so the landing page
--      can render before the friend has logged in).
--
-- This file adds the GRANTs and extends the RLS policy so anonymous
-- users can read non-revoked invites by token. Safe to re-run.
-- =====================================================================

grant usage on schema public to authenticated, anon;

grant select, insert, update on public.profiles     to authenticated;
grant select                          on public.invites      to authenticated, anon;
grant insert, update                  on public.invites      to authenticated;
grant select, insert, update, delete on public.share_access to authenticated;

-- Replace the existing "invites_select_by_token" policy so it covers
-- the `anon` role too — this is what unlocks the landing page for
-- non-logged-in visitors.
drop policy if exists "invites_select_by_token" on public.invites;
create policy "invites_select_by_token"
  on public.invites for select
  to authenticated, anon
  using (revoked = false);