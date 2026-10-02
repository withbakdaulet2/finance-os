-- Verification for 20261002120000_opening_balance_flag.sql.
-- Paste into the Supabase SQL Editor after applying that migration.
-- Always rolled back; ends with an intentional exception.
--
--   Success -> ERROR: ALL CHECKS PASSED (rolled back, nothing was saved)
--   Failure -> ERROR: FAIL: <what went wrong>

do $$
declare
  v_a uuid;
  v_acc uuid;
  v_acc2 uuid;
  v_tx uuid;
  v_n int;
  v_flag boolean;
  v_blocked boolean;
begin
  select id into v_a from auth.users order by created_at limit 1;
  if v_a is null then
    raise exception 'FAIL: no user in auth.users. Create one in Authentication -> Users first.';
  end if;

  -- 0. Backfill: no row looks like an opening balance without being flagged.
  select count(*) into v_n from transactions
    where type = 'income' and note = 'Opening balance' and not is_opening_balance;
  if v_n <> 0 then
    raise exception 'FAIL: % existing opening-balance rows were not flagged by the backfill', v_n;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. create_account sets the flag; ordinary rows default to false ----------
  v_acc := create_account('__flag test', 'cash', 250);
  select is_opening_balance into v_flag from transactions
    where account_id = v_acc and note = 'Opening balance';
  if v_flag is distinct from true then
    raise exception 'FAIL: create_account did not set is_opening_balance (got %)', v_flag;
  end if;

  v_acc2 := create_account('__flag zero', 'bank', 0);
  select count(*) into v_n from transactions where account_id = v_acc2;
  if v_n <> 0 then raise exception 'FAIL: zero opening balance created % transactions', v_n; end if;

  insert into transactions (user_id, type, amount, account_id, note)
    values (v_a, 'income', 10, v_acc, 'Opening balance')   -- same text, typed by a client
    returning id into v_tx;
  select is_opening_balance into v_flag from transactions where id = v_tx;
  if v_flag then raise exception 'FAIL: a client row with the same note text got the flag'; end if;

  -- 2. Clients cannot set or change the flag ---------------------------------
  v_blocked := false;
  begin
    insert into transactions (user_id, type, amount, account_id, is_opening_balance)
      values (v_a, 'income', 5, v_acc, true);
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: client could INSERT is_opening_balance'; end if;

  v_blocked := false;
  begin
    update transactions set is_opening_balance = true where id = v_tx;
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: client could UPDATE is_opening_balance to true'; end if;

  v_blocked := false;
  begin
    update transactions set is_opening_balance = false
      where account_id = v_acc and note = 'Opening balance' and is_opening_balance;
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: client could UPDATE is_opening_balance to false'; end if;

  -- 3. Normal client writes still work ---------------------------------------
  update transactions set note = 'edited' where id = v_tx;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: editing a note affected % rows', v_n; end if;

  delete from transactions where id = v_tx;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: deleting a transaction affected % rows', v_n; end if;

  -- 4. create_account needs a signed-in user ---------------------------------
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
  v_blocked := false;
  begin perform create_account('__anon', 'cash', 1);
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: create_account worked without a user'; end if;

  -- 5. Only income can be an opening balance (constraint, checked as owner) --
  reset role;
  v_blocked := false;
  begin
    insert into transactions (user_id, type, amount, account_id, is_opening_balance)
      values (v_a, 'expense', 1, v_acc, true);
  exception when check_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: an expense was accepted as an opening balance'; end if;

  raise exception 'ALL CHECKS PASSED (rolled back, nothing was saved)';
end;
$$;
