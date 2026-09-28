/**
 * AI Service
 * Handles AI-powered website generation using Gemini API
 */

import {
    DEFAULT_MODEL,
    buildGenerateBody,
    cleanGeneratedHtml,
    extractText,
    geminiEndpoint
} from '../shared/gemini.js';
import {
    DEMO_ENDPOINT,
    applyDemoQuota,
    isJsonResponse,
    isMissingEndpoint,
    markDemoExhausted,
    markDemoUnavailable
} from './demoStatus.js';

// Bring-your-own-key requests go straight from the browser to Google using
// the same model id as the server-side demo (see src/shared/gemini.js).
const GEMINI_ENDPOINT = geminiEndpoint(DEFAULT_MODEL);

/**
 * Request headers for the Gemini API. The key travels in the
 * `x-goog-api-key` header rather than the `?key=` query string so it is not
 * captured wherever request URLs are recorded (proxy/server access logs,
 * HAR exports, "copy as URL/cURL", error-reporting breadcrumbs).
 * @param {string} key - Gemini API key
 */
function geminiHeaders(key) {
    return {
        "Content-Type": "application/json",
        "x-goog-api-key": key
    };
}

/**
 * Failure of a free-demo generation.
 * code: 'rate_limited' (429) | 'unavailable' (503/404/no API) | 'failed'
 */
export class DemoError extends Error {
    constructor(code, { scope = null, retryAfter = null } = {}) {
        super(`Demo generation ${code}`);
        this.name = 'DemoError';
        this.code = code;
        this.scope = scope;
        this.retryAfter = retryAfter;
    }
}

/**
 * Service to handle AI generation request.
 */
export const AiService = {
    /**
     * Store the API key in local storage
     */
    setKey: (key) => {
        if (!key) return;
        localStorage.setItem('magicb_ai_key', key);
    },

    /**
     * Get the API key from local storage
     */
    getKey: () => {
        return localStorage.getItem('magicb_ai_key');
    },

    /**
     * Whether the visitor saved their own key (bring-your-own-key mode).
     * Safe when storage is blocked (private mode, sandboxing).
     */
    hasKey: () => {
        try {
            return !!localStorage.getItem('magicb_ai_key');
        } catch {
            return false;
        }
    },

    /**
     * Generate website HTML using the configured API Key (Gemini)
     * @param {string} prompt - User prompt
     * @param {Object} analysis - Optional prompt analysis for better context
     */
    generateWebsite: async (prompt, analysis = null) => {
        const key = AiService.getKey();
        if (!key) throw new Error("No API Key configured. Click the AI status icon to set one.");

        try {
            // Using Google Gemini API endpoint
            const response = await fetch(GEMINI_ENDPOINT, {
                method: "POST",
                headers: geminiHeaders(key),
                body: JSON.stringify(buildGenerateBody(prompt, analysis))
            });

            if (!response.ok) {
                const err = await response.json();
                let errorMessage = err.error?.message || "AI API Request Failed";

                // User-friendly error mapping
                if (response.status === 400) errorMessage = "Invalid Request. Please check your API Key.";
                if (response.status === 401 || response.status === 403) errorMessage = "Invalid API Key. Please check your settings.";
                if (response.status === 429) errorMessage = "Rate Limit Exceeded. Please try again later.";

                throw new Error(errorMessage);
            }

            const data = await response.json();
            const generatedText = extractText(data);

            if (!generatedText) throw new Error("No content generated");

            // Cleanup markdown if AI ignores rule
            return cleanGeneratedHtml(generatedText);

        } catch (error) {
            console.error("AI Generation Error:", error);
            throw error;
        }
    },

    /**
     * Generate website HTML through the free demo endpoint (site owner's key,
     * rate limited server-side). Only the prompt is sent; the server builds
     * the full Gemini request itself.
     * @param {string} prompt - User prompt
     * @returns {Promise<string>} Generated HTML
     * @throws {DemoError}
     */
    generateWithDemo: async (prompt) => {
        let response;
        try {
            response = await fetch(DEMO_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
        } catch {
            throw new DemoError('failed');
        }

        const data = isJsonResponse(response) ? await response.json().catch(() => null) : null;

        if (response.status === 429) {
            markDemoExhausted(data?.scope ?? null, data?.retryAfter ?? null);
            throw new DemoError('rate_limited', { scope: data?.scope ?? null, retryAfter: data?.retryAfter ?? null });
        }
        if (response.status === 503) {
            markDemoUnavailable(); // e.g. owner quota exhausted: re-probed with backoff
            throw new DemoError('unavailable');
        }
        if (isMissingEndpoint(response)) {
            markDemoUnavailable({ permanent: true });
            throw new DemoError('unavailable');
        }
        if (!response.ok || !data) throw new DemoError('failed');

        if (data.demo) applyDemoQuota(data.demo);

        const generatedText = cleanGeneratedHtml(extractText(data));
        if (!generatedText) throw new DemoError('failed');
        return generatedText;
    },

    /**
     * Refine existing HTML based on user instruction
     * @param {string} currentHtml - The current HTML content
     * @param {string} instruction - User's refinement instruction
     */
    refineWebsite: async (currentHtml, instruction) => {
        const key = AiService.getKey();
        if (!key) throw new Error("No API Key configured");

        const systemPrompt = `You are an expert web developer.
Your task is to EDIT the provided HTML based on the USER INSTRUCTION.

CRITICAL RULES:
1. Return ONLY the complete, valid, updated HTML code. 
2. Do not wrap in markdown blocks.
3. Keep existing styles and structure unless asked to change.
4. Maintain responsiveness.
5. Do NOT explain your changes, just return the code.`;

        try {
            const response = await fetch(GEMINI_ENDPOINT, {
                method: "POST",
                headers: geminiHeaders(key),
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `${systemPrompt}\n\nCURRENT HTML:\n${currentHtml}\n\nUSER INSTRUCTION: ${instruction}`
                        }]
                    }]
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || "Refinement Failed");
            }

            const data = await response.json();
            const generatedText = extractText(data);

            if (!generatedText) throw new Error("No content generated");

            return cleanGeneratedHtml(generatedText);

        } catch (error) {
            console.error("AI Refinement Error:", error);
            throw error;
        }
    }
};
