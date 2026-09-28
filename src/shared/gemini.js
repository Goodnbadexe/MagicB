/**
 * Gemini request helpers shared by the browser (bring-your-own-key mode, see
 * src/services/AiService.js) and the Vercel demo function (api/generate.js).
 *
 * Keep this module free of browser-only (window, localStorage) and Node-only
 * (process, node:*) APIs: it is imported from both sides.
 */

/**
 * The single default Gemini model id for both modes.
 *
 * `gemini-flash-latest` is the model Google's official `@google/genai` SDK
 * uses throughout its README (v2.24.0, published 2026-09-22). It is an alias
 * Google keeps pointed at the current Flash model, so it will not be shut
 * down the way the previously hard-coded `gemini-1.5-flash` was (that id is
 * listed as prohibited/deprecated in the SDK's codegen_instructions.md).
 * To pin an exact version on the server set GEMINI_MODEL (for example
 * `gemini-3-flash-preview`, the SDK's current recommendation for general
 * text tasks).
 */
export const DEFAULT_MODEL = 'gemini-flash-latest';

/** Longest prompt the demo endpoint accepts (UTF-16 code units). */
export const MAX_PROMPT_CHARS = 2000;

/** Output cap for a single generation (a full single-file page fits well within it). */
export const MAX_OUTPUT_TOKENS = 8192;

/** Model ids are plain slugs; anything else is a misconfiguration. */
export function isValidModelId(model) {
    return typeof model === 'string' && /^[a-z0-9][a-z0-9.-]{0,63}$/i.test(model);
}

export function geminiEndpoint(model = DEFAULT_MODEL) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

/**
 * Request body for a first-draft website generation.
 * Sampling parameters are left at the model's defaults so the same body is
 * valid for whichever Flash model the alias (or GEMINI_MODEL) resolves to.
 * @param {string} prompt - The user's request
 * @param {Object|null} analysis - Output of analyzePrompt() for extra context
 */
export function buildGenerateBody(prompt, analysis = null, { maxOutputTokens = MAX_OUTPUT_TOKENS } = {}) {
    return {
        systemInstruction: { parts: [{ text: buildSystemPrompt(analysis) }] },
        contents: [{ role: 'user', parts: [{ text: `User Request: ${prompt}` }] }],
        generationConfig: { maxOutputTokens }
    };
}

/**
 * Concatenate the answer text of the first candidate, skipping "thought"
 * parts that thinking models may return.
 * @param {Object} data - Gemini generateContent response JSON
 * @returns {string}
 */
export function extractText(data) {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts
        .filter(part => part && typeof part.text === 'string' && !part.thought)
        .map(part => part.text)
        .join('');
}

/** Strip markdown fences the model sometimes adds despite instructions. */
export function cleanGeneratedHtml(text) {
    return String(text || '')
        .replace(/```html/gi, '')
        .replace(/```/g, '')
        .trim();
}

/** True when the text looks like a complete HTML document. */
export function looksLikeHtml(text) {
    return /<!doctype html|<html[\s>]/i.test(String(text || ''));
}

/**
 * Build enhanced system prompt with context from analysis
 * @param {Object} analysis - Prompt analysis result
 * @returns {string}
 */
