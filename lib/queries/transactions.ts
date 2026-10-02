import { isValidDateString } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import {
  isTransactionType,
  type Transaction,
  type TransactionType,
} from "@/lib/types/domain";
import { isUuid } from "@/lib/validation";

export const PAGE_SIZE = 50;
const MAX_LIMIT = 500;

export type TransactionFilters = {
  type?: TransactionType;
  accountId?: string;
  from?: string; // YYYY-MM-DD, inclusive
  to?: string; // YYYY-MM-DD, inclusive
  limit: number;
};

export type TransactionRowData = Transaction & {
  account_name: string;
  target_account_name: string | null;
  category_name: string | null;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

// Turns untrusted URL params into safe filters; anything invalid is ignored.
export function parseTransactionFilters(
  params: RawSearchParams,
): TransactionFilters {
  const type = first(params.type);
  const account = first(params.account);
  const from = first(params.from);
  const to = first(params.to);
  const limit = Number.parseInt(first(params.limit), 10);

  return {
    type: isTransactionType(type) ? type : undefined,
    accountId: isUuid(account) ? account : undefined,
    from: isValidDateString(from) ? from : undefined,
    to: isValidDateString(to) ? to : undefined,
    limit:
      Number.isFinite(limit) && limit > 0
        ? Math.min(limit, MAX_LIMIT)
        : PAGE_SIZE,
  };
}

export function hasActiveFilters(f: TransactionFilters): boolean {
  return Boolean(f.type || f.accountId || f.from || f.to);
}

const SELECT = `
  *,
  account:accounts!transactions_account_id_fkey(name),
  target_account:accounts!transactions_target_account_id_fkey(name),
  category:categories!transactions_category_id_fkey(name)
`;

// Newest first. A transfer matches the account filter on either side.
export async function getTransactions(
  filters: TransactionFilters,
): Promise<{ rows: TransactionRowData[]; hasMore: boolean }> {
  const supabase = await createClient();

  let query = supabase
    .from("transactions")
    .select(SELECT)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    // One extra row tells us whether there is a next page.
    .limit(filters.limit + 1);

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.from) query = query.gte("occurred_on", filters.from);
  if (filters.to) query = query.lte("occurred_on", filters.to);
  if (filters.accountId) {
    // accountId passed isUuid(), so interpolating it into the filter is safe.
    query = query.or(
      `account_id.eq.${filters.accountId},target_account_id.eq.${filters.accountId}`,
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load transactions: ${error.message}`);
  }

  const hasMore = data.length > filters.limit;
  const rows = data.slice(0, filters.limit).map(
    ({ account, target_account, category, ...tx }): TransactionRowData => ({
      ...tx,
      account_name: account?.name ?? "Unknown account",
      target_account_name: target_account?.name ?? null,
      category_name: category?.name ?? null,
    }),
  );

  return { rows, hasMore };
}
