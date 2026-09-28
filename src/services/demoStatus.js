/**
 * Free-demo availability, shared by every part of the UI.
 *
 * "Demo mode" sends generations to /api/generate, which runs on the site
 * owner's Gemini key with per-visitor and daily limits. It is used
 * automatically when the visitor has not saved their own key. Hosts without
 * that endpoint fall back to bring-your-own-key (BYO) mode:
 *   - the GitHub Pages build compiles __MAGICB_DEMO_API__ = false and never
 *     probes at all;
 *   - anywhere else the endpoint is probed once, and anything other than a
 *     JSON { demo: "available" } answer (404, the SPA's index.html, 503,
 *     network error) means "unavailable".
 */
import { useSyncExternalStore } from 'react';

const DEMO_API_ENABLED = typeof __MAGICB_DEMO_API__ === 'undefined' ? true : __MAGICB_DEMO_API__;

export const DEMO_ENDPOINT = `${import.meta.env.BASE_URL}api/generate`;

/**
 * @typedef {Object} DemoState
 * @property {'unknown'|'available'|'exhausted'|'unavailable'} status
 * @property {number|null} limit      - generations per visitor per window
 * @property {number|null} remaining  - generations this visitor has left
 * @property {'ip'|'daily'|null} scope - which limit ran out (when exhausted)
 * @property {number|null} retryAt    - epoch ms when the limit resets
 */

/** @type {DemoState} */
let state = {
    status: DEMO_API_ENABLED ? 'unknown' : 'unavailable',
    limit: null,
    remaining: null,
    scope: null,
    retryAt: null
};
const listeners = new Set();
let inflight = null;

function update(patch) {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
}

export function getDemoState() {
    return state;
}

export function subscribeDemoState(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** React binding: re-renders whenever the demo state changes. */
export function useDemoStatus() {
    return useSyncExternalStore(subscribeDemoState, getDemoState, getDemoState);
}

/**
 * Resolve the demo state, probing the endpoint when it is not known yet
 * (or when an exhausted limit should have reset by now).
 * @returns {Promise<DemoState>}
 */
export function ensureDemoStatus() {
    const limitReset = state.status === 'exhausted' && state.retryAt !== null && Date.now() >= state.retryAt;
    if (state.status !== 'unknown' && !limitReset) return Promise.resolve(state);
    if (!inflight) {
        inflight = probe().finally(() => {
            inflight = null;
        });
    }
    return inflight;
}

async function probe() {
    try {
        const res = await fetch(DEMO_ENDPOINT, {
            headers: { Accept: 'application/json' },
            cache: 'no-store'
        });
        const isJson = (res.headers.get('content-type') || '').includes('application/json');
        const data = isJson ? await res.json() : null;
        if (res.ok && data?.demo === 'available') {
            applyDemoQuota(data);
        } else {
            markDemoUnavailable();
        }
    } catch {
        markDemoUnavailable();
    }
    return state;
}

/** Record the quota reported by the server (status probe or a generation). */
export function applyDemoQuota({ limit = null, remaining = 0, reason = null, retryAfter = null }) {
    const left = Math.max(0, Number(remaining) || 0);
    update({
        status: left > 0 ? 'available' : 'exhausted',
        limit,
        remaining: left,
        scope: left > 0 ? null : reason,
        retryAt: left > 0 || !retryAfter ? null : Date.now() + retryAfter * 1000
    });
}

export function markDemoExhausted(scope = null, retryAfter = null) {
    update({
        status: 'exhausted',
        remaining: 0,
        scope,
        retryAt: retryAfter ? Date.now() + retryAfter * 1000 : null
    });
}

export function markDemoUnavailable() {
    update({ status: 'unavailable', remaining: null, scope: null, retryAt: null });
}

/** "~12 min" / "~3 h" until the limit resets, or null when unknown. */
export function formatReset(retryAt) {
    if (!retryAt) return null;
    const minutes = Math.max(1, Math.ceil((retryAt - Date.now()) / 60000));
    return minutes < 90 ? `~${minutes} min` : `~${Math.round(minutes / 60)} h`;
}
