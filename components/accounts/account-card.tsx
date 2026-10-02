import { Archive, ArchiveRestore, Pencil } from "lucide-react";

import { setAccountArchived } from "@/app/(dashboard)/accounts/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { accountTypeLabel, type Account } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

import { AccountFormSheet } from "./account-form";

export function AccountCard({ account }: { account: Account }) {
  return (
    <Card className={cn(account.is_archived && "opacity-70")}>
      <CardContent className="flex flex-col gap-4">
        <div className="min-w-0">
          <p className="truncate text-base font-medium">{account.name}</p>
          <p className="text-sm text-muted-foreground">
            {accountTypeLabel(account.type)}
          </p>
        </div>

        <p className="text-2xl font-semibold tracking-tight tabular-nums break-words sm:text-3xl">
          {formatMoney(account.current_balance)}
        </p>

        <div className="flex items-center justify-end gap-1">
          <AccountFormSheet account={account}>
            <Button variant="ghost" size="sm" className="h-10 md:h-7">
              <Pencil />
              Edit
            </Button>
          </AccountFormSheet>

          <form action={setAccountArchived}>
            <input type="hidden" name="id" value={account.id} />
            <input
              type="hidden"
              name="archived"
              value={account.is_archived ? "false" : "true"}
            />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-10 md:h-7"
            >
              {account.is_archived ? <ArchiveRestore /> : <Archive />}
              {account.is_archived ? "Restore" : "Archive"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
