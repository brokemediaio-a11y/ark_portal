/**
 * Minimal async memoizer for server-side caching of upstream API data:
 * - successful results are kept for `ttlMs`;
 * - concurrent calls for the same key share one in-flight request;
 * - failures are never cached (the next call retries) and keep their error type;
 * - oldest entries are evicted beyond `maxEntries`.
 * Per server instance; swap for a shared store (e.g. Redis) when scaling out.
 *
 * Pass `name` to keep the entries on globalThis, so they survive dev hot reloads
 * (otherwise every code edit would re-spend upstream quota).
 */
export function createTtlCache<T>({ ttlMs, maxEntries = 500, name }: { ttlMs: number; maxEntries?: number; name?: string }) {
  type Store = { entries: Map<string, { value: T; expiresAt: number }>; inFlight: Map<string, Promise<T>> };
  const fresh = (): Store => ({ entries: new Map(), inFlight: new Map() });
  const globalKey = name ? Symbol.for(`ark.ttl-cache.${name}`) : null;
  const holder = globalThis as Record<symbol, Store | undefined>;
  const store = globalKey ? (holder[globalKey] ??= fresh()) : fresh();
  const { entries, inFlight } = store;

  return async function cached(key: string, load: () => Promise<T>): Promise<T> {
    const hit = entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const pending = inFlight.get(key);
    if (pending) return pending;

    const request = load()
      .then((value) => {
        entries.delete(key);
        entries.set(key, { value, expiresAt: Date.now() + ttlMs });
        while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
        return value;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, request);
    return request;
  };
}
