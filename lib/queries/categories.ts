import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types/domain";

// System categories first, then custom ones; alphabetical inside each group.
export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("is_system", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load categories: ${error.message}`);
  }

  return data;
}
