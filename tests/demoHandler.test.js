import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    MAX_BODY_BYTES,
    MEMORY_DAILY_CEILING,
    createDemoHandler
} from '../server/demoHandler.js';
import { DEFAULT_MODEL, MAX_PROMPT_CHARS } from '../src/shared/gemini.js';
import vercelFunction from '../api/generate.js';

const ORIGIN = 'https://magicb.example';
const ENDPOINT = `${ORIGIN}/api/generate`;
const SERVER_KEY = 'AIza-server-side-test-key';
const HTML = '<!DOCTYPE html><html><body><h1>Bakery</h1></body></html>';
// 2026-09-28 12:10:00 UTC: 50 min left in the hourly window, 11h50m in the day.
const NOW = Date.UTC(2026, 8, 28, 12, 10, 0);
const KV_URL = 'https://kv.example.upstash.io';

function geminiOk(text = HTML, extraParts = []) {
    return Response.json({
        candidates: [{ content: { parts: [...extraParts, { text }] }, finishReason: 'STOP' }]
    });
}

function isGemini(url) {
    return String(url).startsWith('https://generativelanguage.googleapis.com/');
}

function setup({ env = {}, fetch, now = () => NOW, ...options } = {}) {
    const logger = { error: vi.fn(), warn: vi.fn() };
    const fetchMock = fetch ?? vi.fn(async () => geminiOk());
    const handler = createDemoHandler({
        env: { GEMINI_API_KEY: SERVER_KEY, ALLOWED_ORIGINS: ORIGIN, ...env },
        fetch: fetchMock,
        logger,
        now,
        ...options
    });
    return { handler, fetchMock, logger };
}

function post(body = { prompt: 'build a bakery website' }, { ip = '203.0.113.7', origin = ORIGIN, headers = {} } = {}) {
    const allHeaders = {
        'content-type': 'application/json',
        'x-forwarded-for': `${ip}, 10.0.0.1`,
        ...headers
    };
    if (origin) allHeaders.origin = origin;
    return new Request(ENDPOINT, {
        method: 'POST',
        headers: allHeaders,
        body: typeof body === 'string' ? body : JSON.stringify(body)
    });
}

function get({ ip = '203.0.113.7', headers = {} } = {}) {
    return new Request(ENDPOINT, { headers: { 'x-forwarded-for': ip, ...headers } });
}

const geminiCalls = fetchMock => fetchMock.mock.calls.filter(([url]) => isGemini(url));

/** Minimal Upstash REST /pipeline emulator (SET .. EX .. NX, INCR, GET). */
function upstashFetch({ fail = false } = {}) {
    const data = new Map();
    const kvCalls = [];
    const fetch = vi.fn(async (url, init) => {
        if (!String(url).startsWith(KV_URL)) return geminiOk();
        const commands = JSON.parse(init.body);
        kvCalls.push({ url: String(url), auth: init.headers.Authorization, commands });
        if (fail) return new Response('upstash down', { status: 500 });
        return Response.json(commands.map(([cmd, key, ...args]) => {
            if (cmd === 'SET') {
                if (args.includes('NX') && data.has(key)) return { result: null };
                data.set(key, Number(args[0]));
                return { result: 'OK' };
            }
            if (cmd === 'INCR') {
                data.set(key, (data.get(key) ?? 0) + 1);
                return { result: data.get(key) };
            }
            if (cmd === 'GET') return { result: data.has(key) ? String(data.get(key)) : null };
            return { error: `ERR unknown command ${cmd}` };
        }));
    });
    return { fetch, kvCalls, data };
}

