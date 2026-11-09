"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { PortalUser } from "./permissions";
export const AuthContext = createContext<PortalUser | null>(null);
export const usePortalUser = () => useContext(AuthContext);
export function AuthProvider({ user, children }: { user: PortalUser; children: ReactNode }) { return <AuthContext value={user}>{children}</AuthContext>; }
