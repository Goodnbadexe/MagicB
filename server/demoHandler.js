/**
 * MagicB free demo: server-side Gemini generation paid for by the site owner.
 *
 * Mounted by api/generate.js as a Vercel Function (web-standard
 * Request -> Response). Everything here is written to FAIL CLOSED: when
 * something is missing or broken, visitors get 503 { demo: "unavailable" }
 * and the client falls back to bring-your-own-key mode.
 *
 *   GET  /api/generate  -> { demo: "available", limit, remaining } (no cost)
 *   POST /api/generate  { "prompt": "..." }
 *        -> { candidates: [{ content: { parts: [{ text }] } }], demo: {...} }
 *           i.e. the Gemini response shape the client already parses.
 *
 * Abuse protection, in order:
 *   1. GEMINI_API_KEY must be set (else 503).
 *   2. POST must come from an allowed Origin (Referer as fallback):
 *      ALLOWED_ORIGINS + this deployment's own VERCEL_* URLs, plus
 *      http://localhost / 127.0.0.1 outside production. This stops other
 *      sites from spending the quota through their visitors' browsers; it
 *      is NOT authentication (curl can forge headers) - the limits are.
 *   3. Strict body: JSON object with exactly one string field "prompt",
 *      1..MAX_PROMPT_CHARS characters, body <= 16 KiB.
 *   4. Per-IP limit (5 per fixed one-hour window, first x-forwarded-for hop,
 *      which Vercel overwrites so clients cannot spoof it).
 *   5. Global daily cap (DEMO_DAILY_CAP, default 50).
 *   6. Output capped at MAX_OUTPUT_TOKENS, upstream call timed out, and
 *      upstream error bodies are logged server-side only.
 */

import { createHmac } from 'node:crypto';
import { analyzePrompt } from '../src/core/PromptAnalyzer.js';
import {
    DEFAULT_MODEL,
    MAX_OUTPUT_TOKENS,
    MAX_PROMPT_CHARS,
    buildGenerateBody,
    cleanGeneratedHtml,
    extractText,
    geminiEndpoint,
    isValidModelId,
    looksLikeHtml
} from '../src/shared/gemini.js';
import { createMemoryStore, createUpstashStore } from './counterStore.js';

export const MAX_BODY_BYTES = 16 * 1024;
export const DEFAULT_DAILY_CAP = 50;
export const DEFAULT_IP_LIMIT = 5;
export const DEFAULT_IP_WINDOW_SECONDS = 60 * 60;
/** Without KV every instance counts on its own, so cap each one lower. */
export const MEMORY_DAILY_CEILING = 20;
export const UPSTREAM_TIMEOUT_MS = 45000;

const KEY_PREFIX = 'magicb:demo';

/**
 * @param {Object} [options]
 * @param {Record<string, string|undefined>} [options.env] - defaults to process.env (read per request)
 * @param {typeof fetch} [options.fetch] - used for Gemini and KV calls
 * @param {() => number} [options.now]
 * @param {Pick<Console, 'error'|'warn'>} [options.logger]
 * @returns {(request: Request) => Promise<Response>}
 */
