"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseAmountInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { isAccountType } from "@/lib/types/domain";

export type AccountFormState = { error: string | null; ok?: boolean };

const NAME_MAX_LENGTH = 60;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Server Functions are public POST endpoints: check the session here, do not
// rely on proxy.ts or the page that rendered the form.
async function requireSupabase() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

function readName(formData: FormData): string | null {
  const name = String(formData.get("name") ?? "").trim();
  return name.length > 0 && name.length <= NAME_MAX_LENGTH ? name : null;
}

function revalidateAccountViews() {
  // The dashboard layout feeds accounts to the Quick Add form, so refresh every page.
  revalidatePath("/", "layout");
}

export async function createAccount(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const supabase = await requireSupabase();

  const name = readName(formData);
  if (!name) {
    return { error: `Enter a name (up to ${NAME_MAX_LENGTH} characters).` };
  }

  const type = String(formData.get("type") ?? "");
  if (!isAccountType(type)) {
    return { error: "Choose an account type." };
  }

  // Empty = 0. Anything else must be a valid amount.
  const rawBalance = String(formData.get("opening_balance") ?? "").trim();
  let openingBalance = "0";
  if (rawBalance !== "") {
    const parsed = parseAmountInput(rawBalance);
    if (!parsed.ok) {
      return {
        error:
          "Opening balance must be a number like 1500 or 1500.50 (no negatives, max 2 decimals).",
      };
    }
    openingBalance = parsed.value;
  }

  // One database transaction: the account and its opening income transaction
  // are created together or not at all.
  const { error } = await supabase.rpc("create_account", {
    p_name: name,
    p_type: type,
    p_opening_balance: openingBalance,
  });

  if (error) {
    console.error("create_account failed", error);
    return { error: "Could not create the account. Please try again." };
  }

  revalidateAccountViews();
  return { error: null, ok: true };
}

export async function updateAccount(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const supabase = await requireSupabase();

  const id = String(formData.get("id") ?? "");
  if (!UUID_PATTERN.test(id)) {
    return { error: "Account not found." };
  }

  const name = readName(formData);
  if (!name) {
    return { error: `Enter a name (up to ${NAME_MAX_LENGTH} characters).` };
  }

  const type = String(formData.get("type") ?? "");
  if (!isAccountType(type)) {
    return { error: "Choose an account type." };
  }

  // current_balance is not writable by clients (column privileges), only name/type.
  const { data, error } = await supabase
    .from("accounts")
    .update({ name, type })
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("update account failed", error);
    return { error: "Could not save changes. Please try again." };
  }
  if (data.length === 0) {
    return { error: "Account not found." };
  }

  revalidateAccountViews();
  return { error: null, ok: true };
}

export async function setAccountArchived(formData: FormData): Promise<void> {
  const supabase = await requireSupabase();

  const id = String(formData.get("id") ?? "");
  const archived = formData.get("archived") === "true";
  if (!UUID_PATTERN.test(id)) {
    throw new Error("Invalid account id.");
  }

  const { data, error } = await supabase
    .from("accounts")
    .update({ is_archived: archived })
    .eq("id", id)
    .select("id");

  if (error || data.length === 0) {
    console.error("archive account failed", error);
    throw new Error("Could not update the account.");
  }

  revalidateAccountViews();
}
