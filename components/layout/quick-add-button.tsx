"use client";

import { Check, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { AddTransactionSheet } from "@/components/transactions/add-transaction-sheet";
import { Button } from "@/components/ui/button";
import type { Account, Category } from "@/lib/types/domain";

// Floating "add transaction" button, rendered once by the dashboard layout so it
// is one tap away on every dashboard page.
export function QuickAddButton({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: Category[];
}) {
  const [saved, setSaved] = useState(false);

  // Brief confirmation, since the sheet closes and not every page shows the new row.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  return (
    <>
      {saved && (
        <div
          role="status"
          className="fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-[60] mx-auto flex w-fit items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg"
        >
          <Check className="size-4" aria-hidden="true" />
          Transaction added
        </div>
      )}

      <AddTransactionSheet
        accounts={accounts}
        categories={categories}
        onSaved={() => setSaved(true)}
      >
        {/* Sits above the phone bottom nav (3.5rem + safe area); lower on desktop. */}
        <Button
          size="icon-lg"
          aria-label="Add transaction"
          className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-lg md:right-8 md:bottom-8"
        >
          <Plus className="size-6" />
        </Button>
      </AddTransactionSheet>
    </>
  );
}
