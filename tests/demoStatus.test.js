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
