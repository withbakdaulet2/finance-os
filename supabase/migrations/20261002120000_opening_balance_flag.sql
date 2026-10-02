-- transactions.is_opening_balance: marks the income transaction that create_account
-- writes for an account's starting balance.
--
-- Money totals that describe PERIOD ACTIVITY (dashboard Income / Expenses / Capital /
-- Free Cash, and later Analytics and Monthly Report) must exclude rows where
-- is_opening_balance = true. Filter on this flag, never on the text of `note`.
-- Opening balances remain regular transactions for the ledger and for account
-- balances (the trigger moves the balance as usual).

alter table transactions
  add column is_opening_balance boolean not null default false;

-- Only income can be an opening balance.
alter table transactions
  add constraint opening_balance_is_income
  check (not is_opening_balance or type = 'income');

-- Backfill: before this migration the only writer of note = 'Opening balance' was
-- create_account (there is no transaction UI yet), so this match is exact.
update transactions
set is_opening_balance = true
where type = 'income' and note = 'Opening balance';

-- ---------------------------------------------------------------------------
-- The flag may be set ONLY by create_account.
--
-- RLS cannot restrict columns, so use column privileges (same technique as
-- accounts.current_balance). Table-level INSERT/UPDATE must be revoked first.
-- Clients may still insert any other column and update the same columns as
-- before; id, user_id, created_at and is_opening_balance are not updatable.
-- (The V1 trigger additionally blocks changes to type/amount/accounts.)
-- ---------------------------------------------------------------------------

revoke insert, update on transactions from anon, authenticated;

grant insert (
  id, user_id, type, amount, account_id, target_account_id,
  category_id, occurred_on, note, created_at
) on transactions to authenticated;

grant update (
  type, amount, account_id, target_account_id, category_id, occurred_on, note
) on transactions to authenticated;

-- create_account must now be SECURITY DEFINER: it runs with its owner's rights, so it
-- can write is_opening_balance while the calling client cannot. It is safe because
-- it never trusts a caller-supplied user id: everything is written for auth.uid(),
-- and it rejects calls without a signed-in user.

create or replace function create_account(
  p_name text,
  p_type text,
  p_opening_balance numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(p_name);
  v_amount numeric(14,2) := round(coalesce(p_opening_balance, 0), 2);
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if v_name is null or v_name = '' then
    raise exception 'account name is required' using errcode = '23514';
  end if;

  if v_amount < 0 then
    raise exception 'opening balance cannot be negative' using errcode = '23514';
  end if;

  insert into accounts (user_id, name, type)
  values (v_user, v_name, p_type)
  returning id into v_id;

  if v_amount > 0 then
    insert into transactions (
      user_id, type, amount, account_id, occurred_on, note, is_opening_balance
    )
    values (
      v_user,
      'income',
      v_amount,
      v_id,
      (now() at time zone 'Asia/Almaty')::date,
      'Opening balance',
      true
    );
  end if;

  return v_id;
end;
$$;

-- CREATE OR REPLACE keeps existing grants; restate them so this file is self-contained.
revoke all on function create_account(text, text, numeric) from public, anon;
grant execute on function create_account(text, text, numeric) to authenticated;
