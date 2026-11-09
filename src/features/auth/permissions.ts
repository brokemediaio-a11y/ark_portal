export const ROLES = {
  converter: { label: "PDF Converter", description: "Upload, edit and download their own branded quotations and e-tickets." },
  agent: { label: "Travel Agent", description: "PDF conversion plus flight search. Own documents only." },
  manager: { label: "Manager", description: "All portal tools and deletion of their own documents. No access to other employees’ records." },
  admin: { label: "Administrator", description: "Full access, including user accounts, roles, password resets and activity." },
} as const;

export type Role = keyof typeof ROLES;
export type Permission = "documents" | "flights" | "team" | "delete" | "users";
const grants: Record<Role, readonly Permission[]> = {
  converter: ["documents"], agent: ["documents", "flights"],
  manager: ["documents", "flights", "delete"],
  admin: ["documents", "flights", "team", "delete", "users"],
};
export function can(role: Role, permission: Permission) { return grants[role]?.includes(permission) ?? false; }
export function canVisit(role: Role, path: string) {
  if (path.startsWith("/admin")) return can(role, "users");
  if (path.startsWith("/flights")) return can(role, "flights");
  return true;
}
export interface PortalUser { id: string; name: string; email: string; role: Role; active: boolean; mustChangePassword: boolean }
