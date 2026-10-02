"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/supabase/require-user";
import { isCategoryType } from "@/lib/types/domain";
import { isUuid } from "@/lib/validation";

export type CategoryFormState = { error: string | null; ok?: boolean };

const NAME_MAX_LENGTH = 60; // also enforced by a CHECK constraint in the database
const UNIQUE_VIOLATION = "23505";

function readName(formData: FormData): string | null {
  const name = String(formData.get("name") ?? "").trim();
  return name.length > 0 && name.length <= NAME_MAX_LENGTH ? name : null;
}

function revalidateCategoryViews() {
  // The dashboard layout feeds categories to the Quick Add form, so refresh every page.
  revalidatePath("/", "layout");
}

export async function createCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const { supabase, user } = await requireUser();

  const name = readName(formData);
  if (!name) {
    return { error: `Enter a name (up to ${NAME_MAX_LENGTH} characters).` };
  }

  const type = String(formData.get("type") ?? "");
  if (!isCategoryType(type)) {
    return { error: "Unknown category type." };
  }

  // user_id has no default in the schema, so it is set explicitly. RLS then
  // requires it to equal auth.uid(), and rejects is_system rows from clients.
  const { error } = await supabase
    .from("categories")
    .insert({ user_id: user.id, name, type });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: "A category with this name already exists." };
    }
    console.error("create category failed", error);
    return { error: "Could not create the category. Please try again." };
  }

  revalidateCategoryViews();
  return { error: null, ok: true };
}

export async function updateCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) {
    return { error: "Category not found." };
  }

  const name = readName(formData);
  if (!name) {
    return { error: `Enter a name (up to ${NAME_MAX_LENGTH} characters).` };
  }

  // Only the name is editable. RLS also makes system categories invisible to
  // UPDATE, so touching one matches zero rows instead of changing it.
  const { data, error } = await supabase
    .from("categories")
    .update({ name })
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: "A category with this name already exists." };
    }
    console.error("update category failed", error);
    return { error: "Could not save changes. Please try again." };
  }
  if (data.length === 0) {
    return { error: "This category cannot be edited." };
  }

  revalidateCategoryViews();
  return { error: null, ok: true };
}
