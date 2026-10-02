import { CategoryList } from "@/components/categories/category-list";
import { getCategories } from "@/lib/queries/categories";

export const metadata = { title: "Categories · Finance OS" };

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          System categories are fixed. Add your own for anything else.
        </p>
      </div>

      <CategoryList categories={categories} />
    </div>
  );
}
