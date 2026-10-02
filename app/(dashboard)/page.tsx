import Link from "next/link";

import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { getAccounts } from "@/lib/queries/accounts";
import { getCurrentMonthSummary } from "@/lib/queries/dashboard";
import { accountTypeLabel } from "@/lib/types/domain";

export const metadata = { title: "Dashboard · Finance OS" };

export default async function DashboardPage() {
  const [{ month, summary }, accounts] = await Promise.all([
    getCurrentMonthSummary(),
    getAccounts(),
  ]);
  const activeAccounts = accounts.filter((a) => !a.is_archived);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {month.label} · opening balances are not counted as income
        </p>
      </div>

      <section aria-label={`${month.label} summary`}>
        <div className="flex flex-col gap-3">
          <StatCard
            featured
            label="Free Cash"
            amount={summary.freeCash}
            hint="Income − Expenses − Capital"
          />
          <StatCard label="Income" amount={summary.income} />
          <StatCard label="Expenses" amount={summary.expenses} />
          <StatCard label="Capital" amount={summary.capital} />
        </div>
      </section>

      <section aria-labelledby="accounts-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="accounts-heading" className="text-lg font-semibold">
            Accounts
          </h2>
          <Link
            href="/accounts"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Manage
          </Link>
        </div>

        {activeAccounts.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="font-medium">No accounts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              <Link href="/accounts" className="underline underline-offset-4">
                Create your first account
              </Link>{" "}
              to start tracking balances.
            </p>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {activeAccounts.map((account) => (
                  <li
                    key={account.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {accountTypeLabel(account.type)}
                      </p>
                    </div>
                    {/* Always accounts.current_balance, never summed from transactions. */}
                    <p className="shrink-0 text-lg font-semibold tabular-nums">
                      {formatMoney(account.current_balance)}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
