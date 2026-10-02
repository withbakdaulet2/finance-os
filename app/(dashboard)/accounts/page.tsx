import { Plus } from "lucide-react";

import { AccountCard } from "@/components/accounts/account-card";
import { AccountFormSheet } from "@/components/accounts/account-form";
import { Button } from "@/components/ui/button";
import { getAccounts } from "@/lib/queries/accounts";

export const metadata = { title: "Accounts · Finance OS" };

export default async function AccountsPage() {
  const accounts = await getAccounts();
  const active = accounts.filter((a) => !a.is_archived);
  const archived = accounts.filter((a) => a.is_archived);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <AccountFormSheet>
          <Button size="lg" className="h-11 md:h-9">
            <Plus />
            New account
          </Button>
        </AccountFormSheet>
      </div>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">No accounts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first account to start tracking balances.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {active.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground select-none">
            Archived ({archived.length})
          </summary>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {archived.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
