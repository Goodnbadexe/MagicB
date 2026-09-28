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
 * @property {number|null} retryAt    - epoch ms when the limit resets (if the server said)
 * @property {number|null} recheckAt  - epoch ms after which ensureDemoStatus() probes again
 */

/**
 * When an exhausted quota arrives without a reset time, look again after
 * 60 s, then back off (the last step repeats) so nobody is stuck on
 * templates forever and nobody hammers the endpoint either.
 */
export const UNKNOWN_RESET_BACKOFF_MS = [60_000, 5 * 60_000, 10 * 60_000];

/** @type {DemoState} */
let state = {
    status: DEMO_API_ENABLED ? 'unknown' : 'unavailable',
    limit: null,
    remaining: null,
    scope: null,
    retryAt: null,
    recheckAt: null
};
const listeners = new Set();
let inflight = null;
let unknownResetStreak = 0;

function backoff(steps, streak) {
    return steps[Math.min(streak, steps.length - 1)];
}

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
 * Resolve the demo state, probing the endpoint when it is not known yet or
 * when a scheduled re-check is due (e.g. an exhausted limit should have
 * reset by now).
 * @returns {Promise<DemoState>}
 */
export function ensureDemoStatus() {
    const recheckDue = state.recheckAt !== null && Date.now() >= state.recheckAt;
    if (state.status !== 'unknown' && !recheckDue) return Promise.resolve(state);
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
    if (left === 0) {
        markDemoExhausted(reason, retryAfter, limit);
        return;
    }
    unknownResetStreak = 0;
    update({ status: 'available', limit, remaining: left, scope: null, retryAt: null, recheckAt: null });
}

/**
 * The visitor has no generations left. With a server-provided reset time,
 * re-check exactly then; without one, fall back to UNKNOWN_RESET_BACKOFF_MS.
 */
export function markDemoExhausted(scope = null, retryAfter = null, limit = state.limit) {
    const seconds = Number(retryAfter);
    const retryAt = Number.isFinite(seconds) && seconds > 0 ? Date.now() + seconds * 1000 : null;
    let recheckAt = retryAt;
    if (retryAt === null) {
        recheckAt = Date.now() + backoff(UNKNOWN_RESET_BACKOFF_MS, unknownResetStreak);
        unknownResetStreak += 1;
    } else {
        unknownResetStreak = 0;
    }
    update({ status: 'exhausted', limit, remaining: 0, scope, retryAt, recheckAt });
}

export function markDemoUnavailable() {
    update({ status: 'unavailable', remaining: null, scope: null, retryAt: null, recheckAt: null });
}

/** "~12 min" / "~3 h" until the limit resets, or null when unknown. */
export function formatReset(retryAt) {
    if (!retryAt) return null;
    const minutes = Math.max(1, Math.ceil((retryAt - Date.now()) / 60000));
    return minutes < 90 ? `~${minutes} min` : `~${Math.round(minutes / 60)} h`;
}
