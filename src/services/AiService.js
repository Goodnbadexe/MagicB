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