export function buildSystemPrompt(analysis) {
    let prompt = `You are an expert web developer and UI designer specializing in creating beautiful, modern websites.
Your task is to generate a SINGLE-FILE HTML/CSS document based on the user's request.

CRITICAL RULES:
1. Return ONLY the raw HTML code. Do not wrap in markdown blocks or \`\`\`.
2. Include all CSS inside a <style> tag in the <head>.
3. Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
4. Ensure the layout is fully responsive (mobile-first approach).
5. Do NOT include any external JavaScripts that might fail (keep it static HTML/CSS).
6. Use semantic HTML5 elements (header, nav, main, section, footer).
7. Include proper meta tags for SEO and viewport.
8. The website should have clear sections: Hero, Features/Services, About (optional), Contact (optional), Footer.
9. Use modern design principles: proper spacing, typography hierarchy, smooth transitions.
10. Make it accessible: proper heading structure, alt text for images, ARIA labels where needed.`;

    // Add language-specific instructions
    if (analysis && analysis.language) {
        const lang = analysis.language;
        prompt += `\n\nLANGUAGE & DIRECTIONALITY:
- Language: ${lang.name} (${lang.code})
- Text direction: ${lang.dir}
- Set <html lang="${lang.code}" dir="${lang.dir}">
- Use appropriate fonts for ${lang.name}: ${lang.font}
- All UI text should be in ${lang.name} (${lang.nativeName})
- Ensure proper RTL support if dir="rtl" (right-to-left layout)`;
    }

    // Add theme instructions
    if (analysis && analysis.theme) {
        prompt += `\n\nDESIGN THEME:
- Primary theme: ${analysis.theme.primary}
- Additional themes: ${analysis.theme.all.join(', ')}
- Use ${analysis.theme.all.includes('dark') ? 'dark' : 'light'} color scheme
- Apply ${analysis.theme.all.includes('minimal') ? 'minimalist' : 'rich'} design approach`;
    }

    // Add color instructions
    if (analysis && analysis.colors) {
        prompt += `\n\nCOLOR PALETTE:
- Primary color: ${analysis.colors.primary}
- Use this color for buttons, links, accents, and highlights
- Create a harmonious color scheme based on this primary color`;
    }

    // Add category-specific instructions
    if (analysis && analysis.category) {
        const categoryGuidance = {
            portfolio: 'Focus on showcasing work with a gallery/grid layout. Include project cards with images.',
            agency: 'Professional business look with services section, team section, and strong call-to-actions.',
            shop: 'E-commerce focused with product cards, pricing, and shopping-oriented design.',
            blog: 'Content-first design with article cards, reading-friendly typography, and sidebar.',
            landing: 'Conversion-focused with strong hero, benefits section, testimonials, and clear CTA.',
            restaurant: 'Appetizing design with menu items, food imagery, warm colors, and reservation form.',
            saas: 'Tech-forward design with feature highlights, pricing tables, and demo sections.',
            education: 'Clean, organized layout with course cards, learning paths, and educational content.',
            healthcare: 'Trustworthy, clean design with service cards, doctor profiles, and appointment booking.',
            realestate: 'Property showcase with image galleries, property cards, and location maps.',
            fitness: 'Energetic design with workout programs, trainer profiles, and class schedules.',
            photography: 'Visual-focused design with image galleries and portfolio showcases.',
            music: 'Dynamic design with music players, tour dates, and artist information.',
            travel: 'Adventure-focused design with destination showcases and booking options.',
            nonprofit: 'Impact-focused design with mission statements, programs, and donation options.',
            law: 'Professional, trustworthy design with practice areas and attorney profiles.',
            consulting: 'Executive design with services, case studies, and expertise areas.',
            tech: 'Innovation-focused design with products, features, and technology highlights.',
            fashion: 'Style-focused design with collections, lookbooks, and brand showcases.',
            beauty: 'Elegant design with services, products, and booking options.'
        };

        if (categoryGuidance[analysis.category]) {
            prompt += `\n\nWEBSITE TYPE: ${analysis.category.toUpperCase()}\n${categoryGuidance[analysis.category]}`;
        }
    }

    // Add template information if available
    if (analysis && analysis.template) {
        prompt += `\n\nTEMPLATE: ${analysis.template.name}\nStyle: ${analysis.template.style}\nLayout: ${analysis.template.layout}\nSections to include: ${analysis.template.sections.join(', ')}`;
    }

    // Add content hints
    if (analysis && analysis.content) {
        prompt += `\n\nCONTENT HINTS:
- Hero text: "${analysis.content.heroText}"
- Description: "${analysis.content.description}"
- Include sections: ${analysis.content.sections.join(', ')}`;
    }

    // Add layout preferences
    if (analysis && analysis.layout) {
        prompt += `\n\nLAYOUT PREFERENCES:
- Grid layout: ${analysis.layout.grid ? 'Yes' : 'No'}
- Centered content: ${analysis.layout.centered ? 'Yes' : 'No'}
- Full width: ${analysis.layout.fullwidth ? 'Yes' : 'No'}`;
    }

    // Add requirements
    if (analysis && analysis.requirements && analysis.requirements.length > 0) {
        prompt += `\n\nSPECIFIC REQUIREMENTS:
- ${analysis.requirements.join('\n- ')}`;
    }

    prompt += `\n\nRemember: Create a beautiful, modern, responsive website that matches the user's vision. Use the provided context to make intelligent design decisions.`;

    return prompt;
}
