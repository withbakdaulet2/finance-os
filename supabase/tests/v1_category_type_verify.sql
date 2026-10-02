-- Verification for 20261003000000_category_type_matches_transaction.sql.
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
  v_cat_income uuid;
  v_cat_expense uuid;
  v_cat_capital uuid;
  v_cat_b uuid;
  v_custom uuid;
  v_tx_exp uuid;
  v_tx_inc uuid;
  v_tx_cap uuid;
  v_cat uuid;
  v_n int;
  v_blocked boolean;
begin
  select id into v_a from auth.users order by created_at limit 1;
  if v_a is null then
    raise exception 'FAIL: no user in auth.users. Create one in Authentication -> Users first.';
  end if;

  -- Setup as the owner: a second user with a category of their own.
  insert into auth.users (id) values (v_b);
  select id into v_cat_b from categories where user_id = v_b and type = 'expense' limit 1;

  select id into v_cat_income  from categories where user_id = v_a and is_system and type = 'income'  limit 1;
  select id into v_cat_expense from categories where user_id = v_a and is_system and type = 'expense' limit 1;
  select id into v_cat_capital from categories where user_id = v_a and is_system and type = 'capital' limit 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  v_cash := create_account('__cat cash', 'cash', 0);
  v_inv  := create_account('__cat invest', 'investment', 0);

  -- 1. INSERT: matching categories are accepted --------------------------------
  insert into transactions (user_id, type, amount, account_id, category_id)
    values (v_a, 'income', 100, v_cash, v_cat_income) returning id into v_tx_inc;
  insert into transactions (user_id, type, amount, account_id, category_id)
    values (v_a, 'expense', 10, v_cash, v_cat_expense) returning id into v_tx_exp;
  insert into transactions (user_id, type, amount, account_id, target_account_id, category_id)
    values (v_a, 'capital_allocation', 20, v_cash, v_inv, v_cat_capital) returning id into v_tx_cap;
  insert into transactions (user_id, type, amount, account_id) values (v_a, 'expense', 1, v_cash);  -- no category

  -- 2. INSERT: every mismatch is rejected --------------------------------------
  v_blocked := false;
  begin insert into transactions (user_id, type, amount, account_id, category_id)
          values (v_a, 'income', 5, v_cash, v_cat_expense);
  exception when check_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: income with an expense category was accepted'; end if;

  v_blocked := false;
  begin insert into transactions (user_id, type, amount, account_id, category_id)
          values (v_a, 'expense', 5, v_cash, v_cat_income);
  exception when check_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: expense with an income category was accepted'; end if;

  v_blocked := false;
  begin insert into transactions (user_id, type, amount, account_id, category_id)
          values (v_a, 'expense', 5, v_cash, v_cat_capital);
  exception when check_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: expense with a capital category was accepted'; end if;

  v_blocked := false;
  begin insert into transactions (user_id, type, amount, account_id, target_account_id, category_id)
          values (v_a, 'capital_allocation', 5, v_cash, v_inv, v_cat_expense);
  exception when check_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: capital allocation with an expense category was accepted'; end if;

  v_blocked := false;
  begin insert into transactions (user_id, type, amount, account_id, category_id)
          values (v_a, 'expense', 5, v_cash, v_cat_b);   -- right kind, but user B's category
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: another user''s category was accepted'; end if;

  -- A rejected insert must not have moved a balance: 100 - 10 - 20 - 1 = 69.
  if (select current_balance from accounts where id = v_cash) <> 69 then
    raise exception 'FAIL: a rejected insert changed the balance to %',
      (select current_balance from accounts where id = v_cash);
  end if;

  -- 3. UPDATE: re-pointing category_id is validated too ------------------------
  v_blocked := false;
  begin update transactions set category_id = v_cat_income where id = v_tx_exp;   -- expense -> income category
  exception when check_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: UPDATE to a wrong-kind category was accepted'; end if;

  v_blocked := false;
  begin update transactions set category_id = v_cat_b where id = v_tx_exp;        -- foreign category
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: UPDATE to another user''s category was accepted'; end if;

  -- A valid re-point works (another expense category), and so does clearing it.
  insert into categories (user_id, name, type) values (v_a, '__cat custom', 'expense')
    returning id into v_custom;
  update transactions set category_id = v_custom where id = v_tx_exp;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: valid category change affected % rows', v_n; end if;

  update transactions set category_id = null where id = v_tx_exp;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: clearing the category affected % rows', v_n; end if;

  update transactions set note = 'edited', category_id = v_cat_expense where id = v_tx_exp;  -- unchanged-kind edit
  if (select category_id from transactions where id = v_tx_exp) is distinct from v_cat_expense then
    raise exception 'FAIL: category was not updated';
  end if;

  -- 4. Deleting a category still works and clears it on its transactions -------
  update transactions set category_id = v_custom where id = v_tx_exp;
  delete from categories where id = v_custom;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: deleting a custom category affected % rows', v_n; end if;
  select category_id into v_cat from transactions where id = v_tx_exp;
  if v_cat is not null then raise exception 'FAIL: transaction kept a dangling category after delete'; end if;

  -- 5. V1 rules from earlier migrations still hold ------------------------------
  v_blocked := false;
  begin update transactions set amount = 999 where id = v_tx_inc;
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: amount update was allowed'; end if;

  reset role;
  raise exception 'ALL CHECKS PASSED (rolled back, nothing was saved)';
end;
$$;
