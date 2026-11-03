import { afterEach, describe, expect, it, vi } from "vitest";
import { createTtlCache } from "./ttl-cache";

afterEach(() => vi.useRealTimers());

describe("createTtlCache", () => {
  it("returns cached values until they expire", async () => {
    vi.useFakeTimers();
    const cache = createTtlCache<number>({ ttlMs: 1000 });
    const load = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    expect(await cache("k", load)).toBe(1);
    expect(await cache("k", load)).toBe(1);
    vi.advanceTimersByTime(1001);
    expect(await cache("k", load)).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight request between concurrent callers", async () => {
    const cache = createTtlCache<number>({ ttlMs: 1000 });
    const load = vi.fn(() => new Promise<number>((r) => setTimeout(() => r(7), 10)));
    expect(await Promise.all([cache("k", load), cache("k", load)])).toEqual([7, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures and keeps the error type", async () => {
    class MyError extends Error {}
    const cache = createTtlCache<number>({ ttlMs: 1000 });
    await expect(cache("k", () => Promise.reject(new MyError("x")))).rejects.toBeInstanceOf(MyError);
    expect(await cache("k", () => Promise.resolve(3))).toBe(3);
  });

  it("evicts the oldest entries beyond the limit", async () => {
    const cache = createTtlCache<number>({ ttlMs: 1000, maxEntries: 1 });
    await cache("a", async () => 1);
    await cache("b", async () => 2);
    const load = vi.fn(async () => 9);
    expect(await cache("a", load)).toBe(9);
  });
});
