-- Runs on `supabase db reset` (local development). Idempotent.
-- Production seeding is handled by migration 20261001000100_seed_categories.sql
-- (backfill + signup trigger), so this file is not needed there.
select seed_default_categories(id) from auth.users;
