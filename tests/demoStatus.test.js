import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Client-side demo availability store (src/services/demoStatus.js). It keeps
// module-level state, so every test loads a fresh copy.
const NOW = Date.UTC(2026, 8, 28, 12, 10, 0);
const HTML = '<!DOCTYPE html><html><body>demo</body></html>';

async function load() {
    vi.resetModules();
    const demo = await import('../src/services/demoStatus.js');
    const { AiService } = await import('../src/services/AiService.js');
    return { demo, AiService };
}

function statusBody(remaining, extra = {}) {
    return Response.json({ demo: 'available', limit: 5, remaining, ...extra });
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('exhausted quota', () => {
    it('re-probes after 60s when the reset time is unknown, then backs off', async () => {
        const { demo } = await load();
        const fetchMock = vi.fn(async () => statusBody(0));
        vi.stubGlobal('fetch', fetchMock);

        // e.g. an older server that reported remaining: 0 without timing
        demo.applyDemoQuota({ limit: 5, remaining: 0 });
        expect(demo.getDemoState()).toMatchObject({ status: 'exhausted', retryAt: null, recheckAt: NOW + 60_000 });

        await demo.ensureDemoStatus();
        vi.setSystemTime(NOW + 59_000);
        await demo.ensureDemoStatus();
        expect(fetchMock).not.toHaveBeenCalled();

        vi.setSystemTime(NOW + 60_000);
        await demo.ensureDemoStatus();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        // Still exhausted and still no timing: next look is 5 min later.
        expect(demo.getDemoState().recheckAt).toBe(NOW + 60_000 + demo.UNKNOWN_RESET_BACKOFF_MS[1]);
    });

    it('recovers once the probe reports generations again', async () => {
        const { demo } = await load();
        vi.stubGlobal('fetch', vi.fn(async () => statusBody(5)));
        demo.applyDemoQuota({ limit: 5, remaining: 0 });

        vi.setSystemTime(NOW + 60_000);
        const state = await demo.ensureDemoStatus();
        expect(state).toMatchObject({ status: 'available', remaining: 5, recheckAt: null });
    });

    it('uses the reset time from a successful POST that used the last generation', async () => {
        const { demo, AiService } = await load();
        const fetchMock = vi.fn(async (url, init) => init?.method === 'POST'
            ? Response.json({
                candidates: [{ content: { parts: [{ text: HTML }] } }],
                demo: { limit: 5, remaining: 0, reason: 'ip', retryAfter: 1200 }
            })
            : statusBody(5));
        vi.stubGlobal('fetch', fetchMock);

        expect(await AiService.generateWithDemo('build a bakery website')).toBe(HTML);
        expect(demo.getDemoState()).toMatchObject({
            status: 'exhausted', scope: 'ip', retryAt: NOW + 1_200_000, recheckAt: NOW + 1_200_000
        });

        vi.setSystemTime(NOW + 1_199_000);
        await demo.ensureDemoStatus();
        expect(fetchMock).toHaveBeenCalledTimes(1); // only the POST

        vi.setSystemTime(NOW + 1_200_000);
        expect(await demo.ensureDemoStatus()).toMatchObject({ status: 'available', remaining: 5 });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('uses the Retry-After data of a 429', async () => {
        const { demo, AiService } = await load();
        vi.stubGlobal('fetch', vi.fn(async () => Response.json(
            { error: 'rate_limited', scope: 'daily', retryAfter: 3600 }, { status: 429 }
        )));
        await expect(AiService.generateWithDemo('build a site')).rejects.toMatchObject({ code: 'rate_limited' });
        expect(demo.getDemoState()).toMatchObject({ status: 'exhausted', scope: 'daily', recheckAt: NOW + 3_600_000 });
    });
});

describe('availability check failures', () => {
    const unavailable503 = () => Response.json({ demo: 'unavailable' }, { status: 503 });

    it('re-probes a transient 503 after 30s, then 2m, then every 10m', async () => {
        const { demo } = await load();
        const fetchMock = vi.fn(async () => unavailable503());
        vi.stubGlobal('fetch', fetchMock);

        await demo.ensureDemoStatus();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(demo.getDemoState()).toMatchObject({ status: 'unavailable', recheckAt: NOW + 30_000 });

        vi.setSystemTime(NOW + 29_000);
        await demo.ensureDemoStatus();
        expect(fetchMock).toHaveBeenCalledTimes(1);

        let t = NOW;
        for (const [i, wait] of [30_000, 120_000, 600_000, 600_000].entries()) {
            t += wait;
            vi.setSystemTime(t);
            await demo.ensureDemoStatus();
            expect(fetchMock).toHaveBeenCalledTimes(i + 2);
            expect(demo.getDemoState().recheckAt).toBe(t + demo.TRANSIENT_BACKOFF_MS[Math.min(i + 1, 2)]);
        }
    });

    it('recovers from a network error and resets the backoff', async () => {
        const { demo } = await load();
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(statusBody(5))
            .mockResolvedValueOnce(unavailable503());
        vi.stubGlobal('fetch', fetchMock);

        await demo.ensureDemoStatus();
        expect(demo.getDemoState()).toMatchObject({ status: 'unavailable', recheckAt: NOW + 30_000 });

        vi.setSystemTime(NOW + 30_000);
        expect(await demo.ensureDemoStatus()).toMatchObject({ status: 'available', remaining: 5, recheckAt: null });

        // A later failure starts the schedule from the beginning again.
        demo.markDemoUnavailable();
        expect(demo.getDemoState().recheckAt).toBe(NOW + 30_000 + 30_000);
    });

    it.each([
        ['a 404', () => new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain' } })],
        ['the SPA fallback page (200 text/html)', () => new Response('<!doctype html><div id="root"></div>', { status: 200, headers: { 'content-type': 'text/html' } })]
    ])('treats %s as "no endpoint" and never re-probes', async (_label, makeResponse) => {
        const { demo } = await load();
        const fetchMock = vi.fn(async () => makeResponse());
        vi.stubGlobal('fetch', fetchMock);

        await demo.ensureDemoStatus();
        expect(demo.getDemoState()).toMatchObject({ status: 'unavailable', recheckAt: null });

        vi.setSystemTime(NOW + 24 * 60 * 60 * 1000);
        await demo.ensureDemoStatus();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('never probes in the GitHub Pages build', async () => {
        vi.stubGlobal('__MAGICB_DEMO_API__', false);
        const { demo } = await load();
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        vi.setSystemTime(NOW + 24 * 60 * 60 * 1000);
        expect(await demo.ensureDemoStatus()).toMatchObject({ status: 'unavailable', recheckAt: null });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('classifies failed generations the same way (503 transient, 404 permanent)', async () => {
        const { demo, AiService } = await load();
        vi.stubGlobal('fetch', vi.fn(async () => unavailable503()));
        await expect(AiService.generateWithDemo('build a site')).rejects.toMatchObject({ code: 'unavailable' });
        expect(demo.getDemoState()).toMatchObject({ status: 'unavailable', recheckAt: NOW + 30_000 });

        vi.stubGlobal('fetch', vi.fn(async () => new Response('gone', { status: 404 })));
        await expect(AiService.generateWithDemo('build a site')).rejects.toMatchObject({ code: 'unavailable' });
        expect(demo.getDemoState()).toMatchObject({ status: 'unavailable', recheckAt: null });
    });
});
