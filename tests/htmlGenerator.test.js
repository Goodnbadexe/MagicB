// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// generateHtml() cache behaviour: only this version's AI entries are ever
// served, so a stale template cannot hide an available demo.
const PROMPT = 'build a bakery website';
const SLUG = PROMPT.trim().toLowerCase().replace(/\s+/g, '_');
const LEGACY_KEY = `magicb_generation_${SLUG}`;
const V2_KEY = `magicb_generation_v2_${SLUG}`;
const AI_HTML = '<!DOCTYPE html><html><body><h1>AI bakery</h1></body></html>';
const TEMPLATE_HTML = '<!DOCTYPE html><html><body><h1>STALE TEMPLATE</h1></body></html>';

let postCount;

function stubDemo({ postStatus = 200 } = {}) {
    postCount = 0;
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
        if (init?.method !== 'POST') return Response.json({ demo: 'available', limit: 5, remaining: 5 });
        postCount += 1;
        if (postStatus === 429) {
            return Response.json({ error: 'rate_limited', scope: 'ip', retryAfter: 600 }, { status: 429 });
        }
        return Response.json({
            candidates: [{ content: { parts: [{ text: AI_HTML }] } }],
            demo: { limit: 5, remaining: 4 }
        });
    }));
}

async function loadGenerateHtml() {
    vi.resetModules(); // fresh demo-status store and purge flag
    return (await import('../src/features/Builder/HtmlGenerator.jsx')).generateHtml;
}

beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('generation cache', () => {
    it('ignores and purges legacy unversioned entries (which may hold templates)', async () => {
        localStorage.setItem(LEGACY_KEY, JSON.stringify({ html: TEMPLATE_HTML, timestamp: Date.now() }));
        localStorage.setItem('magicb_generation_other_prompt', JSON.stringify({ html: TEMPLATE_HTML, timestamp: Date.now() }));
        localStorage.setItem('magicb_ai_key_unrelated', 'keep-me');
        stubDemo();
        const generateHtml = await loadGenerateHtml();

        const result = await generateHtml(PROMPT);
        expect(result).toMatchObject({ source: 'demo', html: AI_HTML });
        expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
        expect(localStorage.getItem('magicb_generation_other_prompt')).toBeNull();
        expect(localStorage.getItem('magicb_ai_key_unrelated')).toBe('keep-me');
        expect(JSON.parse(localStorage.getItem(V2_KEY))).toMatchObject({ html: AI_HTML, source: 'ai' });
    });

    it.each([
        ['a template entry', { html: TEMPLATE_HTML, timestamp: Date.now(), source: 'template' }],
        ['an untyped entry', { html: TEMPLATE_HTML, timestamp: Date.now() }]
    ])('never serves %s, even under the v2 prefix', async (_label, entry) => {
        localStorage.setItem(V2_KEY, JSON.stringify(entry));
        stubDemo();
        const generateHtml = await loadGenerateHtml();

        const result = await generateHtml(PROMPT);
        expect(result).toMatchObject({ source: 'demo', html: AI_HTML });
        expect(postCount).toBe(1);
    });

    it('serves its own AI entries from cache without spending demo quota', async () => {
        stubDemo();
        const generateHtml = await loadGenerateHtml();

        expect((await generateHtml(PROMPT)).source).toBe('demo');
        const second = await generateHtml(PROMPT);
        expect(second).toMatchObject({ source: 'cache', html: AI_HTML });
        expect(postCount).toBe(1);
    });

    it('does not cache the template fallback', async () => {
        stubDemo({ postStatus: 429 });
        const generateHtml = await loadGenerateHtml();

        const result = await generateHtml(PROMPT);
        expect(result.source).toBe('template');
        expect(result.notice).toMatchObject({ kind: 'rate_limited' });
        expect(Object.keys(localStorage).filter(k => k.startsWith('magicb_generation_'))).toEqual([]);
    });
});
