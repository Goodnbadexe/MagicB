import React from 'react';
import { Info, X } from 'lucide-react';
import { formatReset, useDemoStatus } from '../../services/demoStatus';

/**
 * Explains why the preview is an instant template instead of AI output and
 * offers the bring-your-own-key path.
 * @param {{
 *   notice: { kind: string, scope?: string|null, message?: string },
 *   onUseKey: () => void,
 *   onDismiss: () => void
 * }} props
 */
export default function AiNotice({ notice, onUseKey, onDismiss }) {
    const demo = useDemoStatus();

    let message;
    let action = 'Use my own Gemini key';
    switch (notice.kind) {
        case 'rate_limited': {
            const reset = notice.scope === 'ip' ? formatReset(demo.retryAt) : null;
            message = notice.scope === 'daily'
                ? "Today's free demo generations are used up, so this is an instant template."
                : `You've used your free demo generations${reset ? ` (resets in ${reset})` : ''}, so this is an instant template.`;
            break;
        }
        case 'unavailable':
            message = "The free AI demo isn't available here, so this is an instant template.";
            action = 'Add a free Gemini key';
            break;
        case 'byo_failed':
            message = `Your Gemini key request failed${notice.message ? ` (${notice.message})` : ''}, so this is an instant template.`;
            action = 'Check my key';
            break;
        default:
            message = "The free AI demo couldn't finish this one, so this is an instant template. Try again, or use your own key.";
    }

    return (
        <div
            role="status"
            data-testid="ai-notice"
            className="flex items-start gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs"
            dir="ltr"
        >
            <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="flex-1 leading-relaxed">{message}</p>
            <button
                type="button"
                onClick={onUseKey}
                className="shrink-0 font-semibold underline underline-offset-2 hover:text-amber-700"
            >
                {action}
            </button>
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="shrink-0 p-0.5 rounded hover:bg-amber-100"
            >
                <X size={14} />
            </button>
        </div>
    );
}
