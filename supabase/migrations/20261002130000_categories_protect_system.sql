-- Categories: system categories are read-only for clients, and clients can only
-- create/rename custom ones.
--
-- The single "owner_only ... for all" policy would let any client rename or delete
-- the seeded system categories straight through the API, whatever the UI hides.
-- Replace it with per-command policies. Foreign-key cascades (deleting a user) and
-- seed_default_categories() are not affected: they run with owner rights.

drop policy "owner_only" on categories;

create policy "categories_select" on categories
  for select using (user_id = auth.uid());

create policy "categories_insert" on categories
  for insert with check (user_id = auth.uid() and not is_system);

create policy "categories_update" on categories
  for update
  using (user_id = auth.uid() and not is_system)
  with check (user_id = auth.uid() and not is_system);

create policy "categories_delete" on categories
  for delete using (user_id = auth.uid() and not is_system);

-- Column privileges (RLS cannot restrict columns):
--  * insert: user_id, name, type only. is_system and parent_id are not client-writable
--    (V1 has no category hierarchy UI).
--  * update: name only. The type is fixed once created, so an expense category can
--    never turn into an income one under existing transactions.
revoke insert, update on categories from anon, authenticated;
grant insert (user_id, name, type) on categories to authenticated;
grant update (name) on categories to authenticated;

-- Sanity limits (the UI enforces the same ones) and no duplicate names per type,
-- case-insensitively ("Food" and "food" would be indistinguishable in a picker).
alter table categories
  add constraint categories_name_valid
  check (btrim(name) <> '' and char_length(name) <= 60);

create unique index categories_name_unique
  on categories (user_id, type, lower(name));
