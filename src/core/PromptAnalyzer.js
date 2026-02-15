/**
 * Prompt Analyzer
 * Extracts context, intent, and design preferences from user prompts
 */

import { detectLanguage } from './LanguageDetector.js';
import { findCategoryByKeyword, selectTemplate } from '../config/templates.js';

/**
 * Analyzes a prompt and extracts structured information
 * @param {string} prompt - User input prompt
 * @returns {Object} Analyzed prompt data
 */
export function analyzePrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') {
        return getDefaultAnalysis();
    }

    const normalized = prompt.trim();
    const lower = normalized.toLowerCase();

    // Language detection
    const language = detectLanguage(normalized);

    // Extract title (if specified)
    const title = extractTitle(normalized);

    // Detect theme preferences
    const theme = detectTheme(lower);

    // Detect color preferences
    const colors = detectColors(lower);

    // Detect website type/category
    const category = detectCategory(lower);

    // Extract content hints
    const content = extractContentHints(normalized, lower, language.code);

    // Detect layout/style preferences
    const layout = detectLayout(lower);

    // Extract any specific requirements
    const requirements = extractRequirements(normalized, lower);

    // Select template based on analysis
    const template = selectTemplate({
        category,
        theme,
        layout
    });

    return {
        original: normalized,
        language,
        title,
        theme,
        colors,
        category,
        content,
        layout,
        requirements,
        keywords: extractKeywords(normalized),
        template
    };
}

/**
 * Extract title from prompt
 * @param {string} prompt - Original prompt
 * @returns {string|null}
 */
