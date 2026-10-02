-- 1) accounts.current_balance can no longer be written by API clients.
--
-- RLS decides WHICH rows a user may touch; it cannot restrict columns. Column
-- privileges can. After this migration the `authenticated` role may only insert
-- (user_id, name, type) and update (name, type, is_archived). The balance moves
-- exclusively through fn_apply_transaction_balance (SECURITY DEFINER, runs as the
-- function owner, so it is unaffected).
--
-- Table-level INSERT/UPDATE must be revoked first: a table-level grant would
-- still cover every column.

revoke insert, update on accounts from anon, authenticated;
grant insert (user_id, name, type) on accounts to authenticated;
grant update (name, type, is_archived) on accounts to authenticated;

-- 2) Opening balance = a regular income transaction created together with the account.
--
-- One function call == one database transaction: either the account and its
-- opening transaction both exist, or neither does. Runs as the caller
-- (SECURITY INVOKER), so RLS and the column grants above apply to it too.
--
-- occurred_on uses the Asia/Almaty calendar date, not the server's UTC date.
-- NOTE: this income counts toward the current month's Income / Free Cash. It is
-- marked with note = 'Opening balance' so it can be told apart later.

create or replace function create_account(
  p_name text,
  p_type text,
  p_opening_balance numeric default 0
)
returns uuid
language plpgsql
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
    insert into transactions (user_id, type, amount, account_id, occurred_on, note)
    values (
      v_user,
      'income',
      v_amount,
      v_id,
      (now() at time zone 'Asia/Almaty')::date,
      'Opening balance'
    );
  end if;

  return v_id;
end;
$$;

-- Functions are executable by PUBLIC by default; only signed-in users may call this.
revoke all on function create_account(text, text, numeric) from public, anon;
grant execute on function create_account(text, text, numeric) to authenticated;
