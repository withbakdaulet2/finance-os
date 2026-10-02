-- Period totals: Income / Expenses / Capital / Free Cash.
--
-- ONE definition of "activity", reused by the dashboard now and by Analytics and
-- Monthly Report later: transactions WITHOUT the opening-balance rows that
-- create_account writes for an account's starting balance. Those rows still count
-- toward account balances and the ledger, but they are not income earned in a month.
-- Anything that totals period activity must read activity_transactions, never
-- `transactions` directly, so the exclusion cannot be forgotten.
--
-- Sums are computed here, in numeric, never in the client (floating point would
-- turn 0.10 + 0.20 into 0.30000000000000004).

-- security_invoker: the view runs with the CALLER's rights, so RLS on transactions
-- still limits every user to their own rows. (A normal view would run as its owner
-- and bypass RLS.)
create view activity_transactions
with (security_invoker = true) as
select *
from transactions
where not is_opening_balance;

revoke all on activity_transactions from public, anon, authenticated;
grant select on activity_transactions to authenticated;

-- p_to_exclusive is exclusive, so a month is (first day, first day of next month).
-- Returns exactly one row, with zeros for an empty period.
-- Free Cash = Income - Expenses - Capital. Capital allocation is a transfer to
-- another of the user's own accounts: it reduces Free Cash but is not an expense.
create or replace function period_summary(p_from date, p_to_exclusive date)
returns table (income numeric, expenses numeric, capital numeric, free_cash numeric)
language sql
stable
set search_path = public
as $$
  select s.income, s.expenses, s.capital, s.income - s.expenses - s.capital
  from (
    select
      coalesce(sum(amount) filter (where type = 'income'), 0)             as income,
      coalesce(sum(amount) filter (where type = 'expense'), 0)            as expenses,
      coalesce(sum(amount) filter (where type = 'capital_allocation'), 0) as capital
    from activity_transactions
    where occurred_on >= p_from and occurred_on < p_to_exclusive
  ) s;
$$;

revoke all on function period_summary(date, date) from public, anon;
grant execute on function period_summary(date, date) to authenticated;

-- Make the API pick up the new view/function straight away (PostgREST caches the
-- schema; earlier a new function was invisible until it was reloaded).
notify pgrst, 'reload schema';