function extractTitle(prompt) {
    // Patterns: "titled 'X'", "title: X", "called X", "named X"
    const patterns = [
        /titled\s+["'](.+?)["']/i,
        /title:\s*(.+?)(?:\s|$)/i,
        /called\s+["']?(.+?)["']?(?:\s|$)/i,
        /named\s+["']?(.+?)["']?(?:\s|$)/i,
        /["'](.+?)["']\s+(?:website|site|page)/i
    ];

    for (const pattern of patterns) {
        const match = prompt.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }

    return null;
}

/**
 * Detect theme preferences
 * @param {string} lower - Lowercase prompt
 * @returns {Object}
 */
function detectTheme(lower) {
    const themes = {
        dark: ['dark', 'night', 'cyber', 'space', 'black', 'noir', 'blackout'],
        light: ['light', 'bright', 'day', 'white', 'clean', 'minimal'],
        modern: ['modern', 'contemporary', 'futuristic', 'tech', 'digital'],
        classic: ['classic', 'traditional', 'vintage', 'retro', 'old'],
        minimal: ['minimal', 'simple', 'clean', 'bare', 'stark'],
        colorful: ['colorful', 'vibrant', 'bright', 'rainbow', 'multicolor'],
        professional: ['professional', 'business', 'corporate', 'formal'],
        playful: ['playful', 'fun', 'creative', 'whimsical', 'casual']
    };

    const detected = [];
    for (const [theme, keywords] of Object.entries(themes)) {
        if (keywords.some(kw => lower.includes(kw))) {
            detected.push(theme);
        }
    }

    return {
        primary: detected[0] || 'modern',
        all: detected.length > 0 ? detected : ['modern']
    };
}

/**
 * Detect color preferences
 * @param {string} lower - Lowercase prompt
 * @returns {Object}
 */
function detectColors(lower) {
    const colorMap = {
        red: ['red', 'crimson', 'scarlet', 'spicy', 'fire', 'passion'],
        blue: ['blue', 'azure', 'ocean', 'sky', 'navy', 'cerulean'],
        green: ['green', 'emerald', 'nature', 'forest', 'mint', 'lime'],
        purple: ['purple', 'violet', 'lavender', 'magic', 'royal'],
        orange: ['orange', 'amber', 'tangerine', 'sunset'],
        pink: ['pink', 'rose', 'blush', 'fuchsia'],
        yellow: ['yellow', 'gold', 'sunshine', 'amber'],
        black: ['black', 'monochrome', 'dark', 'charcoal'],
        white: ['white', 'ivory', 'cream', 'snow'],
        brown: ['brown', 'coffee', 'cafe', 'chocolate', 'tan', 'beige'],
        teal: ['teal', 'turquoise', 'cyan', 'aqua'],
        gray: ['gray', 'grey', 'silver', 'ash']
    };

    const detected = [];
    for (const [color, keywords] of Object.entries(colorMap)) {
        if (keywords.some(kw => lower.includes(kw))) {
            detected.push(color);
        }
    }

    // Default color palette
    const defaultPrimary = '#2563eb'; // Blue
    const colorHexMap = {
        red: '#dc2626',
        blue: '#2563eb',
        green: '#16a34a',
        purple: '#9333ea',
        orange: '#ea580c',
        pink: '#db2777',
        yellow: '#fbbf24',
        black: '#171717',
        white: '#ffffff',
        brown: '#78350f',
        teal: '#14b8a6',
        gray: '#6b7280'
    };

    return {
        primary: detected.length > 0 ? colorHexMap[detected[0]] : defaultPrimary,
        secondary: detected.length > 1 ? colorHexMap[detected[1]] : null,
        palette: detected.map(c => colorHexMap[c] || defaultPrimary),
        names: detected.length > 0 ? detected : ['blue']
    };
}

/**
 * Detect website category/type
 * @param {string} lower - Lowercase prompt
 * @returns {string}
 */
function detectCategory(lower) {
    // Use template system to find category
    return findCategoryByKeyword(lower);
}

/**
 * Extract content hints from prompt
 * @param {string} prompt - Original prompt
 * @param {string} lower - Lowercase prompt
 * @param {string} langCode - Detected language code
 * @returns {Object}
 */
function extractContentHints(prompt, lower, langCode) {
    const isArabic = langCode === 'ar';
    const isRTL = ['ar', 'fa'].includes(langCode);

    // Hero text based on category
    let heroText = null;
    if (lower.includes('portfolio')) {
        heroText = isArabic ? 'مرحباً، أنا أصنع.' : 'Hello, I Create.';
    } else if (lower.includes('agency')) {
        heroText = isArabic ? 'نحن نبني التجارب الرقمية.' : 'We Build Digital Experiences.';
    } else if (lower.includes('shop') || lower.includes('store')) {
        heroText = isArabic ? 'منتجات عالية الجودة لك.' : 'Quality Products for You.';
    } else if (lower.includes('coffee') || lower.includes('cafe')) {
        heroText = isArabic ? 'مخمر طازج لك.' : 'Freshly Brewed for You.';
    } else if (lower.includes('restaurant') || lower.includes('food')) {
        heroText = isArabic ? 'طعم لا يُنسى.' : 'A Taste to Remember.';
    } else {
        heroText = isArabic ? 'نحن نبني المستقبل.' : 'Welcome to the Future.';
    }

    // Description text
    let description = null;
    if (isArabic) {
        description = 'نحن نساعدك على تحويل أفكارك إلى واقع رقمي مذهل باستخدام أحدث التقنيات.';
    } else {
        description = 'Crafting digital masterpieces with pixel-perfect precision and aesthetic excellence.';
    }

    // Extract specific content mentions
    const hasContact = lower.includes('contact') || lower.includes('form') || lower.includes('email');
    const hasAbout = lower.includes('about') || lower.includes('story') || lower.includes('team');
    const hasServices = lower.includes('service') || lower.includes('feature') || lower.includes('offer');

    return {
        heroText,
        description,
        hasContact,
        hasAbout,
        hasServices,
        sections: {
            hero: true,
            features: hasServices,
            about: hasAbout,
            contact: hasContact,
            footer: true
        }
    };
}

/**
 * Detect layout preferences
 * @param {string} lower - Lowercase prompt
 * @returns {Object}
 */
function detectLayout(lower) {
    return {
        grid: lower.includes('grid') || lower.includes('cards'),
        list: lower.includes('list') || lower.includes('vertical'),
        sidebar: lower.includes('sidebar') || lower.includes('side'),
        fullwidth: lower.includes('full') || lower.includes('wide'),
        centered: !lower.includes('full') && !lower.includes('wide')
    };
}

/**
 * Extract specific requirements
 * @param {string} prompt - Original prompt
 * @param {string} lower - Lowercase prompt
 * @returns {Array}
 */
function extractRequirements(prompt, lower) {
    const requirements = [];

    if (lower.includes('responsive') || lower.includes('mobile')) {
        requirements.push('responsive');
    }
    if (lower.includes('animation') || lower.includes('animate')) {
        requirements.push('animations');
    }
    if (lower.includes('form') || lower.includes('contact')) {
        requirements.push('contact-form');
    }
    if (lower.includes('gallery') || lower.includes('image')) {
        requirements.push('image-gallery');
    }
    if (lower.includes('video') || lower.includes('youtube')) {
        requirements.push('video-embed');
    }
    if (lower.includes('map') || lower.includes('location')) {
        requirements.push('map');
    }

    return requirements;
}

/**
 * Extract keywords from prompt
 * @param {string} prompt - Original prompt
 * @returns {Array}
 */
function extractKeywords(prompt) {
    // Remove common stop words and extract meaningful keywords
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'build', 'create', 'make', 'generate', 'design', 'website', 'site', 'page'];
    
    const words = prompt.toLowerCase()
        .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.includes(word));

    return [...new Set(words)]; // Remove duplicates
}

/**
 * Get default analysis object
 * @returns {Object}
 */
function getDefaultAnalysis() {
    const defaultTemplate = selectTemplate({
        category: 'general',
        theme: { primary: 'modern', all: ['modern'] },
        layout: { centered: true }
    });
    
    return {
        original: '',
        language: { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', font: 'Inter, Outfit, Arial', isRTL: false },
        title: null,
        theme: { primary: 'modern', all: ['modern'] },
        colors: { primary: '#2563eb', secondary: null, palette: ['#2563eb'], names: ['blue'] },
        category: 'general',
        content: {
            heroText: 'Welcome to the Future.',
            description: 'Crafting digital masterpieces with pixel-perfect precision and aesthetic excellence.',
            hasContact: false,
            hasAbout: false,
            hasServices: false,
            sections: { hero: true, features: true, about: false, contact: false, footer: true }
        },
        layout: { grid: false, list: false, sidebar: false, fullwidth: false, centered: true },
        requirements: [],
        keywords: [],
        template: defaultTemplate
    };
}