describe('fail closed without configuration', () => {
    it('returns 503 { demo: "unavailable" } for POST and GET when GEMINI_API_KEY is unset', async () => {
        const { handler, fetchMock } = setup({ env: { GEMINI_API_KEY: undefined } });

        const postRes = await handler(post());
        expect(postRes.status).toBe(503);
        expect(await postRes.json()).toEqual({ demo: 'unavailable' });

        const getRes = await handler(get());
        expect(getRes.status).toBe(503);
        expect(await getRes.json()).toEqual({ demo: 'unavailable' });

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('treats a blank key as unset', async () => {
        const { handler, fetchMock } = setup({ env: { GEMINI_API_KEY: '   ' } });
        expect((await handler(post())).status).toBe(503);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('disables the demo when GEMINI_MODEL is not a valid model id', async () => {
        const { handler, fetchMock, logger } = setup({ env: { GEMINI_MODEL: '../../v1/evil?x=' } });
        expect((await handler(post())).status).toBe(503);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalled();
    });

    it('rejects other methods with 405', async () => {
        const { handler } = setup();
        const res = await handler(new Request(ENDPOINT, { method: 'PUT', body: '{}' }));
        expect(res.status).toBe(405);
        expect(res.headers.get('allow')).toBe('GET, POST');
    });
});

describe('origin allowlist', () => {
    it('rejects a foreign Origin without calling Gemini', async () => {
        const { handler, fetchMock } = setup();
        const res = await handler(post(undefined, { origin: 'https://evil.example' }));
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: 'origin_not_allowed' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects POSTs with neither Origin nor Referer', async () => {
        const { handler } = setup();
        expect((await handler(post(undefined, { origin: null }))).status).toBe(403);
    });

    it('rejects the opaque "null" origin of sandboxed frames', async () => {
        const { handler } = setup();
        expect((await handler(post(undefined, { origin: 'null' }))).status).toBe(403);
    });

    it('falls back to the Referer origin', async () => {
        const { handler } = setup();
        const ok = await handler(post(undefined, { origin: null, headers: { referer: `${ORIGIN}/some/page?q=1` } }));
        expect(ok.status).toBe(200);
        const bad = await handler(post(undefined, { origin: null, headers: { referer: 'https://evil.example/' } }));
        expect(bad.status).toBe(403);
    });

    it("allows the deployment's own VERCEL_* hosts and bare hosts in ALLOWED_ORIGINS", async () => {
        const { handler } = setup({
            env: { ALLOWED_ORIGINS: 'magicb.goodnbad.info, https://www.example.com/', VERCEL_URL: 'magicb-abc123.vercel.app' }
        });
        expect((await handler(post(undefined, { origin: 'https://magicb-abc123.vercel.app' }))).status).toBe(200);
        expect((await handler(post(undefined, { origin: 'https://magicb.goodnbad.info', ip: '198.51.100.2' }))).status).toBe(200);
        expect((await handler(post(undefined, { origin: 'https://www.example.com', ip: '198.51.100.3' }))).status).toBe(200);
        expect((await handler(post(undefined, { origin: 'http://magicb.goodnbad.info' }))).status).toBe(403);
    });

    it('allows localhost for development but not in production', async () => {
        const dev = setup({ env: { VERCEL_ENV: 'development' } });
        expect((await dev.handler(post(undefined, { origin: 'http://localhost:5173' }))).status).toBe(200);

        const prod = setup({ env: { VERCEL_ENV: 'production' } });
        expect((await prod.handler(post(undefined, { origin: 'http://localhost:5173' }))).status).toBe(403);
        expect((await prod.handler(post(undefined, { origin: 'http://127.0.0.1:4173' }))).status).toBe(403);
    });

    it('lets same-origin status GETs through (browsers omit Origin) but blocks foreign ones', async () => {
        const { handler } = setup();
        expect((await handler(get())).status).toBe(200);
        expect((await handler(get({ headers: { origin: 'https://evil.example' } }))).status).toBe(403);
    });
});

describe('input validation', () => {
    const invalid = [
        ['a non-JSON content type', () => post('prompt=hi', { headers: { 'content-type': 'text/plain' } }), 415, 'unsupported_media_type'],
        ['malformed JSON', () => post('{"prompt": "hi"'), 400, 'invalid_json'],
        ['a JSON array', () => post('["build a site"]'), 400, 'invalid_body'],
        ['JSON null', () => post('null'), 400, 'invalid_body'],
        ['unexpected extra fields', () => post({ prompt: 'build a site', model: 'gemini-pro', maxOutputTokens: 99999 }), 400, 'unexpected_fields'],
        ['a missing prompt', () => post({}), 400, 'unexpected_fields'],
        ['a non-string prompt', () => post({ prompt: 42 }), 400, 'invalid_prompt'],
        ['a blank prompt', () => post({ prompt: '   ' }), 400, 'prompt_required'],
        ['a prompt over the limit', () => post({ prompt: 'x'.repeat(MAX_PROMPT_CHARS + 1) }), 400, 'prompt_too_long']
    ];

    it.each(invalid)('rejects %s', async (_label, makeRequest, status, reason) => {
        const { handler, fetchMock } = setup();
        const res = await handler(makeRequest());
        expect(res.status).toBe(status);
        const body = await res.json();
        expect(body.reason ?? body.error).toBe(reason);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('accepts a prompt of exactly the maximum length', async () => {
        const { handler } = setup();
        expect((await handler(post({ prompt: 'x'.repeat(MAX_PROMPT_CHARS) }))).status).toBe(200);
    });

    it('rejects oversized bodies by Content-Length and by actual size', async () => {
        const { handler, fetchMock } = setup();
        const declared = post({ prompt: 'hi' }, { headers: { 'content-length': String(MAX_BODY_BYTES + 1) } });
        expect((await handler(declared)).status).toBe(413);

        const streamed = new Request(ENDPOINT, {
            method: 'POST',
            headers: { 'content-type': 'application/json', origin: ORIGIN },
            body: JSON.stringify({ prompt: 'y'.repeat(MAX_BODY_BYTES) })
        });
        expect((await handler(streamed)).status).toBe(413);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not spend rate-limit quota on rejected requests', async () => {
        const { handler } = setup();
        for (let i = 0; i < 10; i++) await handler(post({ prompt: '' }));
        const res = await handler(post());
        expect(res.status).toBe(200);
        expect((await res.json()).demo).toEqual({ limit: 5, remaining: 4 });
    });
});

describe('per-IP rate limit', () => {
    it('allows 5 generations per hour per IP, then 429 with Retry-After', async () => {
        const { handler, fetchMock } = setup();
        for (let i = 0; i < 5; i++) {
            expect((await handler(post(undefined, { ip: '192.0.2.10' }))).status).toBe(200);
        }
        const limited = await handler(post(undefined, { ip: '192.0.2.10' }));
        expect(limited.status).toBe(429);
        expect(await limited.json()).toEqual({ error: 'rate_limited', scope: 'ip', retryAfter: 50 * 60 });
        expect(limited.headers.get('retry-after')).toBe(String(50 * 60));
        expect(geminiCalls(fetchMock)).toHaveLength(5);

        // A different client is unaffected.
        expect((await handler(post(undefined, { ip: '192.0.2.11' }))).status).toBe(200);
    });

    it('keys on the first x-forwarded-for hop only', async () => {
        const { handler } = setup();
        for (let i = 0; i < 5; i++) {
            const res = await handler(post(undefined, { headers: { 'x-forwarded-for': `192.0.2.20, 10.0.0.${i}` } }));
            expect(res.status).toBe(200);
        }
        const res = await handler(post(undefined, { headers: { 'x-forwarded-for': '192.0.2.20, 10.9.9.9' } }));
        expect(res.status).toBe(429);
    });

    it('resets in the next hourly window', async () => {
        let now = NOW;
        const { handler } = setup({ now: () => now });
        for (let i = 0; i < 5; i++) await handler(post());
        expect((await handler(post())).status).toBe(429);
        now += 50 * 60 * 1000;
        expect((await handler(post())).status).toBe(200);
    });

    it('reports the remaining quota on GET without spending it', async () => {
        const { handler, fetchMock } = setup();
        expect(await (await handler(get())).json()).toEqual({ demo: 'available', limit: 5, remaining: 5 });
        await handler(post());
        await handler(post());
        expect(await (await handler(get())).json()).toEqual({ demo: 'available', limit: 5, remaining: 3 });
        for (let i = 0; i < 3; i++) await handler(post());
        expect(await (await handler(get())).json()).toEqual({
            demo: 'available', limit: 5, remaining: 0, reason: 'ip', retryAfter: 50 * 60
        });
        expect(geminiCalls(fetchMock)).toHaveLength(5);
    });
});

describe('global daily cap', () => {
    it('stops all visitors once DEMO_DAILY_CAP is reached, until UTC midnight', async () => {
        const { handler, fetchMock } = setup({ env: { DEMO_DAILY_CAP: '3' } });
        for (let i = 1; i <= 3; i++) {
            expect((await handler(post(undefined, { ip: `198.51.100.${i}` }))).status).toBe(200);
        }
        const res = await handler(post(undefined, { ip: '198.51.100.99' }));
        expect(res.status).toBe(429);
        const secondsToMidnight = (Date.UTC(2026, 8, 29) - NOW) / 1000;
        expect(await res.json()).toEqual({ error: 'rate_limited', scope: 'daily', retryAfter: secondsToMidnight });
        expect(geminiCalls(fetchMock)).toHaveLength(3);
    });

    it('defaults to 50 per day (with KV) and ignores invalid values', async () => {
        const kv = upstashFetch();
        const { handler } = setup({
            env: { DEMO_DAILY_CAP: 'lots', KV_REST_API_URL: KV_URL, KV_REST_API_TOKEN: 'kv-token' },
            fetch: kv.fetch
        });
        for (let i = 0; i < 50; i++) {
            expect((await handler(post(undefined, { ip: `10.1.${Math.floor(i / 200)}.${i % 200}` }))).status).toBe(200);
        }
        expect((await handler(post(undefined, { ip: '10.2.0.1' }))).status).toBe(429);
    });

    it(`lowers the cap to ${MEMORY_DAILY_CEILING}/instance without KV`, async () => {
        const { handler, logger } = setup({ env: { DEMO_DAILY_CAP: '1000' } });
        for (let i = 0; i < MEMORY_DAILY_CEILING; i++) {
            expect((await handler(post(undefined, { ip: `10.3.0.${i}` }))).status).toBe(200);
        }
        const res = await handler(post(undefined, { ip: '10.3.1.1' }));
        expect(res.status).toBe(429);
        expect((await res.json()).scope).toBe('daily');
        expect(logger.warn).toHaveBeenCalledOnce();
    });
});

describe('shared counters in Vercel KV / Upstash', () => {
    it('counts through the REST pipeline with the bearer token and never stores raw IPs', async () => {
        const kv = upstashFetch();
        const { handler } = setup({
            env: { KV_REST_API_URL: `${KV_URL}/`, KV_REST_API_TOKEN: 'kv-token' },
            fetch: kv.fetch
        });
        expect((await handler(post(undefined, { ip: '203.0.113.50' }))).status).toBe(200);

        expect(kv.kvCalls.length).toBeGreaterThan(0);
        for (const call of kv.kvCalls) {
            expect(call.url).toBe(`${KV_URL}/pipeline`);
            expect(call.auth).toBe('Bearer kv-token');
            expect(JSON.stringify(call.commands)).not.toContain('203.0.113.50');
        }
        expect([...kv.data.values()]).toEqual([1, 1]); // one per-IP key, one daily key
    });

    it('fails closed (503) when KV errors, without calling Gemini', async () => {
        const kv = upstashFetch({ fail: true });
        const { handler, logger } = setup({
            env: { KV_REST_API_URL: KV_URL, KV_REST_API_TOKEN: 'kv-token' },
            fetch: kv.fetch
        });
        const res = await handler(post());
        expect(res.status).toBe(503);
        expect(await res.json()).toEqual({ demo: 'unavailable' });
        expect(geminiCalls(kv.fetch)).toHaveLength(0);
        expect(logger.error).toHaveBeenCalled();
    });
});

describe('upstream call', () => {
    it('returns the Gemini candidates shape the client parses, plus the quota', async () => {
        const { handler } = setup();
        const res = await handler(post());
        expect(res.status).toBe(200);
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(await res.json()).toEqual({
            candidates: [{ content: { parts: [{ text: HTML }] } }],
            demo: { limit: 5, remaining: 4 }
        });
    });

    it('sends the server key in a header, uses GEMINI_MODEL and caps output tokens', async () => {
        const { handler, fetchMock } = setup({ env: { GEMINI_MODEL: 'gemini-3-flash-preview' } });
        await handler(post({ prompt: 'build a bakery website' }));

        const [url, init] = geminiCalls(fetchMock)[0];
        expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent');
        expect(url).not.toContain(SERVER_KEY);
        expect(init.headers['x-goog-api-key']).toBe(SERVER_KEY);
        expect(init.signal).toBeInstanceOf(AbortSignal);
        const body = JSON.parse(init.body);
        expect(body.generationConfig.maxOutputTokens).toBe(8192);
        expect(body.systemInstruction.parts[0].text).toMatch(/SINGLE-FILE HTML/);
        expect(body.contents[0].parts[0].text).toContain('build a bakery website');
    });

    it(`defaults to ${DEFAULT_MODEL} when GEMINI_MODEL is unset`, async () => {
        const { handler, fetchMock } = setup();
        await handler(post());
        expect(geminiCalls(fetchMock)[0][0]).toContain(`/models/${DEFAULT_MODEL}:generateContent`);
    });

    it('never returns upstream error bodies, but logs them', async () => {
        const secret = 'INTERNAL: quota project 1234 / key AIza-leak';
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: secret } }), { status: 500 }));
        const { handler, logger } = setup({ fetch: fetchMock });

        const res = await handler(post());
        const text = await res.text();
        expect(res.status).toBe(502);
        expect(JSON.parse(text)).toEqual({ error: 'upstream_error' });
        expect(text).not.toContain('INTERNAL');
        expect(text).not.toContain('AIza');
        expect(logger.error.mock.calls.flat().join(' ')).toContain(secret);
    });

    it('does not leak network error messages either', async () => {
        const fetchMock = vi.fn(async () => { throw new TypeError('connect ECONNREFUSED 10.0.0.9:443'); });
        const { handler } = setup({ fetch: fetchMock });
        const res = await handler(post());
        const text = await res.text();
        expect(res.status).toBe(502);
        expect(text).not.toContain('ECONNREFUSED');
    });

    it('maps an exhausted/invalid owner key (upstream 429/403) to demo unavailable', async () => {
        for (const status of [429, 403]) {
            const fetchMock = vi.fn(async () => new Response('{"error":{"status":"RESOURCE_EXHAUSTED"}}', { status }));
            const { handler } = setup({ fetch: fetchMock });
            const res = await handler(post());
            expect(res.status).toBe(503);
            expect(await res.json()).toEqual({ demo: 'unavailable' });
        }
    });

    it('times out a slow upstream with 504', async () => {
        const fetchMock = vi.fn((url, init) => new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(init.signal.reason));
        }));
        const { handler, logger } = setup({ fetch: fetchMock, upstreamTimeoutMs: 25 });
        const res = await handler(post());
        expect(res.status).toBe(504);
        expect(await res.json()).toEqual({ error: 'upstream_timeout' });
        expect(logger.error).toHaveBeenCalled();
    });

    it('refuses to relay output that is not an HTML document', async () => {
        const fetchMock = vi.fn(async () => geminiOk('Sure! Here is an essay about something else entirely.'));
        const { handler } = setup({ fetch: fetchMock });
        const res = await handler(post());
        expect(res.status).toBe(502);
        expect(await res.text()).not.toContain('essay');
    });

    it('strips markdown fences and skips thought parts', async () => {
        const fetchMock = vi.fn(async () => geminiOk('```html\n' + HTML + '\n```', [{ text: 'thinking...', thought: true }]));
        const { handler } = setup({ fetch: fetchMock });
        const body = await (await handler(post())).json();
        expect(body.candidates[0].content.parts[0].text).toBe(HTML);
    });
});

describe('api/generate.js (Vercel entry point)', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('exports a web-standard fetch handler that fails closed without a key', async () => {
        vi.stubEnv('GEMINI_API_KEY', '');
        const res = await vercelFunction.fetch(post());
        expect(res.status).toBe(503);
        expect(await res.json()).toEqual({ demo: 'unavailable' });
    });

    it('reads process.env and global fetch at request time', async () => {
        vi.stubEnv('GEMINI_API_KEY', SERVER_KEY);
        vi.stubEnv('ALLOWED_ORIGINS', ORIGIN);
        vi.stubEnv('KV_REST_API_URL', '');
        const fetchMock = vi.fn(async () => geminiOk());
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        const res = await vercelFunction.fetch(post(undefined, { ip: '192.0.2.200' }));
        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledOnce();
    });
});
