import { FileStack, FilePlus2, Home, Search, Ticket, TicketCheck, Users, type LucideIcon } from "lucide-react";

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
  { href: "/tickets/new", label: "Convert a ticket", hint: "Supplier ticket to Ark e-ticket", icon: TicketCheck },
  { href: "/quotations", label: "My quotations", hint: "Continue or download", icon: FileStack },
  { href: "/tickets", label: "My tickets", hint: "Ark e-tickets you made", icon: Ticket },
  { href: "/admin/users", label: "Users & access", hint: "Manage your team", icon: Users },
];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // A list page also covers its records, but not its "new" page, which has its own menu item.
  if (href === "/quotations" || href === "/tickets") return pathname === href || (pathname.startsWith(`${href}/`) && pathname !== `${href}/new`);
  return pathname === href || pathname.startsWith(`${href}/`);
}
