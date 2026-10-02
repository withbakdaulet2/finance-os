-- Verification for 20261002130000_categories_protect_system.sql.
-- Paste into the Supabase SQL Editor after applying that migration.
-- Always rolled back; ends with an intentional exception.
--
--   Success -> ERROR: ALL CHECKS PASSED (rolled back, nothing was saved)
--   Failure -> ERROR: FAIL: <what went wrong>

do $$
declare
  v_a uuid;
  v_b uuid := gen_random_uuid();
  v_sys uuid;
  v_cust uuid;
  v_n int;
  v_blocked boolean;
begin
  select id into v_a from auth.users order by created_at limit 1;
  if v_a is null then
    raise exception 'FAIL: no user in auth.users. Create one in Authentication -> Users first.';
  end if;
  insert into auth.users (id) values (v_b);

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. Reading ---------------------------------------------------------------
  select count(*) into v_n from categories where is_system;
  if v_n <> 14 then raise exception 'FAIL: user A sees % system categories, expected 14', v_n; end if;

  select id into v_sys from categories where is_system and name = 'Food' and type = 'expense';

  -- 2. Creating custom categories --------------------------------------------
  insert into categories (user_id, name, type) values (v_a, '__custom coffee', 'expense')
    returning id into v_cust;

  v_blocked := false;
  begin insert into categories (user_id, name, type) values (v_a, '__CUSTOM COFFEE', 'expense');
  exception when unique_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: case-insensitive duplicate name was accepted'; end if;

  -- Same name under another type is fine.
  insert into categories (user_id, name, type) values (v_a, '__custom coffee', 'income');

  v_blocked := false;
  begin insert into categories (user_id, name, type) values (v_a, 'food', 'expense');  -- clashes with system "Food"
  exception when unique_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: a custom category duplicating a system one was accepted'; end if;

  v_blocked := false;
  begin insert into categories (user_id, name, type) values (v_a, '   ', 'expense');
  exception when check_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: blank name was accepted'; end if;

  v_blocked := false;
  begin insert into categories (user_id, name, type) values (v_a, repeat('x', 61), 'expense');
  exception when check_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: a 61-character name was accepted'; end if;

  -- 3. Clients cannot forge system rows or touch protected columns ------------
  v_blocked := false;
  begin insert into categories (user_id, name, type, is_system) values (v_a, '__fake system', 'expense', true);
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: client could INSERT is_system'; end if;

  v_blocked := false;
  begin insert into categories (user_id, name, type, parent_id) values (v_a, '__child', 'expense', v_sys);
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: client could INSERT parent_id'; end if;

  -- Own row with a unique name, so this can only fail because of the privilege.
  declare v_typed uuid;
  begin
    insert into categories (user_id, name, type) values (v_a, '__type probe', 'expense')
      returning id into v_typed;
    v_blocked := false;
    begin update categories set type = 'income' where id = v_typed;
    exception when insufficient_privilege then v_blocked := true; end;
    if not v_blocked then raise exception 'FAIL: client could change a category type'; end if;
  end;

  v_blocked := false;
  begin update categories set is_system = true where id = v_cust;
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: client could UPDATE is_system'; end if;

  -- 4. Editing: custom yes, system no -----------------------------------------
  update categories set name = '__custom tea' where id = v_cust;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: renaming a custom category affected % rows', v_n; end if;

  update categories set name = 'Hacked' where id = v_sys;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FAIL: a system category was renamed by a client'; end if;

  delete from categories where id = v_sys;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FAIL: a system category was deleted by a client'; end if;

  if (select name from categories where id = v_sys) <> 'Food' then
    raise exception 'FAIL: system category "Food" was modified';
  end if;

  -- 5. Another user -------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b, 'role', 'authenticated')::text, true);

  select count(*) into v_n from categories where id = v_cust;
  if v_n <> 0 then raise exception 'FAIL: user B can read user A''s custom category'; end if;

  update categories set name = 'hacked' where id = v_cust;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FAIL: user B renamed user A''s category'; end if;

  v_blocked := false;
  begin insert into categories (user_id, name, type) values (v_a, '__as A', 'expense');
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: user B inserted a category as user A'; end if;

  -- B has its own independent set of names (unique per user, not global).
  insert into categories (user_id, name, type) values (v_b, '__custom tea', 'expense');

  -- 6. Deleting a custom category keeps its transactions (category set to null) --
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  declare v_acc uuid; v_tx uuid; v_cat uuid;
  begin
    v_acc := create_account('__cat acc', 'cash', 0);
    insert into transactions (user_id, type, amount, account_id, category_id)
      values (v_a, 'expense', 3, v_acc, v_cust) returning id into v_tx;

    delete from categories where id = v_cust;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'FAIL: deleting a custom category affected % rows', v_n; end if;

    select category_id into v_cat from transactions where id = v_tx;
    if v_cat is not null then raise exception 'FAIL: transaction kept a dangling category_id'; end if;
  end;

  reset role;
  raise exception 'ALL CHECKS PASSED (rolled back, nothing was saved)';
end;
$$;
