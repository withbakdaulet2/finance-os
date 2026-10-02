import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  hasActiveFilters,
  type TransactionFilters,
} from "@/lib/queries/transactions";
import { TRANSACTION_TYPES, type Account } from "@/lib/types/domain";

// Plain GET form: filters live in the URL (shareable, back-button friendly) and
// need no client JavaScript. Submitting always starts again from the first page.
export function TransactionFilterBar({
  filters,
  accounts,
}: {
  filters: TransactionFilters;
  accounts: Account[]; // includes archived: their history stays filterable
}) {
  const active = hasActiveFilters(filters);

  return (
    <details open={active} className="group rounded-xl border">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium select-none">
        <span>Filters{active && " · on"}</span>
        <span className="text-muted-foreground group-open:hidden">Show</span>
        <span className="hidden text-muted-foreground group-open:inline">
          Hide
        </span>
      </summary>

      <form
        method="get"
        action="/transactions"
        className="flex flex-col gap-4 border-t p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="filter-type">Type</Label>
            <NativeSelect
              id="filter-type"
              name="type"
              defaultValue={filters.type ?? ""}
              className="w-full [&_select]:h-11 [&_select]:text-base"
            >
              <NativeSelectOption value="">All types</NativeSelectOption>
              {TRANSACTION_TYPES.map((t) => (
                <NativeSelectOption key={t.value} value={t.value}>
                  {t.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="filter-account">Account</Label>
            <NativeSelect
              id="filter-account"
              name="account"
              defaultValue={filters.accountId ?? ""}
              className="w-full [&_select]:h-11 [&_select]:text-base"
            >
              <NativeSelectOption value="">All accounts</NativeSelectOption>
              {accounts.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.name}
                  {a.is_archived ? " (archived)" : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="filter-from">From</Label>
            <Input
              id="filter-from"
              name="from"
              type="date"
              defaultValue={filters.from ?? ""}
              className="h-11 text-base"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="filter-to">To</Label>
            <Input
              id="filter-to"
              name="to"
              type="date"
              defaultValue={filters.to ?? ""}
              className="h-11 text-base"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" size="lg" className="h-11 flex-1 text-base">
            Apply
          </Button>
          {active && (
            <Button asChild variant="outline" size="lg" className="h-11 text-base">
              <Link href="/transactions">Reset</Link>
            </Button>
          )}
        </div>
      </form>
    </details>
  );
}
