import { Lock, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CATEGORY_TYPES, type Category } from "@/lib/types/domain";

import { CategoryFormSheet } from "./category-form";

// Categories grouped by type. System categories are read-only (the database
// enforces it); custom ones can be renamed.
export function CategoryList({ categories }: { categories: Category[] }) {
  return (
    <div className="flex flex-col gap-8">
      {CATEGORY_TYPES.map(({ value, label }) => {
        const items = categories.filter((c) => c.type === value);

        return (
          <section key={value} aria-labelledby={`categories-${value}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2
                id={`categories-${value}`}
                className="text-lg font-semibold tracking-tight"
              >
                {label}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {items.length}
                </span>
              </h2>
              <CategoryFormSheet mode="create" type={value}>
                <Button variant="outline" size="sm" className="h-10 md:h-7">
                  <Plus />
                  Add
                </Button>
              </CategoryFormSheet>
            </div>

            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                No categories yet.
              </p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {items.map((category) => (
                  <li
                    key={category.id}
                    className="flex min-h-12 items-center justify-between gap-3 px-4 py-2"
                  >
                    <span className="min-w-0 truncate">{category.name}</span>

                    {category.is_system ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <Lock className="size-3.5" aria-hidden="true" />
                        System
                      </span>
                    ) : (
                      <CategoryFormSheet mode="edit" category={category}>
                        <Button variant="ghost" size="sm" className="h-10 md:h-7">
                          <Pencil />
                          Rename
                        </Button>
                      </CategoryFormSheet>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
