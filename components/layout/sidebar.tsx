"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { NAV_ITEMS, isActive } from "./nav-items";

// Desktop navigation (md and up). On phones the bottom MobileNav is used instead.
export function Sidebar({ footer }: { footer?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-r md:bg-background">
      <div className="px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">Finance OS</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive(pathname, href) && "bg-muted text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>

      {footer && <div className="border-t p-3">{footer}</div>}
    </aside>
  );
}
