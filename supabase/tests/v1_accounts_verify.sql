-- Step 4 verification. Paste into the Supabase SQL Editor AFTER applying
-- 20261002000000_lock_balance_create_account.sql.
-- Same convention as v1_schema_verify.sql: always rolled back, ends with an
-- intentional exception.
--
--   Success -> ERROR: ALL CHECKS PASSED (rolled back, nothing was saved)
--   Failure -> ERROR: FAIL: <what went wrong>

do $$
declare
  v_a uuid;
  v_b uuid := gen_random_uuid();
  v_id uuid;
  v_id0 uuid;
  v_bal numeric;
  v_n int;
  v_date date;
  v_blocked boolean;
begin
  select id into v_a from auth.users order by created_at limit 1;
  if v_a is null then
    raise exception 'FAIL: no user in auth.users. Create one in Authentication -> Users first.';
  end if;
  insert into auth.users (id) values (v_b);

  -- Who may call create_account (checked before impersonating anyone).
  if has_function_privilege('anon', 'create_account(text,text,numeric)', 'execute') then
    raise exception 'FAIL: anon can execute create_account';
  end if;
  if not has_function_privilege('authenticated', 'create_account(text,text,numeric)', 'execute') then
    raise exception 'FAIL: authenticated cannot execute create_account';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. Opening balance becomes an income transaction -------------------------
  v_id := create_account('  __test cash  ', 'cash', 1500.50);

  select current_balance into v_bal from accounts where id = v_id;
  if v_bal <> 1500.50 then raise exception 'FAIL: opening balance is %, expected 1500.50', v_bal; end if;

  if (select name from accounts where id = v_id) <> '__test cash' then
    raise exception 'FAIL: account name was not trimmed';
  end if;

  select count(*), max(occurred_on) into v_n, v_date
    from transactions
    where account_id = v_id and type = 'income' and note = 'Opening balance' and amount = 1500.50;
  if v_n <> 1 then raise exception 'FAIL: expected exactly 1 opening income transaction, got %', v_n; end if;
  if v_date <> (now() at time zone 'Asia/Almaty')::date then
    raise exception 'FAIL: opening transaction dated %, expected the Asia/Almaty date', v_date;
  end if;

  -- 2. Zero / empty opening balance creates no transaction -------------------
  v_id0 := create_account('__test zero', 'bank');
  select count(*) into v_n from transactions where account_id = v_id0;
  if v_n <> 0 then raise exception 'FAIL: zero opening balance created % transactions', v_n; end if;
  select current_balance into v_bal from accounts where id = v_id0;
  if v_bal <> 0 then raise exception 'FAIL: zero account balance is %', v_bal; end if;

  -- 3. Invalid input is rejected and leaves nothing behind -------------------
  v_blocked := false;
  begin perform create_account('__bad', 'cash', -5);
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: negative opening balance was accepted'; end if;

  v_blocked := false;
  begin perform create_account('   ', 'cash', 10);
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: blank account name was accepted'; end if;

  v_blocked := false;
  begin perform create_account('__bad', 'not_a_type', 10);
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: invalid account type was accepted'; end if;

  select count(*) into v_n from accounts where name = '__bad';
  if v_n <> 0 then raise exception 'FAIL: a rejected create_account left % account(s) behind', v_n; end if;

  -- 4. The balance column is closed to direct writes -------------------------
  v_blocked := false;
  begin update accounts set current_balance = 999999 where id = v_id;
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: client could UPDATE current_balance'; end if;

  v_blocked := false;
  begin insert into accounts (user_id, name, type, current_balance) values (v_a, '__rich', 'cash', 1000000);
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: client could INSERT with current_balance'; end if;

  select current_balance into v_bal from accounts where id = v_id;
  if v_bal <> 1500.50 then raise exception 'FAIL: balance changed to % by blocked writes', v_bal; end if;

  -- 5. Allowed edits still work ---------------------------------------------
  update accounts set name = '__renamed', type = 'bank', is_archived = true where id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: rename/archive affected % rows, expected 1', v_n; end if;

  update accounts set is_archived = false where id = v_id;

  -- 6. The balance still moves through the trigger ---------------------------
  insert into transactions (user_id, type, amount, account_id) values (v_a, 'expense', 500.50, v_id);
  select current_balance into v_bal from accounts where id = v_id;
  if v_bal <> 1000 then raise exception 'FAIL: after expense 500.50 balance is %, expected 1000', v_bal; end if;

  -- 7. Another user cannot edit this account ---------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  update accounts set name = 'hacked', is_archived = true where id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FAIL: user B edited user A''s account'; end if;

  reset role;
  raise exception 'ALL CHECKS PASSED (rolled back, nothing was saved)';
end;
$$;
