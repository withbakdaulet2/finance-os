-- Read-only diagnostics for: PGRST202 "Could not find the function
-- public.create_account(p_name, p_opening_balance, p_type) in the schema cache".
-- Paste into the Supabase SQL Editor and send back the result (it is one table).
-- Changes nothing.

select 'function exists' as check,
       coalesce(string_agg(p.oid::regprocedure::text, ' | '), 'MISSING') as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_account'

union all
select 'definer / owner / config',
       coalesce(string_agg(
         format('definer=%s owner=%s config=%s', p.prosecdef, pg_get_userbyid(p.proowner), p.proconfig),
         ' | '), '-')
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_account'

union all
select 'acl',
       coalesce(string_agg(coalesce(p.proacl::text, 'NULL (default = PUBLIC can execute)'), ' | '), '-')
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_account'

union all
select 'authenticated can execute',
       coalesce(bool_or(has_function_privilege('authenticated', p.oid, 'execute'))::text, '-')
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_account'

union all
select 'anon can execute (should be false)',
       coalesce(bool_or(has_function_privilege('anon', p.oid, 'execute'))::text, '-')
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_account'

union all
select 'PostgREST reload event triggers',
       coalesce(string_agg(evtname || ' (enabled=' || evtenabled::text || ')', ', '), 'NONE FOUND')
from pg_event_trigger
where evtname ilike 'pgrst%'

union all
select 'transactions.is_opening_balance exists',
       exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'transactions'
           and column_name = 'is_opening_balance'
       )::text;