export function createDemoHandler(options = {}) {
    const {
        env = process.env,
        fetch: fetchImpl = (...args) => globalThis.fetch(...args),
        now = Date.now,
        logger = console,
        ipLimit = DEFAULT_IP_LIMIT,
        ipWindowSeconds = DEFAULT_IP_WINDOW_SECONDS,
        memoryDailyCeiling = MEMORY_DAILY_CEILING,
        upstreamTimeoutMs = UPSTREAM_TIMEOUT_MS,
        maxOutputTokens = MAX_OUTPUT_TOKENS
    } = options;

    let store = null;
    let storeSignature = null;

    function getStore(kv) {
        const signature = kv ? `kv:${kv.url}` : 'memory';
        if (store && storeSignature === signature) return store;
        storeSignature = signature;
        if (kv) {
            store = createUpstashStore({ url: kv.url, token: kv.token, fetch: fetchImpl });
        } else {
            logger.warn(
                '[demo] KV_REST_API_URL/KV_REST_API_TOKEN not set: using per-instance in-memory ' +
                `rate limits with the daily cap lowered to at most ${memoryDailyCeiling} per instance.`
            );
            store = createMemoryStore({ now });
        }
        return store;
    }

    async function handle(request) {
        const method = request.method.toUpperCase();
        if (method !== 'GET' && method !== 'POST') {
            return json(405, { error: 'method_not_allowed' }, { Allow: 'GET, POST' });
        }

        const config = readConfig(env);
        if (!config.apiKey) return unavailable();
        if (!isValidModelId(config.model)) {
            logger.error('[demo] GEMINI_MODEL is not a valid model id; demo disabled.');
            return unavailable();
        }

        const origin = requestOrigin(request);
        const originAllowed = origin !== null && isAllowedOrigin(origin, config);
        if (method === 'POST' ? !originAllowed : request.headers.has('origin') && !originAllowed) {
            return json(403, { error: 'origin_not_allowed' });
        }

        const counterStore = getStore(config.kv);
        const dailyCap = counterStore.kind === 'memory'
            ? Math.min(config.dailyCap, memoryDailyCeiling)
            : config.dailyCap;
        const window = currentWindows(now(), ipWindowSeconds);
        const ipKey = `${KEY_PREFIX}:ip:${hashIp(clientIp(request), config.apiKey)}:${window.ipBucket}`;
        const dayKey = `${KEY_PREFIX}:day:${window.day}`;

        /**
         * What this visitor has left. Whenever nothing is left, say which
         * limit ran out and when it resets, so clients know when to retry.
         */
        function quota(ipCount, dayCount) {
            const ipLeft = ipLimit - ipCount;
            const dayLeft = dailyCap - dayCount;
            const remaining = Math.max(0, Math.min(ipLeft, dayLeft));
            if (remaining > 0) return { limit: ipLimit, remaining };
            const daily = dayLeft <= 0;
            const retryAfter = Math.max(
                ipLeft <= 0 ? window.ipRetryAfter : 0,
                daily ? window.dayRetryAfter : 0
            );
            return { limit: ipLimit, remaining: 0, reason: daily ? 'daily' : 'ip', retryAfter };
        }

        if (method === 'GET') {
            let counts;
            try {
                counts = await counterStore.get([ipKey, dayKey]);
            } catch (err) {
                logger.error('[demo] counter store unavailable:', err?.message || err);
                return unavailable();
            }
            const [ipCount, dayCount] = counts;
            return json(200, { demo: 'available', ...quota(ipCount, dayCount) });
        }

        // ---- POST: validate before spending anything ----
        const contentType = request.headers.get('content-type') || '';
        if (!/^application\/json\s*(;|$)/i.test(contentType)) {
            return json(415, { error: 'unsupported_media_type' });
        }
        const declaredLength = Number(request.headers.get('content-length'));
        if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
            return json(413, { error: 'payload_too_large' });
        }
        let raw;
        try {
            raw = await readBodyCapped(request, MAX_BODY_BYTES);
        } catch {
            return json(400, { error: 'invalid_request', reason: 'invalid_body' });
        }
        if (raw === null) return json(413, { error: 'payload_too_large' });

        const parsed = parseBody(raw);
        if (parsed.error) return json(400, { error: 'invalid_request', reason: parsed.error });
        const { prompt } = parsed;

        // ---- Rate limits (count attempts, not successes: failures cost too) ----
        let ipCount;
        let dayCount;
        try {
            ipCount = await counterStore.incr(ipKey, ipWindowSeconds + 60);
            if (ipCount > ipLimit) {
                return rateLimited('ip', window.ipRetryAfter);
            }
            dayCount = await counterStore.incr(dayKey, 26 * 60 * 60);
            if (dayCount > dailyCap) {
                return rateLimited('daily', window.dayRetryAfter);
            }
        } catch (err) {
            logger.error('[demo] counter store unavailable:', err?.message || err);
            return unavailable();
        }

        // ---- Upstream call ----
        let upstream;
        try {
            upstream = await fetchImpl(geminiEndpoint(config.model), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': config.apiKey
                },
                body: JSON.stringify(buildGenerateBody(prompt, analyzePrompt(prompt), { maxOutputTokens })),
                signal: AbortSignal.timeout(upstreamTimeoutMs)
            });
        } catch (err) {
            if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
                logger.error(`[demo] Gemini request timed out after ${upstreamTimeoutMs}ms`);
                return json(504, { error: 'upstream_timeout' });
            }
            logger.error('[demo] Gemini request failed:', err?.message || err);
            return json(502, { error: 'upstream_error' });
        }

        if (!upstream.ok) {
            const detail = await upstream.text().catch(() => '');
            logger.error(`[demo] Gemini HTTP ${upstream.status}:`, detail.slice(0, 1000));
            // Bad/revoked key or exhausted owner quota: the demo is down, so
            // let the client offer bring-your-own-key instead of retrying.
            if ([401, 403, 429].includes(upstream.status)) return unavailable();
            return json(502, { error: 'upstream_error' });
        }

        let data;
        try {
            data = await upstream.json();
        } catch (err) {
            const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
            logger.error('[demo] Gemini response unreadable:', err?.message || err);
            return json(timedOut ? 504 : 502, { error: timedOut ? 'upstream_timeout' : 'upstream_error' });
        }

        const text = cleanGeneratedHtml(extractText(data));
        if (!looksLikeHtml(text)) {
            // Also keeps the endpoint from being a general-purpose free LLM.
            logger.error(
                '[demo] Gemini returned no HTML document; finishReason =',
                data?.candidates?.[0]?.finishReason ?? data?.promptFeedback?.blockReason ?? 'unknown'
            );
            return json(502, { error: 'upstream_error' });
        }

        return json(200, {
            candidates: [{ content: { parts: [{ text }] } }],
            demo: quota(ipCount, dayCount)
        });
    }

    return async function demoHandler(request) {
        try {
            return await handle(request);
        } catch (err) {
            logger.error('[demo] unexpected error:', err);
            return json(500, { error: 'internal_error' });
        }
    };
}

