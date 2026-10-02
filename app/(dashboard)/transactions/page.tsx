import Link from "next/link";

import { TransactionFilterBar } from "@/components/transactions/transaction-filters";
import { TransactionList } from "@/components/transactions/transaction-list";
import { Button } from "@/components/ui/button";
import { getAccounts } from "@/lib/queries/accounts";
import {
  PAGE_SIZE,
  getTransactions,
  hasActiveFilters,
  parseTransactionFilters,
} from "@/lib/queries/transactions";

export const metadata = { title: "Transactions · Finance OS" };

export default async function TransactionsPage(
  props: PageProps<"/transactions">,
) {
  const filters = parseTransactionFilters(await props.searchParams);

  const [{ rows, hasMore }, accounts] = await Promise.all([
    getTransactions(filters),
    getAccounts(),
  ]);

  // "Show more" keeps the current filters and raises the limit.
  const moreParams = new URLSearchParams();
  if (filters.type) moreParams.set("type", filters.type);
  if (filters.accountId) moreParams.set("account", filters.accountId);
  if (filters.from) moreParams.set("from", filters.from);
  if (filters.to) moreParams.set("to", filters.to);
  moreParams.set("limit", String(filters.limit + PAGE_SIZE));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>

      <TransactionFilterBar filters={filters} accounts={accounts} />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">
            {hasActiveFilters(filters)
              ? "No transactions match these filters"
              : "No transactions yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasActiveFilters(filters)
              ? "Try a wider date range or reset the filters."
              : "Tap + to add your first one."}
          </p>
        </div>
      ) : (
        <TransactionList rows={rows} />
      )}

      {hasMore && (
        <Button asChild variant="outline" size="lg" className="h-11 text-base">
          <Link href={`/transactions?${moreParams.toString()}`}>Show more</Link>
        </Button>
      )}
    </div>
  );
}
