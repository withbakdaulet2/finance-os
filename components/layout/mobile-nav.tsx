"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { NAV_ITEMS, isActive } from "./nav-items";

// Phone navigation: fixed bottom tab bar, hidden from md up.
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors",
                  active && "text-foreground",
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
