-- =====================================================================
-- Money Tagging — Restrict invite links to 1-to-1 sharing
-- Idempotent: safe to re-run.
-- =====================================================================

-- 1) Clean up any duplicate accepted shares (keep only the oldest acceptance per invite_id)
delete from public.share_access
where id not in (
  select distinct on (invite_id) id
  from public.share_access
  order by invite_id, accepted_at asc
);

-- 2) Drop the existing composite unique constraint if it exists
alter table public.share_access
  drop constraint if exists share_access_invite_id_accepted_by_key;

-- 3) Add new unique constraint on invite_id to enforce 1-to-1 sharing
alter table public.share_access
  add constraint share_access_invite_id_key unique (invite_id);
