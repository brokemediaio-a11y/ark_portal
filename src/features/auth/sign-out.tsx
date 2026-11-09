"use client";
import { useState } from "react";
export function SignOut() {
  const [error, setError] = useState("");
  return <><button type="button" className="cursor-pointer text-sm underline" onClick={async () => {
    try { const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
      // Full navigation discards the previous account's in-memory document cache.
      if (!response.ok) throw new Error(); window.location.assign(new URL("/login", window.location.origin).href);
    } catch { setError("Could not sign out. Try again."); }
  }}>Sign out</button>{error && <p role="alert">{error}</p>}</>;
}
