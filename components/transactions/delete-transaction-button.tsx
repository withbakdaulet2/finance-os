"use client";

import { Trash2 } from "lucide-react";

import { deleteTransaction } from "@/app/(dashboard)/transactions/actions";
import { Button } from "@/components/ui/button";

// V1 has no editing: delete and re-add to fix a mistake.
export function DeleteTransactionButton({ id }: { id: string }) {
  return (
    <form
      action={deleteTransaction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Delete this transaction? The account balance will be adjusted back.",
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        aria-label="Delete transaction"
        // 40px touch target on phones, compact on desktop.
        className="size-10 text-muted-foreground hover:text-destructive md:size-7"
      >
        <Trash2 />
      </Button>
    </form>
  );
}
