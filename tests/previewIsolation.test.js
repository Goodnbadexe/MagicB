// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PREVIEW_SANDBOX, openInNewWindow } from '../src/utils/exportUtils.js';

// AI-generated HTML is untrusted. It must run in an opaque-origin sandbox so
// it can never reach this app's localStorage (the BYO Gemini key), cookies
// or DOM. These tests pin that down.

const UNTRUSTED_HTML = '<!DOCTYPE html><html><body><h1 id="payload">hi</h1>' +
    '<script>parent.localStorage.getItem("magicb_ai_key")</script></body></html>';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('PREVIEW_SANDBOX', () => {
    const tokens = PREVIEW_SANDBOX.trim().split(/\s+/);

    it('lets generated pages run scripts (Tailwind CDN, interactivity)', () => {
        expect(tokens).toContain('allow-scripts');
    });

    it('never grants same-origin access or ways out of the sandbox', () => {
        expect(tokens).not.toContain('allow-same-origin');
        expect(tokens.filter(token => token.startsWith('allow-top-navigation'))).toEqual([]);
        expect(tokens).not.toContain('allow-popups-to-escape-sandbox');
    });
});

describe('openInNewWindow', () => {
    function fakePopup() {
        return { opener: window, document: document.implementation.createHTMLDocument('') };
    }

    it('renders the HTML only inside a sandboxed srcdoc iframe and severs the opener', () => {
        const popup = fakePopup();
        const open = vi.spyOn(window, 'open').mockReturnValue(popup);

        openInNewWindow(UNTRUSTED_HTML);

        expect(open).toHaveBeenCalledWith('', '_blank');
        expect(popup.opener).toBeNull();
        const frames = popup.document.querySelectorAll('iframe');
        expect(frames).toHaveLength(1);
        expect(frames[0].getAttribute('sandbox')).toBe(PREVIEW_SANDBOX);
        expect(frames[0].srcdoc).toBe(UNTRUSTED_HTML);
        // The untrusted markup is never parsed into the same-origin popup itself.
        expect(popup.document.getElementById('payload')).toBeNull();
        expect(popup.document.querySelector('script')).toBeNull();
    });

    it('does nothing when the popup is blocked', () => {
        vi.spyOn(window, 'open').mockReturnValue(null);
        expect(() => openInNewWindow(UNTRUSTED_HTML)).not.toThrow();
    });
});

describe('every preview frame in the app', () => {
    const srcDir = join(import.meta.dirname, '..', 'src');
    const files = [];
    (function walk(dir) {
        for (const name of readdirSync(dir)) {
            const path = join(dir, name);
            if (statSync(path).isDirectory()) walk(path);
            else if (/\.(jsx?|tsx?)$/.test(name)) files.push(path);
        }
    })(srcDir);

    it('uses sandbox={PREVIEW_SANDBOX} on every JSX iframe', () => {
        const iframes = [];
        for (const file of files) {
            const source = readFileSync(file, 'utf8');
            for (const match of source.matchAll(/<(?:motion\.)?iframe\b([^>]*)>/g)) {
                iframes.push({ file: relative(srcDir, file), props: match[1] });
            }
        }
        expect(iframes.length).toBeGreaterThan(0); // the builder preview exists
        for (const { file, props } of iframes) {
            expect(props, `${file}: iframe without sandbox={PREVIEW_SANDBOX}`).toMatch(/sandbox=\{PREVIEW_SANDBOX\}/);
        }
    });

    it('sandboxes every iframe created with createElement', () => {
        for (const file of files) {
            const source = readFileSync(file, 'utf8');
            const created = (source.match(/createElement\(\s*['"]iframe['"]\s*\)/g) || []).length;
            const sandboxed = (source.match(/setAttribute\(\s*['"]sandbox['"]\s*,\s*PREVIEW_SANDBOX\s*\)/g) || []).length;
            expect(sandboxed, `${relative(srcDir, file)} creates unsandboxed iframes`).toBeGreaterThanOrEqual(created);
        }
    });
});
