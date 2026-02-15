/**
 * HTML Generator
 * Generates website HTML from prompts using AI or parametric fallback
 */

import { AiService } from '../../services/AiService';
import { analyzePrompt } from '../../core/PromptAnalyzer';
import { getThemeClasses, generateThemeStyles, getFontFamily } from '../../core/ThemeSystem';
import { t, getContentTranslations } from '../../core/i18n';

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
    try {
        const data = {
            html,
            timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(data));
        
        // Clean up old cache entries (keep last 50)
        cleanupCache();
    } catch (e) {
        console.error('Cache write error:', e);
        // If storage is full, try to clear old entries
        if (e.name === 'QuotaExceededError') {
            clearOldCache();
            try {
                localStorage.setItem(cacheKey, JSON.stringify(data));
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
 * Generate HTML from prompt
 * @param {string} prompt - User prompt
 * @returns {Promise<string>} Generated HTML
 */
export async function generateHtml(prompt) {
    if (!prompt || typeof prompt !== 'string') {
        return generateDefaultHtml();
    }

    // Check cache
    const cacheKey = getCacheKey(prompt);
    const cached = getCachedHtml(cacheKey);
    if (cached) {
        return cached.html;
    }

    // Analyze prompt
    const analysis = analyzePrompt(prompt);

    // Try AI Generation first
    const apiKey = AiService.getKey();
    if (apiKey) {
        try {
            console.log("Generating with AI...");
            const aiHtml = await AiService.generateWebsite(prompt, analysis);
            
            // Validate HTML before caching
            if (aiHtml && aiHtml.trim().length > 0 && aiHtml.includes('<!DOCTYPE') || aiHtml.includes('<html')) {
                // Cache the result
                saveCachedHtml(cacheKey, aiHtml);
                return aiHtml;
            } else {
                console.warn("AI returned invalid HTML, falling back to parametric");
            }
        } catch (e) {
            console.error("AI Generation failed, falling back to parametric engine", e);
            // Show user-friendly error notification
            if (e.message && !e.message.includes('No API Key')) {
                console.warn("AI error:", e.message);
            }
            // Fallthrough to parametric if AI fails
        }
    }

    // Fallback: Parametric Generator
    const html = generateParametricHtml(analysis);
    
    // Cache the result
    saveCachedHtml(cacheKey, html);
    
    return html;
}

/**
 * Generate HTML using parametric/template approach
 * @param {Object} analysis - Prompt analysis result
 * @returns {string} Generated HTML
 */
function generateParametricHtml(analysis) {
    const { language, title, theme, colors, category, content, layout, template } = analysis;
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
    
    // Build HTML
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
    ${generateNavigation(siteTitle, colors.primary, language, themeClasses)}

    <!-- Hero Section -->
    ${generateHeroSection(heroText, description, colors.primary, language, themeClasses)}

    <!-- Features/Services Section -->
    ${sectionsToInclude.includes('features') || sectionsToInclude.includes('services') ? generateFeaturesSection(language, themeClasses, colors.primary) : ''}

    <!-- About Section -->
    ${sectionsToInclude.includes('about') ? generateAboutSection(language, themeClasses) : ''}

    <!-- Contact Section -->
    ${sectionsToInclude.includes('contact') ? generateContactSection(language, themeClasses, colors.primary) : ''}

    <!-- Footer -->
    ${generateFooter(siteTitle, language, themeClasses)}

</body>
</html>`;
}

/**
 * Generate navigation HTML
 */
function generateNavigation(title, primaryColor, language, themeClasses) {
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
function generateHeroSection(heroText, description, primaryColor, language, themeClasses) {
    return `
    <main class="flex-grow flex flex-col items-center justify-center text-center px-4 mt-10 md:mt-20">
        <div class="inline-block px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-6 border ${themeClasses.border} shadow-sm" style="color: ${primaryColor}; background-color: ${primaryColor}10;">
            ${t(language.code, 'ui.nextGeneration', 'Next Generation')}
        </div>
        <h1 class="text-6xl md:text-8xl font-bold mb-8 leading-tight max-w-4xl">
            ${heroText}
        </h1>
        <p class="text-lg md:text-xl opacity-60 max-w-2xl mb-12 leading-relaxed">
            ${description}
        </p>
        <div class="flex gap-4 flex-wrap justify-center">
            <button class="px-8 py-4 rounded-full font-bold text-white shadow-lg transform hover:-translate-y-1 transition-all" style="background-color: ${primaryColor};">
                ${t(language.code, 'ui.getStarted', 'Get Started')}
            </button>
            <button class="px-8 py-4 rounded-full font-bold border ${themeClasses.border} hover:bg-opacity-10 transition-all" style="border-color: ${primaryColor}; color: ${primaryColor};">
                ${t(language.code, 'ui.learnMore', 'Learn More')}
            </button>
        </div>
    </main>`;
}

/**
 * Generate features section HTML
 */
function generateFeaturesSection(language, themeClasses, primaryColor) {
    const features = [1, 2, 3];
    return `
    <section class="max-w-7xl mx-auto px-6 py-24 grid grid-cols-1 md:grid-cols-3 gap-8" id="work">
        ${features.map(i => `
        <div class="${themeClasses.cardBg} p-8 rounded-3xl border ${themeClasses.border} hover:border-opacity-50 transition-all group cursor-pointer shadow-sm hover:shadow-md" style="border-color: ${primaryColor}40;">
            <div class="w-12 h-12 rounded-2xl mb-6 flex items-center justify-center text-white text-xl" style="background-color: ${primaryColor};">
                ${i}
            </div>
            <h3 class="text-2xl font-bold mb-4">${t(language.code, 'ui.premiumService', 'Premium Service')} ${i}</h3>
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
