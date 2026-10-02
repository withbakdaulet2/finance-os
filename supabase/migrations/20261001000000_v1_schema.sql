-- Finance OS V1 schema: accounts, categories, transactions, RLS, balance triggers.
-- Out of scope for V1 (do not add here): debts, goals, net worth, analytics tables.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash','bank','emergency_fund','investment','umrah_fund','business_fund','other')),
  current_balance numeric(14,2) not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income','expense','capital')),
  parent_id uuid references categories(id) on delete set null,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense','capital_allocation')),
  amount numeric(14,2) not null check (amount > 0),
  account_id uuid not null references accounts(id) on delete restrict,
  target_account_id uuid references accounts(id) on delete restrict, -- required only when type = 'capital_allocation'
  category_id uuid references categories(id) on delete set null,
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  constraint capital_needs_target check (
    (type = 'capital_allocation' and target_account_id is not null)
    or (type <> 'capital_allocation' and target_account_id is null)
  )
);

-- Indexes: ledger filtering, month aggregation, and FK lookups (RESTRICT checks).
create index accounts_user_idx on accounts (user_id);
create index categories_user_idx on categories (user_id);
create index transactions_user_occurred_idx on transactions (user_id, occurred_on desc);
create index transactions_account_idx on transactions (account_id);
create index transactions_target_account_idx on transactions (target_account_id) where target_account_id is not null;
create index transactions_category_idx on transactions (category_id) where category_id is not null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;

create policy "owner_only" on accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner_only" on categories for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner_only" on transactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Balance integrity
-- Balances are materialized in accounts.current_balance and moved ONLY by this
-- trigger, in the same transaction as the insert/delete. Never recompute them
-- on the client.
--
-- The function is SECURITY DEFINER (it must update accounts regardless of the
-- caller's policies), which bypasses RLS. So on INSERT it explicitly verifies
-- that every referenced account/category belongs to the transaction's user;
-- otherwise a user could move the balance of someone else's account.
-- ---------------------------------------------------------------------------

create or replace function fn_apply_transaction_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from accounts where id = new.account_id and user_id = new.user_id) then
      raise exception 'account % does not belong to the transaction owner', new.account_id
        using errcode = '42501';
    end if;

    if new.category_id is not null
       and not exists (select 1 from categories where id = new.category_id and user_id = new.user_id) then
      raise exception 'category % does not belong to the transaction owner', new.category_id
        using errcode = '42501';
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

create trigger trg_transaction_insert
  after insert on transactions
  for each row execute function fn_apply_transaction_balance();

create trigger trg_transaction_delete
  after delete on transactions
  for each row execute function fn_apply_transaction_balance();

-- ---------------------------------------------------------------------------
-- V1 has no transaction editing. RLS ("for all") would still let a client
-- UPDATE amount/type/accounts directly and silently desync balances, so block
-- those columns. note, category_id and occurred_on stay editable (they never
-- affect balances). To fix a mistake: delete and re-add.
-- ---------------------------------------------------------------------------

create or replace function fn_block_transaction_financial_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.type is distinct from old.type
     or new.amount is distinct from old.amount
     or new.account_id is distinct from old.account_id
     or new.target_account_id is distinct from old.target_account_id then
    raise exception 'transactions cannot be edited in V1 (type, amount, accounts): delete and re-add instead'
      using errcode = '23000';
  end if;
  return new;
end;
$$;

create trigger trg_transaction_block_update
  before update on transactions
  for each row execute function fn_block_transaction_financial_update();
