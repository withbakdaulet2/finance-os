"use client";

import { useActionState, useState } from "react";

import {
  createCategory,
  updateCategory,
  type CategoryFormState,
} from "@/app/(dashboard)/categories/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  CATEGORY_TYPES,
  type Category,
  type CategoryType,
} from "@/lib/types/domain";

const initialState: CategoryFormState = { error: null };

type Props =
  | { mode: "create"; type: CategoryType; children: React.ReactNode }
  | { mode: "edit"; category: Category; children: React.ReactNode };

// Bottom sheet to add a custom category of a fixed type, or rename a custom one.
// `children` is the element that opens it, e.g. a <Button>.
export function CategoryFormSheet(props: Props) {
  const [open, setOpen] = useState(false);

  const type = props.mode === "create" ? props.type : props.category.type;
  const typeLabel =
    CATEGORY_TYPES.find((t) => t.value === type)?.singular ?? type;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{props.children}</SheetTrigger>
      <SheetContent
        side="bottom"
        // Radix moves focus to the sheet itself on open and overrides React's
        // autoFocus, so focus the name field explicitly.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("category-name")?.focus();
        }}
        className="mx-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle>
            {props.mode === "edit"
              ? "Rename category"
              : `New ${typeLabel} category`}
          </SheetTitle>
          <SheetDescription>
            {props.mode === "edit"
              ? `Type stays “${typeLabel}”. To change it, create a new category.`
              : "Custom categories can be renamed later."}
          </SheetDescription>
        </SheetHeader>
        {/* Mounted only while open, so its state resets every time. */}
        <CategoryFormBody
          type={type}
          category={props.mode === "edit" ? props.category : undefined}
          onDone={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function CategoryFormBody({
  type,
  category,
  onDone,
}: {
  type: CategoryType;
  category?: Category;
  onDone: () => void;
}) {
  const isEdit = Boolean(category);

  const [state, formAction, pending] = useActionState(
    async (prev: CategoryFormState, formData: FormData) => {
      const result = await (isEdit ? updateCategory : createCategory)(
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
      {category ? (
        <input type="hidden" name="id" value={category.id} />
      ) : (
        <input type="hidden" name="type" value={type} />
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="category-name">Name</Label>
        <Input
          id="category-name"
          name="name"
          defaultValue={category?.name}
          maxLength={60}
          required
          autoComplete="off"
          placeholder="e.g. Groceries"
          className="h-11 text-base"
        />
      </div>

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
        {pending ? "Saving…" : isEdit ? "Save name" : "Add category"}
      </Button>
    </form>
  );
}
