/**
 * AI Service
 * Handles AI-powered website generation using Gemini API
 */

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
        if (!key) throw new Error("No API Key configured");

        // Build enhanced system prompt with multilingual support
        const systemPrompt = buildSystemPrompt(analysis);

        try {
            // Using Google Gemini API endpoint
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: systemPrompt + "\n\nUser Request: " + prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 8192,
                    }
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || "AI API Request Failed");
            }

            const data = await response.json();
            let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!generatedText) throw new Error("No content generated");

            // Cleanup markdown if AI ignores rule
            generatedText = generatedText
                .replace(/```html/g, '')
                .replace(/```/g, '')
                .replace(/^[\s\n]*/, '') // Remove leading whitespace
                .trim();

            return generatedText;

        } catch (error) {
            console.error("AI Generation Error:", error);
            throw error;
        }
    }
};

/**
 * Build enhanced system prompt with context from analysis
 * @param {Object} analysis - Prompt analysis result
 * @returns {string}
 */
function buildSystemPrompt(analysis) {
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
- Ensure proper RTL support if dir="rtl" (right-to-left layout)`;}

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
- Include sections: ${Object.entries(analysis.content.sections).filter(([_, v]) => v).map(([k]) => k).join(', ')}`;
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
