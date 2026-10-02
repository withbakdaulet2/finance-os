"use server";

import { revalidatePath } from "next/cache";

import { isValidDateString } from "@/lib/dates";
import { parseAmountInput } from "@/lib/money";
import { requireUser } from "@/lib/supabase/require-user";
import { categoryTypeFor, isTransactionType } from "@/lib/types/domain";
import { isUuid } from "@/lib/validation";

export type TransactionFormState = { error: string | null; ok?: boolean };

const NOTE_MAX_LENGTH = 200;

// Postgres error codes raised by the schema (see migrations).
const INSUFFICIENT_PRIVILEGE = "42501"; // account/category not owned by the user
// e.g. capital allocation to the same account, or a category of the wrong kind
const CHECK_VIOLATION = "23514";

// A transaction changes balances, which are shown on every page.
function revalidateEverything() {
  revalidatePath("/", "layout");
}

export async function createTransaction(
  _prev: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const { supabase, user } = await requireUser();

  const type = String(formData.get("type") ?? "");
  if (!isTransactionType(type)) {
    return { error: "Choose a transaction type." };
  }

  const amountInput = parseAmountInput(String(formData.get("amount") ?? ""));
  if (!amountInput.ok || Number(amountInput.value) <= 0) {
    return {
      error:
        "Enter an amount greater than 0, like 1500 or 1500.50 (max 2 decimals).",
    };
  }
  // Up to 12 integer digits + 2 decimals is exact as a JS number and serializes back
  // to the same digits, so PostgREST receives precisely what the user typed.
  const amount = Number(amountInput.value);

  const accountId = String(formData.get("account_id") ?? "");
  if (!isUuid(accountId)) {
    return { error: "Choose an account." };
  }

  let targetAccountId: string | null = null;
  if (type === "capital_allocation") {
    targetAccountId = String(formData.get("target_account_id") ?? "");
    if (!isUuid(targetAccountId)) {
      return { error: "Choose the account to move the money to." };
    }
    if (targetAccountId === accountId) {
      return { error: "Choose two different accounts." };
    }
  }

  const rawCategory = String(formData.get("category_id") ?? "");
  let categoryId: string | null = null;
  if (rawCategory !== "") {
    if (!isUuid(rawCategory)) return { error: "Choose a valid category." };
    categoryId = rawCategory;
  }

  const occurredOn = String(formData.get("occurred_on") ?? "");
  if (!isValidDateString(occurredOn)) {
    return { error: "Choose a valid date." };
  }

  const note = String(formData.get("note") ?? "").trim();
  if (note.length > NOTE_MAX_LENGTH) {
    return { error: `Note is too long (max ${NOTE_MAX_LENGTH} characters).` };
  }

  // The database enforces ownership and that the category kind matches the
  // transaction type (the checks below only give friendlier messages). It does
  // not know about archived accounts, so that one is checked here.
  const accountIds = [accountId, ...(targetAccountId ? [targetAccountId] : [])];
  const [accountsResult, categoryResult] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, is_archived")
      .in("id", accountIds),
    categoryId
      ? supabase
          .from("categories")
          .select("id, type")
          .eq("id", categoryId)
          .maybeSingle()
      : Promise.resolve(null),
  ]);

  if (accountsResult.error || (categoryResult && categoryResult.error)) {
    console.error("transaction pre-check failed", accountsResult.error);
    return { error: "Could not save the transaction. Please try again." };
  }
  if (
    accountsResult.data.length !== accountIds.length ||
    accountsResult.data.some((a) => a.is_archived)
  ) {
    return { error: "Choose an active account." };
  }
  if (categoryResult) {
    if (!categoryResult.data) return { error: "Choose a valid category." };
    if (categoryResult.data.type !== categoryTypeFor(type)) {
      return { error: "That category does not match the transaction type." };
    }
  }

  // The balance is moved by the database trigger in this same statement:
  // never update accounts.current_balance from here.
  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    type,
    amount,
    account_id: accountId,
    target_account_id: targetAccountId,
    category_id: categoryId,
    occurred_on: occurredOn,
    note: note === "" ? null : note,
  });

  if (error) {
    console.error("create transaction failed", error);
    if (error.code === INSUFFICIENT_PRIVILEGE) {
      return { error: "That account or category is not available." };
    }
    if (error.code === CHECK_VIOLATION) {
      return { error: "Check the amount, the accounts and the category." };
    }
    return { error: "Could not save the transaction. Please try again." };
  }

  revalidateEverything();
  return { error: null, ok: true };
}

// V1 has no editing: to fix a mistake, delete and re-add. The database trigger
// reverses the balance in the same statement.
export async function deleteTransaction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) {
    throw new Error("Invalid transaction id.");
  }

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .select("id");

  if (error || data.length === 0) {
    console.error("delete transaction failed", error);
    throw new Error("Could not delete the transaction.");
  }

  revalidateEverything();
}
