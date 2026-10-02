-- Default categories. categories.user_id is NOT NULL, so "system" categories are
-- per-user rows with is_system = true. They are created:
--   * automatically for every new auth user (trigger on auth.users), and
--   * once now for users that already exist (backfill at the bottom).
-- Seeding is idempotent.

create unique index categories_system_unique
  on categories (user_id, type, name)
  where is_system;

create or replace function seed_default_categories(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into categories (user_id, name, type, is_system)
  select p_user_id, v.name, v.type, true
  from (values
    ('Salary',          'income'),
    ('Business Income', 'income'),
    ('Other Income',    'income'),
    ('Food',            'expense'),
    ('Outside Food',    'expense'),
    ('Business',        'expense'),
    ('Education',       'expense'),
    ('Charity',         'expense'),
    ('Transport',       'expense'),
    ('Other',           'expense'),
    ('Investment',      'capital'),
    ('Emergency Fund',  'capital'),
    ('Umrah Fund',      'capital'),
    ('Business Fund',   'capital')
  ) as v(name, type)
  on conflict (user_id, type, name) where is_system do nothing;
$$;

-- Security definer + callable by anyone would let any user seed any user id
-- through the API (rpc). Only the signup trigger and the owner may run it.
revoke all on function seed_default_categories(uuid) from public, anon, authenticated;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform seed_default_categories(new.id);
  return new;
end;
$$;

create trigger trg_seed_categories_on_signup
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill users that existed before this migration (e.g. the manually created one).
select seed_default_categories(id) from auth.users;
