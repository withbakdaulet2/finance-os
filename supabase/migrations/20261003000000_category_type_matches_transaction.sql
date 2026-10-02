-- A transaction may only use a category of the matching kind:
--   income             -> categories.type = 'income'
--   expense            -> categories.type = 'expense'
--   capital_allocation -> categories.type = 'capital'
-- (category_id stays optional.)
--
-- A CHECK constraint cannot look at another table, so this is enforced in triggers,
-- on INSERT (balance trigger) and on UPDATE (category_id is client-editable in V1,
-- so without the UPDATE check a client could re-point a row at a wrong-kind or
-- foreign category). Deleting a category still works: ON DELETE SET NULL writes a
-- NULL category_id, which is not validated.
--
-- Rows created before this migration are not re-checked. To audit them:
--   select t.id, t.type, c.type as category_type
--   from transactions t join categories c on c.id = t.category_id
--   where c.type <> case t.type when 'capital_allocation' then 'capital' else t.type end;

create or replace function fn_apply_transaction_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_type text;
  v_expected_type text;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from accounts where id = new.account_id and user_id = new.user_id) then
      raise exception 'account % does not belong to the transaction owner', new.account_id
        using errcode = '42501';
    end if;

    if new.category_id is not null then
      select type into v_category_type
      from categories
      where id = new.category_id and user_id = new.user_id;

      if not found then
        raise exception 'category % does not belong to the transaction owner', new.category_id
          using errcode = '42501';
      end if;

      -- Computed first: a CASE ... THEN inside an IF condition confuses the PL/pgSQL
      -- parser (it takes the CASE's THEN for the end of the condition).
      v_expected_type := case new.type when 'capital_allocation' then 'capital' else new.type end;

      if v_category_type <> v_expected_type then
        raise exception 'a % transaction cannot use a % category', new.type, v_category_type
          using errcode = '23514';
      end if;
    end if;

    if new.type = 'capital_allocation' then
      if new.target_account_id = new.account_id then
        raise exception 'capital allocation needs two different accounts'
          using errcode = '23514';
      end if;
      if not exists (select 1 from accounts where id = new.target_account_id and user_id = new.user_id) then
        raise exception 'target account % does not belong to the transaction owner', new.target_account_id
          using errcode = '42501';
      end if;
    end if;

    if new.type = 'income' then
      update accounts set current_balance = current_balance + new.amount where id = new.account_id;
    elsif new.type = 'expense' then
      update accounts set current_balance = current_balance - new.amount where id = new.account_id;
    elsif new.type = 'capital_allocation' then
      update accounts set current_balance = current_balance - new.amount where id = new.account_id;
      update accounts set current_balance = current_balance + new.amount where id = new.target_account_id;
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    if old.type = 'income' then
      update accounts set current_balance = current_balance - old.amount where id = old.account_id;
    elsif old.type = 'expense' then
      update accounts set current_balance = current_balance + old.amount where id = old.account_id;
    elsif old.type = 'capital_allocation' then
      update accounts set current_balance = current_balance + old.amount where id = old.account_id;
      update accounts set current_balance = current_balance - old.amount where id = old.target_account_id;
    end if;
    return old;
  end if;

  return null;
end;
$$;

create or replace function fn_block_transaction_financial_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_category_type text;
  v_expected_type text;
begin
  if new.user_id is distinct from old.user_id
     or new.type is distinct from old.type
     or new.amount is distinct from old.amount
     or new.account_id is distinct from old.account_id
     or new.target_account_id is distinct from old.target_account_id then
    raise exception 'transactions cannot be edited in V1 (type, amount, accounts): delete and re-add instead'
      using errcode = '23000';
  end if;

  -- Only a real change to a non-null category is validated.
  if new.category_id is not null and new.category_id is distinct from old.category_id then
    select type into v_category_type
    from categories
    where id = new.category_id and user_id = new.user_id;

    if not found then
      raise exception 'category % does not belong to the transaction owner', new.category_id
        using errcode = '42501';
    end if;

    v_expected_type := case new.type when 'capital_allocation' then 'capital' else new.type end;

    if v_category_type <> v_expected_type then
      raise exception 'a % transaction cannot use a % category', new.type, v_category_type
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;
