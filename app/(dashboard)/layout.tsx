import { redirect } from "next/navigation";

import { MobileNav } from "@/components/layout/mobile-nav";
import { QuickAddButton } from "@/components/layout/quick-add-button";
import { Sidebar } from "@/components/layout/sidebar";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { getAccounts } from "@/lib/queries/accounts";
import { getCategories } from "@/lib/queries/categories";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Second line of defence behind proxy.ts: never render the shell without a user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Quick Add is available on every page, so its form data is loaded here.
  const [accounts, categories] = await Promise.all([
    getAccounts(),
    getCategories(),
  ]);
  const activeAccounts = accounts.filter((a) => !a.is_archived);

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        footer={
          <div className="flex flex-col gap-1">
            <p className="truncate px-3 text-xs text-muted-foreground">
              {user.email}
            </p>
            <SignOutButton className="w-full justify-start" />
          </div>
        }
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone header: brand + sign out. Hidden on desktop (sidebar has both). */}
        <header className="flex h-14 items-center justify-between border-b px-4 md:hidden">
          <span className="text-base font-semibold tracking-tight">
            Finance OS
          </span>
          <SignOutButton showLabel={false} className="size-10" />
        </header>

        {/* On phones the bottom padding clears BOTH the fixed tab bar (3.5rem) and
            the floating Quick Add button above it (bottom 4.5rem + 3.5rem tall), so
            the last row of any page, including its right-hand buttons, stays
            reachable. */}
        <main className="flex-1 px-4 py-6 pb-[calc(9rem+env(safe-area-inset-bottom))] md:px-8 md:py-8 md:pb-8">
          {children}
        </main>
      </div>

      <MobileNav />
      <QuickAddButton accounts={activeAccounts} categories={categories} />
    </div>
  );
}
