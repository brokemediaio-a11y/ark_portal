import { FileStack, FilePlus2, Home, Search, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  /** One plain sentence under the label, so nobody has to guess what the page is for. */
  hint: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Home", hint: "Start here", icon: Home },
  { href: "/quotations/new", label: "From supplier quote", hint: "Upload a PDF or screenshot", icon: FilePlus2 },
  { href: "/flights/search", label: "Search flights", hint: "Find fares yourself", icon: Search },
  { href: "/quotations", label: "My quotations", hint: "Continue or download", icon: FileStack },
];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/quotations") return pathname === "/quotations" || (pathname.startsWith("/quotations/") && pathname !== "/quotations/new");
  return pathname === href || pathname.startsWith(`${href}/`);
}
