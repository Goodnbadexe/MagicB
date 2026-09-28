/**
 * HTML Generator
 * Generates website HTML from prompts using AI or parametric fallback
 */

import { AiService, DemoError } from '../../services/AiService';
import { ensureDemoStatus } from '../../services/demoStatus';
import { looksLikeHtml } from '../../shared/gemini';
import { analyzePrompt } from '../../core/PromptAnalyzer';
import { getThemeClasses, generateThemeStyles, getFontFamily } from '../../core/ThemeSystem';
import { t, getContentTranslations } from '../../core/i18n';
import { placeholderImage } from '../../utils/placeholderImage';

// Cache configuration
const CACHE_PREFIX = 'magicb_generation_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cache key for a prompt
 * @param {string} prompt - User prompt
 * @returns {string}
 */
function getCacheKey(prompt) {
    return CACHE_PREFIX + prompt.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Get cached HTML from localStorage
 * @param {string} cacheKey - Cache key
 * @returns {Object|null} Cached data or null
 */
function getCachedHtml(cacheKey) {
    try {
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return null;

        const data = JSON.parse(cached);
        if (Date.now() - data.timestamp > CACHE_TTL) {
            localStorage.removeItem(cacheKey);
            return null;
        }
        return data;
    } catch (e) {
        console.error('Cache read error:', e);
        return null;
    }
}

/**
 * Save HTML to localStorage cache
 * @param {string} cacheKey - Cache key
 * @param {string} html - HTML content
 */
function saveCachedHtml(cacheKey, html) {
    // Built outside the try so the quota-retry path below can reuse it.
    const payload = JSON.stringify({
        html,
        timestamp: Date.now()
    });

    try {
        localStorage.setItem(cacheKey, payload);

        // Clean up old cache entries (keep last 50)
        cleanupCache();
    } catch (e) {
        console.error('Cache write error:', e);
        // If storage is full, try to clear old entries
        if (e.name === 'QuotaExceededError') {
            clearOldCache();
            try {
                localStorage.setItem(cacheKey, payload);
            } catch (e2) {
                console.error('Cache still full after cleanup:', e2);
            }
        }
    }
}

/**
 * Clean up old cache entries, keep only the most recent 50
 */
function cleanupCache() {
    try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
        if (keys.length <= 50) return;

        // Get all entries with timestamps
        const entries = keys.map(key => {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                return { key, timestamp: data.timestamp };
            } catch {
                return { key, timestamp: 0 };
            }
        });

        // Sort by timestamp (newest first)
        entries.sort((a, b) => b.timestamp - a.timestamp);

        // Remove oldest entries
        entries.slice(50).forEach(({ key }) => {
            localStorage.removeItem(key);
        });
    } catch (e) {
        console.error('Cache cleanup error:', e);
    }
}

/**
 * Clear old cache entries (older than TTL)
 */
function clearOldCache() {
    try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
        const now = Date.now();

        keys.forEach(key => {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (now - data.timestamp > CACHE_TTL) {
                    localStorage.removeItem(key);
                }
            } catch {
                localStorage.removeItem(key);
            }
        });
    } catch (e) {
        console.error('Clear old cache error:', e);
    }
}

/**
 * @typedef {Object} GenerationResult
 * @property {string} html
 * @property {'byo'|'demo'|'cache'|'template'} source - who produced the HTML
 * @property {null|{kind: 'rate_limited'|'unavailable'|'demo_failed'|'byo_failed', scope?: string|null, message?: string}} notice
 *           why AI was not used, so the UI can offer the bring-your-own-key path
 */

/**
 * Generate HTML from prompt.
 *
 * Order: the visitor's own Gemini key (BYO) if saved -> the free demo
 * endpoint if available -> the instant parametric template. Only AI output
 * is cached, so a template shown after a demo limit is never "stuck".
 * @param {string} prompt - User prompt
 * @returns {Promise<GenerationResult>}
 */