// ---------------------------------------------------------------------------

function readConfig(env) {
    const kvUrl = (env.KV_REST_API_URL || '').trim();
    const kvToken = (env.KV_REST_API_TOKEN || '').trim();
    return {
        apiKey: (env.GEMINI_API_KEY || '').trim(),
        model: (env.GEMINI_MODEL || '').trim() || DEFAULT_MODEL,
        dailyCap: positiveInt(env.DEMO_DAILY_CAP, DEFAULT_DAILY_CAP),
        kv: kvUrl && kvToken ? { url: kvUrl, token: kvToken } : null,
        allowedOrigins: allowedOrigins(env),
        allowLocalhost: env.VERCEL_ENV !== 'production'
    };
}

function positiveInt(value, fallback) {
    const n = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isInteger(n) && n > 0 ? n : fallback;
}

function allowedOrigins(env) {
    const set = new Set();
    for (const entry of String(env.ALLOWED_ORIGINS || '').split(',')) {
        const origin = normalizeOrigin(entry.trim());
        if (origin) set.add(origin);
    }
    // Vercel system env vars: this deployment's own hostnames (no scheme).
    for (const name of ['VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL']) {
        const origin = normalizeOrigin(env[name]);
        if (origin) set.add(origin);
    }
    return set;
}

/** "https://a.com/x" -> "https://a.com"; bare "a.com" -> "https://a.com"; junk -> null */
function normalizeOrigin(value) {
    if (!value || typeof value !== 'string') return null;
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    try {
        const url = new URL(candidate);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        return url.origin;
    } catch {
        return null;
    }
}

function requestOrigin(request) {
    const origin = request.headers.get('origin');
    // "null" = opaque origin (e.g. the sandboxed preview iframe): never allowed.
    if (origin !== null) return origin === 'null' ? null : normalizeOrigin(origin);
    const referer = request.headers.get('referer');
    return referer ? normalizeOrigin(referer) : null;
}

function isAllowedOrigin(origin, config) {
    if (config.allowedOrigins.has(origin)) return true;
    if (!config.allowLocalhost) return false;
    const { protocol, hostname } = new URL(origin);
    return protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]');
}

/** First x-forwarded-for hop (Vercel sets it to the real client IP). */
function clientIp(request) {
    const forwarded = request.headers.get('x-forwarded-for');
    const first = forwarded ? forwarded.split(',')[0].trim() : '';
    const ip = first || (request.headers.get('x-real-ip') || '').trim();
    return ip && ip.length <= 64 ? ip : 'unknown';
}

/** Keyed hash so raw IPs never reach the counter store. */
function hashIp(ip, secret) {
    return createHmac('sha256', secret).update(ip).digest('hex').slice(0, 32);
}

function currentWindows(nowMs, ipWindowSeconds) {
    const nowSeconds = Math.floor(nowMs / 1000);
    const date = new Date(nowMs);
    const nextUtcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
    return {
        ipBucket: Math.floor(nowSeconds / ipWindowSeconds),
        ipRetryAfter: ipWindowSeconds - (nowSeconds % ipWindowSeconds),
        day: date.toISOString().slice(0, 10),
        dayRetryAfter: Math.max(1, Math.ceil((nextUtcMidnight - nowMs) / 1000))
    };
}

async function readBodyCapped(request, limit) {
    if (!request.body) return '';
    const reader = request.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
            await reader.cancel().catch(() => {});
            return null;
        }
        chunks.push(value);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}

/** Accept exactly what the client sends: { "prompt": string }. */
function parseBody(raw) {
    let body;
    try {
        body = JSON.parse(raw);
    } catch {
        return { error: 'invalid_json' };
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'invalid_body' };
    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== 'prompt') return { error: 'unexpected_fields' };
    if (typeof body.prompt !== 'string') return { error: 'invalid_prompt' };
    const prompt = body.prompt.trim();
    if (!prompt) return { error: 'prompt_required' };
    if (prompt.length > MAX_PROMPT_CHARS) return { error: 'prompt_too_long' };
    return { prompt };
}

function json(status, body, headers = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...headers
        }
    });
}

function unavailable() {
    return json(503, { demo: 'unavailable' });
}

function rateLimited(scope, retryAfter) {
    return json(429, { error: 'rate_limited', scope, retryAfter }, { 'Retry-After': String(retryAfter) });
}
