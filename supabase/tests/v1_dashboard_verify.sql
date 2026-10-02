-- Verification for 20261003010000_period_summary.sql.
-- Paste into the Supabase SQL Editor after applying that migration.
-- Always rolled back; ends with an intentional exception.
--
--   Success -> ERROR: ALL CHECKS PASSED (rolled back, nothing was saved)
--   Failure -> ERROR: FAIL: <what went wrong>

do $$
declare
  v_a uuid;
  v_b uuid := gen_random_uuid();
  v_cash uuid;
  v_inv uuid;
  r record;
  v_n int;
begin
  select id into v_a from auth.users order by created_at limit 1;
  if v_a is null then
    raise exception 'FAIL: no user in auth.users. Create one in Authentication -> Users first.';
  end if;
  insert into auth.users (id) values (v_b);

  -- Who may read what (checked before impersonating anyone).
  if has_table_privilege('anon', 'activity_transactions', 'select') then
    raise exception 'FAIL: anon can select from activity_transactions';
  end if;
  if not has_table_privilege('authenticated', 'activity_transactions', 'select') then
    raise exception 'FAIL: authenticated cannot select from activity_transactions';
  end if;
  if has_function_privilege('anon', 'period_summary(date,date)', 'execute') then
    raise exception 'FAIL: anon can execute period_summary';
  end if;
  if not has_function_privilege('authenticated', 'period_summary(date,date)', 'execute') then
    raise exception 'FAIL: authenticated cannot execute period_summary';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- A far-away period, so any real data the user already has cannot interfere.
  -- Opening balance 1000 is dated "today" and must never reach the totals.
  v_cash := create_account('__dash cash', 'cash', 1000);
  v_inv  := create_account('__dash invest', 'investment', 0);

  -- In the period 2031-10-01 .. 2031-10-31
  insert into transactions (user_id, type, amount, account_id, occurred_on) values (v_a, 'income', 500, v_cash, '2031-10-01');
  insert into transactions (user_id, type, amount, account_id, occurred_on) values (v_a, 'expense', 120.50, v_cash, '2031-10-10');
  insert into transactions (user_id, type, amount, account_id, occurred_on) values (v_a, 'expense', 0.10, v_cash, '2031-10-15');
  insert into transactions (user_id, type, amount, account_id, occurred_on) values (v_a, 'expense', 0.20, v_cash, '2031-10-15');
  insert into transactions (user_id, type, amount, account_id, target_account_id, occurred_on)
    values (v_a, 'capital_allocation', 200, v_cash, v_inv, '2031-10-31');
  -- Just outside it, on both sides
  insert into transactions (user_id, type, amount, account_id, occurred_on) values (v_a, 'income', 999, v_cash, '2031-09-30');
  insert into transactions (user_id, type, amount, account_id, occurred_on) values (v_a, 'income', 888, v_cash, '2031-11-01');
  -- An opening balance dated INSIDE the period (written as the owner, the way
  -- create_account does; clients cannot set the flag)
  reset role;
  insert into transactions (user_id, type, amount, account_id, occurred_on, note, is_opening_balance)
    values (v_a, 'income', 7777, v_cash, '2031-10-20', 'Opening balance', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. Totals for the period ---------------------------------------------------
  select * into r from period_summary('2031-10-01', '2031-11-01');
  if r.income <> 500 then
    raise exception 'FAIL: income is %, expected 500 (opening balances excluded, 09-30 and 11-01 outside)', r.income;
  end if;
  if r.expenses <> 120.80 then raise exception 'FAIL: expenses are %, expected exactly 120.80', r.expenses; end if;
  if r.capital <> 200 then raise exception 'FAIL: capital is %, expected 200', r.capital; end if;
  if r.free_cash <> 179.20 then raise exception 'FAIL: free cash is %, expected 500 - 120.80 - 200 = 179.20', r.free_cash; end if;

  -- 2. Boundaries are first-day inclusive, last-day exclusive -------------------
  select * into r from period_summary('2031-09-01', '2031-10-01');
  if r.income <> 999 or r.expenses <> 0 or r.capital <> 0 then
    raise exception 'FAIL: previous month is %/%/%, expected 999/0/0', r.income, r.expenses, r.capital;
  end if;
  select * into r from period_summary('2031-11-01', '2031-12-01');
  if r.income <> 888 then raise exception 'FAIL: next month income is %, expected 888', r.income; end if;

  -- 3. An empty period returns exactly one row of zeros, not NULLs --------------
  select count(*) into v_n from period_summary('2040-01-01', '2040-02-01');
  if v_n <> 1 then raise exception 'FAIL: empty period returned % rows, expected 1', v_n; end if;
  select * into r from period_summary('2040-01-01', '2040-02-01');
  if r.income is distinct from 0 or r.expenses is distinct from 0
     or r.capital is distinct from 0 or r.free_cash is distinct from 0 then
    raise exception 'FAIL: empty period is not all zeros';
  end if;

  -- 4. The view hides opening balances, the ledger table still has them ---------
  select count(*) into v_n from activity_transactions where is_opening_balance;
  if v_n <> 0 then raise exception 'FAIL: activity_transactions exposes % opening-balance rows', v_n; end if;
  select count(*) into v_n from transactions where is_opening_balance;
  if v_n < 1 then raise exception 'FAIL: opening balances vanished from transactions'; end if;

  -- Opening balances still count toward the ACCOUNT balance (the trigger moved it).
  -- 1000 opening + 7777 flagged + 500 - 120.80 - 200 + 999 + 888 = 9043.20
  if (select current_balance from accounts where id = v_cash) <> 9043.20 then
    raise exception 'FAIL: account balance is %, expected 9043.20',
      (select current_balance from accounts where id = v_cash);
  end if;

  -- 5. Another user sees only their own data ------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b, 'role', 'authenticated')::text, true);

  select * into r from period_summary('2031-10-01', '2031-11-01');
  if r.income <> 0 or r.expenses <> 0 or r.capital <> 0 or r.free_cash <> 0 then
    raise exception 'FAIL: user B sees user A''s totals (% / % / %)', r.income, r.expenses, r.capital;
  end if;
  select count(*) into v_n from activity_transactions;
  if v_n <> 0 then raise exception 'FAIL: user B can read % of user A''s rows through the view', v_n; end if;

  reset role;
  raise exception 'ALL CHECKS PASSED (rolled back, nothing was saved)';
end;
$$;
