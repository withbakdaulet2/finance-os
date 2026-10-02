"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  createTransaction,
  type TransactionFormState,
} from "@/app/(dashboard)/transactions/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { todayInAlmaty } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import {
  TRANSACTION_TYPES,
  categoryTypeFor,
  type Account,
  type Category,
  type TransactionType,
} from "@/lib/types/domain";

const initialState: TransactionFormState = { error: null };

// Controls sized for thumbs: the form is meant to be used one-handed on a phone.
const selectClass = "w-full [&_select]:h-11 [&_select]:text-base";

type Props = {
  accounts: Account[]; // active accounts only
  categories: Category[];
  onSaved?: () => void;
  children: React.ReactNode; // the element that opens the sheet
};

export function AddTransactionSheet({
  accounts,
  categories,
  onSaved,
  children,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        // Radix would focus the first control (the type switch); the amount is
        // what the user types first.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("tx-amount")?.focus();
        }}
      >
        <SheetHeader>
          <SheetTitle>Add transaction</SheetTitle>
          <SheetDescription>
            Balances update automatically when you save.
          </SheetDescription>
        </SheetHeader>

        {accounts.length === 0 ? (
          <div className="flex flex-col gap-3 px-4 pb-2">
            <p className="text-sm text-muted-foreground">
              Create an account first, then you can record transactions.
            </p>
            <SheetClose asChild>
              <Button asChild size="lg" className="h-11 text-base">
                <Link href="/accounts">Go to Accounts</Link>
              </Button>
            </SheetClose>
          </div>
        ) : (
          // Mounted only while open: fields (and today's date) reset every time.
          <AddTransactionForm
            accounts={accounts}
            categories={categories}
            onDone={() => {
              setOpen(false);
              onSaved?.();
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function AddTransactionForm({
  accounts,
  categories,
  onDone,
}: {
  accounts: Account[];
  categories: Category[];
  onDone: () => void;
}) {
  const [type, setType] = useState<TransactionType>("expense");
  const [accountId, setAccountId] = useState(accounts[0].id);
  const [targetId, setTargetId] = useState("");

  const [state, formAction, pending] = useActionState(
    async (prev: TransactionFormState, formData: FormData) => {
      const result = await createTransaction(prev, formData);
      if (result.ok) onDone();
      return result;
    },
    initialState,
  );

  const isCapital = type === "capital_allocation";
  const categoryOptions = categories.filter(
    (c) => c.type === categoryTypeFor(type),
  );

  // The destination can never be the source account. Derived, not synced, so
  // changing "from" can never leave a stale or equal "to".
  const targetOptions = accounts.filter((a) => a.id !== accountId);
  const targetValue = targetOptions.some((a) => a.id === targetId)
    ? targetId
    : (targetOptions[0]?.id ?? "");
  const needsSecondAccount = isCapital && targetOptions.length === 0;

  return (
    <form action={formAction} className="flex flex-col gap-4 px-4 pb-2">
      {/* 1. Type */}
      <div
        role="radiogroup"
        aria-label="Transaction type"
        className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
      >
        {TRANSACTION_TYPES.map((t) => (
          <label
            key={t.value}
            className="flex h-10 cursor-pointer items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-colors has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name="type"
              value={t.value}
              checked={type === t.value}
              onChange={() => setType(t.value)}
              className="sr-only"
            />
            {t.label}
          </label>
        ))}
      </div>

      {/* 2. Amount */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="tx-amount">Amount</Label>
        <Input
          id="tx-amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          required
          className="h-14 text-2xl font-semibold tabular-nums"
        />
      </div>

      {/* 3. Category (optional; options follow the type) */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="tx-category">Category</Label>
        <NativeSelect
          // New key per type: the previous type's selection never carries over.
          key={type}
          id="tx-category"
          name="category_id"
          defaultValue=""
          className={selectClass}
        >
          <NativeSelectOption value="">No category</NativeSelectOption>
          {categoryOptions.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {/* 4. Account(s) */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="tx-account">{isCapital ? "From account" : "Account"}</Label>
        <NativeSelect
          id="tx-account"
          name="account_id"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          required
          className={selectClass}
        >
          {accounts.map((a) => (
            <NativeSelectOption key={a.id} value={a.id}>
              {a.name} · {formatMoney(a.current_balance)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {isCapital && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="tx-target">To account</Label>
          {needsSecondAccount ? (
            <p className="text-sm text-muted-foreground">
              Moving money needs a second account.{" "}
              <SheetClose asChild>
                <Link href="/accounts" className="underline underline-offset-4">
                  Create one
                </Link>
              </SheetClose>
            </p>
          ) : (
            <NativeSelect
              id="tx-target"
              name="target_account_id"
              value={targetValue}
              onChange={(e) => setTargetId(e.target.value)}
              required
              className={selectClass}
            >
              {targetOptions.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.name} · {formatMoney(a.current_balance)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </div>
      )}

      {/* Date + note: defaults are right for the common case */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tx-date">Date</Label>
          <Input
            id="tx-date"
            name="occurred_on"
            type="date"
            required
            defaultValue={todayInAlmaty()}
            className="h-11 text-base"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tx-note">Note</Label>
          <Input
            id="tx-note"
            name="note"
            maxLength={200}
            autoComplete="off"
            placeholder="Optional"
            className="h-11 text-base"
          />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="h-12 text-base"
        disabled={pending || needsSecondAccount}
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