export async function generateHtml(prompt) {
    if (!prompt || typeof prompt !== 'string') {
        return { html: generateDefaultHtml(), source: 'template', notice: null };
    }

    // Check cache
    const cacheKey = getCacheKey(prompt);
    const cached = getCachedHtml(cacheKey);
    if (cached) {
        return { html: cached.html, source: 'cache', notice: null };
    }

    // Analyze prompt
    const analysis = analyzePrompt(prompt);
    let notice = null;

    if (AiService.getKey()) {
        // Bring-your-own-key: straight from the browser to Google.
        try {
            const aiHtml = await AiService.generateWebsite(prompt, analysis);
            if (looksLikeHtml(aiHtml)) {
                saveCachedHtml(cacheKey, aiHtml);
                return { html: aiHtml, source: 'byo', notice: null };
            }
            console.warn("AI returned invalid HTML, falling back to parametric");
            notice = { kind: 'byo_failed', message: 'The AI response was not a complete page.' };
        } catch (e) {
            console.warn("AI generation failed, falling back to parametric engine:", e.message);
            notice = { kind: 'byo_failed', message: e.message };
        }
    } else {
        // Free demo on the site owner's key (rate limited server-side).
        const demo = await ensureDemoStatus();
        if (demo.status === 'available') {
            try {
                const aiHtml = await AiService.generateWithDemo(prompt);
                if (looksLikeHtml(aiHtml)) {
                    saveCachedHtml(cacheKey, aiHtml);
                    return { html: aiHtml, source: 'demo', notice: null };
                }
                notice = { kind: 'demo_failed' };
            } catch (e) {
                notice = e instanceof DemoError && e.code !== 'failed'
                    ? { kind: e.code, scope: e.scope }
                    : { kind: 'demo_failed' };
            }
        } else if (demo.status === 'exhausted') {
            notice = { kind: 'rate_limited', scope: demo.scope };
        } else {
            notice = { kind: 'unavailable' };
        }
    }

    // Fallback: instant parametric template (not cached; it is cheap).
    return { html: generateParametricHtml(analysis), source: 'template', notice };
}

/**
 * Generate HTML using parametric/template approach
 * @param {Object} analysis - Prompt analysis result
 * @returns {string} Generated HTML
 */
