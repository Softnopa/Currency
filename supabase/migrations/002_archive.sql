-- Run once in Supabase → SQL Editor if you already ran schema.sql before archiving existed.
alter table public.trucks add column if not exists archived_at timestamptz;
-- Make PostgREST see the new column immediately.
notify pgrst, 'reload schema';
