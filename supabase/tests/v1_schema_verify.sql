-- Step 3 verification. Paste into the Supabase SQL Editor AFTER applying both migrations.
--
-- Needs at least one user in auth.users (the one created manually).
-- Everything runs inside one DO block and is ALWAYS rolled back: the script ends
-- by raising an exception on purpose, so nothing is saved.
--
--   Success -> ERROR: ALL CHECKS PASSED (rolled back, nothing was saved)
--   Failure -> ERROR: FAIL: <what went wrong>
--
-- It impersonates users by setting the JWT claim and switching to the
-- `authenticated` role, which is exactly how the API evaluates RLS.

do $$
declare
  v_a uuid;                -- existing user
  v_b uuid := gen_random_uuid();  -- temporary second user
  v_cash uuid;
  v_inv uuid;
  v_tx_inc uuid;
  v_tx_exp uuid;
  v_tx_cap uuid;
  v_tx_extra uuid;
  v_bal numeric;
  v_bal2 numeric;
  v_n int;
  v_blocked boolean;
begin
  select id into v_a from auth.users order by created_at limit 1;
  if v_a is null then
    raise exception 'FAIL: no user in auth.users. Create one in Authentication -> Users first.';
  end if;

  -- 1. Seed -----------------------------------------------------------------
  select count(*) into v_n from categories where user_id = v_a and is_system;
  if v_n <> 14 then
    raise exception 'FAIL: user A has % system categories, expected 14', v_n;
  end if;

  -- A brand-new user must be seeded by the signup trigger.
  insert into auth.users (id) values (v_b);
  select count(*) into v_n from categories where user_id = v_b and is_system;
  if v_n <> 14 then
    raise exception 'FAIL: signup trigger gave a new user % system categories, expected 14', v_n;
  end if;

  -- 2. Balance trigger, acting as user A ------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into accounts (user_id, name, type) values (v_a, '__test cash', 'cash') returning id into v_cash;
  insert into accounts (user_id, name, type) values (v_a, '__test invest', 'investment') returning id into v_inv;

  select current_balance into v_bal from accounts where id = v_cash;
  if v_bal <> 0 then raise exception 'FAIL: new account balance is %, expected 0', v_bal; end if;

  insert into transactions (user_id, type, amount, account_id)
    values (v_a, 'income', 1000, v_cash) returning id into v_tx_inc;
  select current_balance into v_bal from accounts where id = v_cash;
  if v_bal <> 1000 then raise exception 'FAIL: after income 1000 balance is %, expected 1000', v_bal; end if;

  insert into transactions (user_id, type, amount, account_id)
    values (v_a, 'expense', 200, v_cash) returning id into v_tx_exp;
  select current_balance into v_bal from accounts where id = v_cash;
  if v_bal <> 800 then raise exception 'FAIL: after expense 200 balance is %, expected 800', v_bal; end if;

  insert into transactions (user_id, type, amount, account_id, target_account_id)
    values (v_a, 'capital_allocation', 300, v_cash, v_inv) returning id into v_tx_cap;
  select current_balance into v_bal from accounts where id = v_cash;
  select current_balance into v_bal2 from accounts where id = v_inv;
  if v_bal <> 500 or v_bal2 <> 300 then
    raise exception 'FAIL: after capital 300 balances are % / %, expected 500 / 300', v_bal, v_bal2;
  end if;

  -- Deleting reverses the balance.
  delete from transactions where id = v_tx_cap;
  select current_balance into v_bal from accounts where id = v_cash;
  select current_balance into v_bal2 from accounts where id = v_inv;
  if v_bal <> 800 or v_bal2 <> 0 then
    raise exception 'FAIL: after deleting capital balances are % / %, expected 800 / 0', v_bal, v_bal2;
  end if;

  delete from transactions where id = v_tx_exp;
  delete from transactions where id = v_tx_inc;
  select current_balance into v_bal from accounts where id = v_cash;
  if v_bal <> 0 then raise exception 'FAIL: after deleting everything balance is %, expected 0', v_bal; end if;

  -- 3. Constraints and V1 immutability, still as A --------------------------
  v_blocked := false;
  begin
    insert into transactions (user_id, type, amount, account_id)
      values (v_a, 'capital_allocation', 10, v_cash);  -- no target account
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: capital_allocation without target was accepted'; end if;

  v_blocked := false;
  begin
    insert into transactions (user_id, type, amount, account_id, target_account_id)
      values (v_a, 'capital_allocation', 10, v_cash, v_cash);  -- same account
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: capital allocation to the same account was accepted'; end if;

  v_blocked := false;
  begin
    insert into transactions (user_id, type, amount, account_id)
      values (v_a, 'expense', 0, v_cash);  -- amount must be > 0
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: amount 0 was accepted'; end if;

  insert into transactions (user_id, type, amount, account_id, note)
    values (v_a, 'income', 100, v_cash, 'orig') returning id into v_tx_extra;

  v_blocked := false;
  begin
    update transactions set amount = 999 where id = v_tx_extra;
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: amount update was allowed (balance would desync)'; end if;

  update transactions set note = 'edited' where id = v_tx_extra;  -- harmless edit must work
  select current_balance into v_bal from accounts where id = v_cash;
  if v_bal <> 100 then raise exception 'FAIL: balance is %, expected 100 after blocked update', v_bal; end if;

  -- 4. RLS: user B must not see or touch user A's data ------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b, 'role', 'authenticated')::text, true);

  select count(*) into v_n from accounts where id = v_cash;
  if v_n <> 0 then raise exception 'FAIL: user B can read user A''s account'; end if;

  select count(*) into v_n from transactions where id = v_tx_extra;
  if v_n <> 0 then raise exception 'FAIL: user B can read user A''s transaction'; end if;

  update accounts set name = 'hacked' where id = v_cash;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FAIL: user B could update user A''s account'; end if;

  delete from transactions where id = v_tx_extra;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FAIL: user B could delete user A''s transaction'; end if;

  -- B writes a row as A: blocked by the RLS WITH CHECK.
  v_blocked := false;
  begin
    insert into transactions (user_id, type, amount, account_id)
      values (v_a, 'income', 50, v_cash);
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: user B inserted a transaction as user A'; end if;

  -- B writes its own row against A's account: blocked by the ownership check in the
  -- SECURITY DEFINER trigger (RLS alone would NOT stop this).
  v_blocked := false;
  begin
    insert into transactions (user_id, type, amount, account_id)
      values (v_b, 'income', 50, v_cash);
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: user B moved the balance of user A''s account'; end if;

  -- 5. A's balance is untouched by everything B tried ------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  select current_balance into v_bal from accounts where id = v_cash;
  if v_bal <> 100 then raise exception 'FAIL: user A balance is %, expected 100 after B''s attempts', v_bal; end if;

  reset role;
  raise exception 'ALL CHECKS PASSED (rolled back, nothing was saved)';
end;
$$;