function generateParametricHtml(analysis) {
    const { language, title, theme, colors, content, template } = analysis;
    const themeClasses = getThemeClasses(theme, colors);
    const contentTranslations = getContentTranslations(language.code);

    // Get title
    const siteTitle = title || contentTranslations.defaultTitle;

    // Get hero text
    const heroText = content.heroText || contentTranslations.defaultHero;
    const description = content.description || contentTranslations.defaultDescription;

    // Generate theme styles
    const themeStyles = generateThemeStyles(colors, theme);
    const fontFamily = getFontFamily(language);

    // Use template sections if available
    const sectionsToInclude = template?.sections || content.sections;
    const isDark = theme.all.includes('dark');

    // Build HTML
    const sectionRenderers = {
        hero: () => generateHeroSection(heroText, description, colors.primary, language, isDark),
        features: () => generateFeaturesSection(language, themeClasses, colors.primary, isDark),
        services: () => generateFeaturesSection(language, themeClasses, colors.primary, isDark),
        about: () => generateAboutSection(language, themeClasses),
        contact: () => generateContactSection(language, themeClasses, colors.primary),
        footer: () => generateFooter(siteTitle, language, themeClasses),
        // Map other potential sections to existing renderers or placeholders
        projects: () => generateFeaturesSection(language, themeClasses, colors.primary, isDark),
        testimonials: () => generateAboutSection(language, themeClasses), // Reuse about for now
        gallery: () => generateFeaturesSection(language, themeClasses, colors.primary, isDark),
        team: () => generateAboutSection(language, themeClasses),
        menu: () => generateFeaturesSection(language, themeClasses, colors.primary, isDark),
        cta: () => generateContactSection(language, themeClasses, colors.primary)
    };

    // Filter out sections that don't have renderers to prevent errors
    const validSections = sectionsToInclude.filter(section => sectionRenderers[section] || sectionRenderers[getFallbackSection(section)]);

    // Generate sections HTML
    const sectionsHtml = validSections.map(section => {
        const renderer = sectionRenderers[section] || sectionRenderers[getFallbackSection(section)];
        return renderer ? renderer() : '';
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="${language.code}" dir="${language.dir}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${siteTitle}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
    ${getFontLink(language)}
    <style>
        body { font-family: ${fontFamily}; }
        h1, h2, h3 { font-family: ${theme.all.includes('modern') ? 'Playfair Display' : fontFamily}, serif; }
        ${themeStyles}
    </style>
</head>
<body class="${themeClasses.bg} ${themeClasses.text} min-h-screen flex flex-col ${themeClasses.pattern}">

    <!-- Navigation -->
    ${generateNavigation(siteTitle, colors.primary, language)}

    ${sectionsHtml}

</body>
</html>`;
}

/**
 * Get fallback section type if exact match not found
 */
function getFallbackSection(section) {
    if (['projects', 'gallery', 'portfolio', 'products', 'menu', 'courses', 'destinations'].includes(section)) return 'features';
    if (['team', 'testimonials', 'story', 'mission', 'history'].includes(section)) return 'about';
    if (['booking', 'appointment', 'cta', 'newsletter'].includes(section)) return 'contact';
    return null;
}

/**
 * Generate navigation HTML
 */
function generateNavigation(title, primaryColor, language) {
    const navItems = [
        { key: 'start', href: '#start' },
        { key: 'work', href: '#work' },
        { key: 'about', href: '#about' }
    ];

    return `
    <nav class="w-full p-6 flex justify-between items-center max-w-7xl mx-auto" id="start">
        <div class="text-2xl font-bold tracking-tighter" style="color: ${primaryColor};">${title}</div>
        <div class="flex gap-6 text-sm font-medium opacity-70">
            ${navItems.map(item => `
                <a href="${item.href}" class="hover:opacity-100 transition-opacity" style="color: ${primaryColor};">${t(language.code, `ui.${item.key}`, item.key)}</a>
            `).join('')}
        </div>
    </nav>`;
}

/**
 * Generate hero section HTML
 */
function generateHeroSection(heroText, description, primaryColor, language, isDark) {
    const heroImage = placeholderImage({ label: heroText, primary: primaryColor, dark: isDark });
    return `
    <main class="flex-grow flex flex-col md:flex-row items-center justify-between px-6 mt-10 md:mt-20 max-w-7xl mx-auto gap-12">
        <div class="flex-1 text-center md:text-left">
            <div class="inline-block px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-6 border border-current shadow-sm" style="color: ${primaryColor}; background-color: rgba(var(--primary-rgb), 0.1);">
                ${t(language.code, 'ui.nextGeneration', 'Next Generation')}
            </div>
        <h1 class="text-6xl md:text-8xl font-bold mb-8 leading-tight max-w-4xl">
            ${heroText}
        </h1>
        <p class="text-lg md:text-xl opacity-60 max-w-2xl mb-12 leading-relaxed">
            ${description}
        </p>
        <div class="flex gap-4 flex-wrap justify-center md:justify-start">
            <button class="px-8 py-4 rounded-full font-bold text-white shadow-lg transform hover:-translate-y-1 transition-all" style="background-color: ${primaryColor};">
                ${t(language.code, 'ui.getStarted', 'Get Started')}
            </button>
            <button class="px-8 py-4 rounded-full font-bold border hover:bg-opacity-10 transition-all" style="border-color: ${primaryColor}; color: ${primaryColor};">
                ${t(language.code, 'ui.learnMore', 'Learn More')}
            </button>
        </div>
        </div>
        </div>
        <div class="flex-1 relative w-full aspect-video md:aspect-square max-h-[500px] rounded-3xl overflow-hidden shadow-2xl transform rotate-1 hover:rotate-0 transition-all duration-700" style="-webkit-mask-image: linear-gradient(to bottom, black 80%, transparent 100%); mask-image: linear-gradient(to bottom, black 80%, transparent 100%);">
            <img src="${heroImage}" alt="Hero" class="w-full h-full object-cover" />
            <div class="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent"></div>
        </div>
    </main>`;
}

/**
 * Generate features section HTML
 */
function generateFeaturesSection(language, themeClasses, primaryColor, isDark) {
    const features = [1, 2, 3];
    const serviceLabel = t(language.code, 'ui.premiumService', 'Premium Service');
    return `
    <section class="max-w-7xl mx-auto px-6 py-24 grid grid-cols-1 md:grid-cols-3 gap-8" id="work">
        ${features.map(i => `
        <div class="${themeClasses.cardBg} p-0 rounded-3xl border ${themeClasses.border} hover:border-opacity-50 transition-all group cursor-pointer shadow-sm hover:shadow-xl overflow-hidden" style="border-color: rgba(var(--primary-rgb), 0.2);">
            <div class="h-48 overflow-hidden relative" style="-webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%); mask-image: linear-gradient(to bottom, black 50%, transparent 100%);">
                <img src="${placeholderImage({ label: `${serviceLabel} ${i}`, primary: primaryColor, dark: isDark })}" alt="Service ${i}" class="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
                <div class="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
            </div>
            <div class="p-8">
            <div class="w-12 h-12 rounded-2xl mb-6 flex items-center justify-center text-white text-xl shadow-lg transform -translate-y-14 group-hover:-translate-y-16 transition-transform" style="background-color: ${primaryColor};">
                ${i}
            </div>
            <h3 class="text-2xl font-bold mb-4">${serviceLabel} ${i}</h3>
            <p class="opacity-60 leading-relaxed">
                ${t(language.code, 'ui.serviceDescription', 'Short description of the service we provide and how it helps you succeed.')}
            </p>
        </div>
        `).join('')}
    </section>`;
}

/**
 * Generate about section HTML
 */
function generateAboutSection(language, themeClasses) {
    return `
    <section class="max-w-7xl mx-auto px-6 py-24" id="about">
        <div class="${themeClasses.cardBg} p-12 rounded-3xl border ${themeClasses.border}">
            <h2 class="text-4xl font-bold mb-6">${t(language.code, 'ui.about', 'About')}</h2>
            <p class="text-lg opacity-70 leading-relaxed">
                ${t(language.code, 'content.defaultDescription', 'Crafting digital masterpieces with pixel-perfect precision and aesthetic excellence.')}
            </p>
        </div>
    </section>`;
}

/**
 * Generate contact section HTML
 */
function generateContactSection(language, themeClasses, primaryColor) {
    return `
    <section class="max-w-7xl mx-auto px-6 py-24">
        <div class="${themeClasses.cardBg} p-12 rounded-3xl border ${themeClasses.border}">
            <h2 class="text-4xl font-bold mb-6">${t(language.code, 'ui.contact', 'Contact')}</h2>
            <form class="space-y-4">
                <input type="text" placeholder="${t(language.code, 'ui.name', 'Name')}" class="w-full p-4 rounded-lg border ${themeClasses.border} bg-transparent" />
                <input type="email" placeholder="${t(language.code, 'ui.email', 'Email')}" class="w-full p-4 rounded-lg border ${themeClasses.border} bg-transparent" />
                <textarea placeholder="${t(language.code, 'ui.message', 'Message')}" rows="4" class="w-full p-4 rounded-lg border ${themeClasses.border} bg-transparent"></textarea>
                <button type="submit" class="px-8 py-4 rounded-full font-bold text-white" style="background-color: ${primaryColor};">
                    ${t(language.code, 'ui.send', 'Send')}
                </button>
            </form>
        </div>
    </section>`;
}

/**
 * Generate footer HTML
 */
function generateFooter(title, language, themeClasses) {
    return `
    <footer class="w-full py-12 border-t ${themeClasses.border} mt-auto">
        <div class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center opacity-50 text-sm">
            <p>&copy; ${new Date().getFullYear()} ${title}. ${t(language.code, 'ui.allRightsReserved', 'All rights reserved.')}</p>
            <div class="flex gap-4 mt-4 md:mt-0">
                <a href="#" class="hover:underline">${t(language.code, 'ui.privacy', 'Privacy')}</a>
                <a href="#" class="hover:underline">${t(language.code, 'ui.terms', 'Terms')}</a>
            </div>
        </div>
    </footer>`;
}

/**
 * Get font link for language-specific fonts
 */
function getFontLink(language) {
    const fontLinks = {
        ar: '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;700&display=swap" rel="stylesheet">',
        he: '<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;700&display=swap" rel="stylesheet">',
        fa: '<link href="https://fonts.googleapis.com/css2?family=Vazir:wght@300;400;700&display=swap" rel="stylesheet">',
        zh: '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;700&display=swap" rel="stylesheet">',
        ja: '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;700&display=swap" rel="stylesheet">',
        ko: '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;700&display=swap" rel="stylesheet">',
        hi: '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@300;400;700&display=swap" rel="stylesheet">',
        th: '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;700&display=swap" rel="stylesheet">'
    };

    return fontLinks[language.code] || '';
}

/**
 * Generate default HTML
 */
function generateDefaultHtml() {
    return generateParametricHtml(analyzePrompt('build a modern website'));
}

/**
 * Clear generation cache
 */
export function clearCache() {
    try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
        keys.forEach(key => localStorage.removeItem(key));
    } catch (e) {
        console.error('Clear cache error:', e);
    }
}
