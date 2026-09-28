/**
 * Fixed-window counters for the demo endpoint's abuse limits.
 *
 * Two implementations share one tiny interface:
 *   incr(key, ttlSeconds) -> Promise<number>   new value (key created with TTL)
 *   get(keys)             -> Promise<number[]> current values (0 when absent)
 *
 * - Upstash Redis REST (what Vercel's KV / "Upstash for Redis" integration
 *   provisions): used when KV_REST_API_URL + KV_REST_API_TOKEN are set.
 *   Plain fetch against the documented /pipeline endpoint, no SDK. Counts
 *   are global across every function instance and region.
 * - In-memory Map: fallback when no KV is configured. Counts are PER
 *   INSTANCE and reset on cold start, so the handler applies a lower
 *   ceiling to the daily cap in this mode (see demoHandler.js).
 */

const KV_TIMEOUT_MS = 5000;
const MEMORY_SWEEP_THRESHOLD = 10000;

/**
 * @param {{ url: string, token: string, fetch: typeof fetch }} options
 */
export function createUpstashStore({ url, token, fetch: fetchImpl }) {
    const endpoint = `${url.replace(/\/+$/, '')}/pipeline`;

    async function pipeline(commands) {
        const res = await fetchImpl(endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(commands),
            signal: AbortSignal.timeout(KV_TIMEOUT_MS)
        });
        if (!res.ok) throw new Error(`KV HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data) || data.length !== commands.length) {
            throw new Error('KV returned an unexpected response');
        }
        for (const item of data) {
            if (item && item.error) throw new Error(`KV command failed: ${item.error}`);
        }
        return data.map(item => item?.result ?? null);
    }

    return {
        kind: 'kv',
        async incr(key, ttlSeconds) {
            // SET NX EX creates the key with its TTL exactly once per window;
            // INCR never resets that TTL.
            const [, value] = await pipeline([
                ['SET', key, '0', 'EX', String(ttlSeconds), 'NX'],
                ['INCR', key]
            ]);
            const count = Number(value);
            if (!Number.isFinite(count)) throw new Error('KV INCR returned a non-number');
            return count;
        },
        async get(keys) {
            const values = await pipeline(keys.map(key => ['GET', key]));
            return values.map(value => Number(value) || 0);
        }
    };
}

/**
 * @param {{ now: () => number }} options
 */
export function createMemoryStore({ now }) {
    const entries = new Map(); // key -> { count, expiresAt }

    function live(key) {
        const entry = entries.get(key);
        if (!entry) return null;
        if (entry.expiresAt <= now()) {
            entries.delete(key);
            return null;
        }
        return entry;
    }

    function sweep() {
        const t = now();
        for (const [key, entry] of entries) {
            if (entry.expiresAt <= t) entries.delete(key);
        }
    }

    return {
        kind: 'memory',
        async incr(key, ttlSeconds) {
            let entry = live(key);
            if (!entry) {
                if (entries.size >= MEMORY_SWEEP_THRESHOLD) sweep();
                entry = { count: 0, expiresAt: now() + ttlSeconds * 1000 };
                entries.set(key, entry);
            }
            entry.count += 1;
            return entry.count;
        },
        async get(keys) {
            return keys.map(key => live(key)?.count ?? 0);
        }
    };
}
