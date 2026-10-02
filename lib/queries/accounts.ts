import { createClient } from "@/lib/supabase/server";
import type { Account } from "@/lib/types/domain";

// Balances are always read from accounts.current_balance (maintained by the
// database trigger), never summed from transactions.
export async function getAccounts(): Promise<Account[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load accounts: ${error.message}`);
  }

  return data;
}
