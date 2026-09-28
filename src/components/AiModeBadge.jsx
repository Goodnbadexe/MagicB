import React from 'react';
import { Sparkles, KeyRound } from 'lucide-react';
import { useDemoStatus, formatReset } from '../services/demoStatus';

/**
 * One honest line on the start screen saying which AI mode is active:
 * the visitor's own key, the free demo (with what is left), or neither.
 * @param {{ hasApiKey: boolean, onManageKey: () => void }} props
 */
export default function AiModeBadge({ hasApiKey, onManageKey }) {
    const demo = useDemoStatus();

    let icon = Sparkles;
    let text;
    let action = 'Use your own Gemini key';

    if (hasApiKey) {
        icon = KeyRound;
        text = 'AI mode: your own Gemini key (unlimited, stays in this browser)';
        action = 'Manage key';
    } else if (demo.status === 'available') {
        const n = demo.remaining;
        text = `Demo — ${n} free generation${n === 1 ? '' : 's'} left, no key needed`;
    } else if (demo.status === 'exhausted') {
        const reset = demo.scope === 'ip' ? formatReset(demo.retryAt) : null;
        text = `Free demo limit reached${reset ? ` (resets in ${reset})` : ''}. Instant templates still work.`;
    } else if (demo.status === 'unavailable') {
        text = 'Instant templates work without a key. Add a free Gemini key for AI generation.';
        action = 'Add a Gemini key';
    } else {
        return null; // still checking; avoid flashing the wrong mode
    }

    const Icon = icon;
    return (
        <div
            data-testid="ai-mode-badge"
            className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-white/70 px-4 text-center"
        >
            <span className="inline-flex items-center gap-1.5">
                <Icon size={14} aria-hidden="true" />
                {text}
            </span>
            <button
                type="button"
                onClick={onManageKey}
                className="underline underline-offset-2 text-white/90 hover:text-white"
            >
                {action}
            </button>
        </div>
    );
}
