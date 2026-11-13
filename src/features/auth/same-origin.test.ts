import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }) }));

import { sameOrigin } from "./server";

const post = (headers: Record<string, string>, url = "http://127.0.0.1:3000/api/auth") =>
  new Request(url, { method: "POST", headers });

describe("sameOrigin", () => {
  it("accepts a request whose origin matches the URL", () => {
    expect(sameOrigin(post({ origin: "http://127.0.0.1:3000" }))).toBe(true);
  });

  it("accepts the https origin forwarded by the reverse proxy", () => {
    expect(sameOrigin(post({
      origin: "https://portal.example.com", "x-forwarded-proto": "https", "x-forwarded-host": "portal.example.com",
    }))).toBe(true);
  });

  it("falls back to the Host header when the proxy sends no forwarded host", () => {
    expect(sameOrigin(post({ origin: "https://portal.example.com", "x-forwarded-proto": "https", host: "portal.example.com" }))).toBe(true);
  });

  it("rejects a different origin even behind the proxy", () => {
    expect(sameOrigin(post({
      origin: "https://evil.example.net", "x-forwarded-proto": "https", "x-forwarded-host": "portal.example.com",
    }))).toBe(false);
  });

  it("rejects a plain http origin when the proxy forwarded https", () => {
    expect(sameOrigin(post({
      origin: "http://portal.example.com", "x-forwarded-proto": "https", "x-forwarded-host": "portal.example.com",
    }))).toBe(false);
  });

  it("rejects a request without an origin header", () => {
    expect(sameOrigin(post({}))).toBe(false);
  });
});
