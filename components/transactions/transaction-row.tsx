import { ArrowRight } from "lucide-react";

import { formatMoney } from "@/lib/format";
import type { TransactionRowData } from "@/lib/queries/transactions";
import { transactionTypeLabel } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

import { DeleteTransactionButton } from "./delete-transaction-button";

export function TransactionRow({ tx }: { tx: TransactionRowData }) {
  const isCapital = tx.type === "capital_allocation";

  // Title: what it was. Falls back to the type when there is no category.
  const title = tx.is_opening_balance
    ? "Opening balance"
    : (tx.category_name ?? transactionTypeLabel(tx.type));

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        {/* Wraps (max 2 lines) instead of cutting the title off next to a wide amount. */}
        <p className="line-clamp-2 font-medium break-words">{title}</p>

        <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
          <span className="truncate">{tx.account_name}</span>
          {isCapital && tx.target_account_name && (
            <>
              <ArrowRight className="size-3.5 shrink-0" aria-label="to" />
              <span className="truncate">{tx.target_account_name}</span>
            </>
          )}
        </p>

        {tx.note && !tx.is_opening_balance && (
          <p className="truncate text-sm text-muted-foreground">{tx.note}</p>
        )}
      </div>

      <p
        className={cn(
          "shrink-0 text-base font-semibold tabular-nums sm:text-lg",
          tx.type === "income" && "text-emerald-600 dark:text-emerald-400",
          isCapital && "text-muted-foreground",
        )}
      >
        {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}
        {formatMoney(tx.amount)}
      </p>

      <DeleteTransactionButton id={tx.id} />
    </li>
  );
}
