-- =====================================================================
-- Fix: Grant table-level privileges and add RLS policies for the
-- `transactions` table.
--
-- The table was created without GRANTs to `authenticated`, so every
-- PostgREST query returns "permission denied for table transactions".
-- This migration mirrors the pattern used for banks/pockets/allocations.
-- Idempotent: safe to re-run.
-- =====================================================================

-- 1) Table-level privileges (required by PostgREST before RLS is even checked)
grant select, insert, update, delete on public.transactions to authenticated;

-- 2) Enable RLS (no-op if already enabled)
alter table public.transactions enable row level security;

-- 3) Policies — owner sees own rows; shared users with 'view' can SELECT,
--    shared users with 'edit' can do everything.
drop policy if exists "transactions_select_own_or_shared" on public.transactions;
create policy "transactions_select_own_or_shared"
  on public.transactions for select
  to authenticated
  using (user_id = auth.uid() or public.has_share_with(user_id, 'view'));

drop policy if exists "transactions_write_own_or_shared_edit" on public.transactions;
create policy "transactions_write_own_or_shared_edit"
  on public.transactions for all
  to authenticated
  using (user_id = auth.uid() or public.has_share_with(user_id, 'edit'))
  with check (user_id = auth.uid() or public.has_share_with(user_id, 'edit'));
