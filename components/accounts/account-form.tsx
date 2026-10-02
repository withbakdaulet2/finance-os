"use client";

import { useActionState, useState } from "react";

import {
  createAccount,
  updateAccount,
  type AccountFormState,
} from "@/app/(dashboard)/accounts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ACCOUNT_TYPES, type Account } from "@/lib/types/domain";

const initialState: AccountFormState = { error: null };

// Create (no `account`) or edit (`account` given) in a bottom sheet.
// `children` is the element that opens it, e.g. a <Button>.
export function AccountFormSheet({
  account,
  children,
}: {
  account?: Account;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(account);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit account" : "New account"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Change the name or type. Balances change only through transactions."
              : "Add an account to track a balance."}
          </SheetDescription>
        </SheetHeader>
        {/* Mounted only while open, so its state resets every time. */}
        <AccountFormBody account={account} onDone={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

function AccountFormBody({
  account,
  onDone,
}: {
  account?: Account;
  onDone: () => void;
}) {
  const isEdit = Boolean(account);

  const [state, formAction, pending] = useActionState(
    async (prev: AccountFormState, formData: FormData) => {
      const result = await (isEdit ? updateAccount : createAccount)(
        prev,
        formData,
      );
      if (result.ok) onDone();
      return result;
    },
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 px-4 pb-2">
      {account && <input type="hidden" name="id" value={account.id} />}

      <div className="flex flex-col gap-2">
        <Label htmlFor="account-name">Name</Label>
        <Input
          id="account-name"
          name="name"
          defaultValue={account?.name}
          maxLength={60}
          required
          autoComplete="off"
          placeholder="e.g. Kaspi Gold"
          className="h-11 text-base"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="account-type">Type</Label>
        <NativeSelect
          id="account-type"
          name="type"
          defaultValue={account?.type ?? "cash"}
          className="w-full [&_select]:h-11 [&_select]:text-base"
        >
          {ACCOUNT_TYPES.map((t) => (
            <NativeSelectOption key={t.value} value={t.value}>
              {t.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {!isEdit && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="account-opening-balance">Opening balance</Label>
          <Input
            id="account-opening-balance"
            name="opening_balance"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            className="h-11 text-base"
          />
          <p className="text-xs text-muted-foreground">
            Optional. Recorded as an income transaction dated today, so it
            counts toward this month&apos;s income.
          </p>
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="h-11 text-base"
        disabled={pending}
      >
        {pending ? "Saving…" : isEdit ? "Save changes" : "Create account"}
      </Button>
    </form>
  );
}
