import { formatDay } from "@/lib/dates";
import type { TransactionRowData } from "@/lib/queries/transactions";

import { TransactionRow } from "./transaction-row";

// Newest first, grouped under a heading per day.
export function TransactionList({ rows }: { rows: TransactionRowData[] }) {
  const days: { date: string; items: TransactionRowData[] }[] = [];
  for (const tx of rows) {
    const last = days[days.length - 1];
    if (last && last.date === tx.occurred_on) last.items.push(tx);
    else days.push({ date: tx.occurred_on, items: [tx] });
  }

  return (
    <div className="flex flex-col gap-6">
      {days.map((day) => (
        <section key={day.date} aria-label={formatDay(day.date)}>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            {formatDay(day.date)}
          </h2>
          <ul className="divide-y rounded-xl border">
            {day.items.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
