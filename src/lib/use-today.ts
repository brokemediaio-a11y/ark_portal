"use client";

import { useSyncExternalStore } from "react";
import { localToday } from "./dates";

const noopSubscribe = () => () => {};

/**
 * Today's local date (YYYY-MM-DD) in the browser, or null while pre-rendering —
 * so a page never bakes in the date it was built on.
 */
export function useToday(): string | null {
  return useSyncExternalStore(noopSubscribe, localToday, () => null);
}
