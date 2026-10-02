import {
  ArrowLeftRight,
  LayoutDashboard,
  Tags,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// V1 navigation only. Do not add entries for later versions.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/categories", label: "Categories", icon: Tags },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
