/**
 * Language Detection Service
 * Detects language from text input and provides language metadata
 */

// Language detection patterns (Unicode ranges and keywords)
const LANGUAGE_PATTERNS = {
    ar: {
        name: 'Arabic',
        nativeName: 'العربية',
        regex: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/,
        keywords: ['عربي', 'العربية', 'موقع', 'إنشاء', 'تصميم', 'صفحة', 'بناء'],
        dir: 'rtl',
        font: 'Cairo, Noto Sans Arabic, Arial'
    },
    fa: {
        name: 'Persian',
        nativeName: 'فارسی',
        regex: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/,
        keywords: ['فارسی', 'سایت', 'صفحه'],
        dir: 'rtl',
        font: 'Vazir, Noto Sans Arabic, Arial'
    },
    zh: {
        name: 'Chinese',
        nativeName: '中文',
        regex: /[\u4E00-\u9FFF\u3400-\u4DBF]/,
        keywords: ['中文', '网站', '页面'],
        dir: 'ltr',
        font: 'Noto Sans SC, PingFang SC, Arial'
    },
    ja: {
        name: 'Japanese',
        nativeName: '日本語',
        regex: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/,
        keywords: ['日本語', 'ウェブサイト', 'ページ'],
        dir: 'ltr',
        font: 'Noto Sans JP, Hiragino Sans, Arial'
    },
    ko: {
        name: 'Korean',
        nativeName: '한국어',
        regex: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/,
        keywords: ['한국어', '웹사이트', '페이지'],
        dir: 'ltr',
        font: 'Noto Sans KR, Malgun Gothic, Arial'
    },
    ru: {
        name: 'Russian',
        nativeName: 'Русский',
        regex: /[\u0400-\u04FF]/,
        keywords: ['русский', 'сайт', 'страница', 'создать'],
        dir: 'ltr',
        font: 'Roboto, Noto Sans, Arial'
    },
    es: {
        name: 'Spanish',
        nativeName: 'Español',
        regex: /\b(crear|diseñar|sitio|página|construir|español)\b/i,
        keywords: ['crear', 'diseñar', 'sitio', 'página', 'español'],
        dir: 'ltr',
        font: 'Inter, Roboto, Arial'
    },
    fr: {
        name: 'French',
        nativeName: 'Français',
        regex: /\b(créer|concevoir|site|page|construire|français)\b/i,
        keywords: ['créer', 'concevoir', 'site', 'page', 'français'],
        dir: 'ltr',
        font: 'Inter, Roboto, Arial'
    },
    de: {
        name: 'German',
        nativeName: 'Deutsch',
        regex: /\b(erstellen|entwerfen|website|seite|deutsch)\b/i,
        keywords: ['erstellen', 'entwerfen', 'website', 'seite', 'deutsch'],
        dir: 'ltr',
        font: 'Inter, Roboto, Arial'
    },
    pt: {
        name: 'Portuguese',
        nativeName: 'Português',
        regex: /\b(criar|projetar|site|página|português)\b/i,
        keywords: ['criar', 'projetar', 'site', 'página', 'português'],
        dir: 'ltr',
        font: 'Inter, Roboto, Arial'
    },
    hi: {
        name: 'Hindi',
        nativeName: 'हिन्दी',
        regex: /[\u0900-\u097F]/,
        keywords: ['हिन्दी', 'वेबसाइट', 'पृष्ठ'],
        dir: 'ltr',
        font: 'Noto Sans Devanagari, Arial'
    },
    th: {
        name: 'Thai',
        nativeName: 'ไทย',
        regex: /[\u0E00-\u0E7F]/,
        keywords: ['ไทย', 'เว็บไซต์', 'หน้า'],
        dir: 'ltr',
        font: 'Noto Sans Thai, Arial'
    },
    en: {
        name: 'English',
        nativeName: 'English',
        regex: /\b(build|create|make|generate|design|construct|website|site|page|landing|app)\b/i,
        keywords: ['build', 'create', 'make', 'generate', 'design', 'website', 'site', 'page'],
        dir: 'ltr',
        font: 'Inter, Outfit, Arial'
    }
};

/**
 * Detects language from text input
 * @param {string} text - Input text to analyze
 * @returns {Object} Language detection result
 */
export function detectLanguage(text) {
    if (!text || typeof text !== 'string') {
        return getLanguageInfo('en');
    }

    const normalizedText = text.trim();
    const lowerText = normalizedText.toLowerCase();

    // Check for explicit language mentions first
    for (const [code, info] of Object.entries(LANGUAGE_PATTERNS)) {
        if (code === 'en') continue; // Skip English for explicit check
        
        // Check if language name or native name is mentioned
        if (lowerText.includes(info.name.toLowerCase()) || 
            lowerText.includes(info.nativeName.toLowerCase()) ||
            lowerText.includes(code)) {
            return getLanguageInfo(code);
        }
    }

    // Check for keyword matches
    for (const [code, info] of Object.entries(LANGUAGE_PATTERNS)) {
        if (info.keywords && info.keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
            return getLanguageInfo(code);
        }
    }

    // Check for character pattern matches (for non-Latin scripts)
    for (const [code, info] of Object.entries(LANGUAGE_PATTERNS)) {
        if (info.regex && info.regex.test(normalizedText)) {
            return getLanguageInfo(code);
        }
    }

    // Default to English
    return getLanguageInfo('en');
}

/**
 * Get language information by code
 * @param {string} code - Language code (e.g., 'en', 'ar', 'zh')
 * @returns {Object} Language information
 */
export function getLanguageInfo(code) {
    const info = LANGUAGE_PATTERNS[code] || LANGUAGE_PATTERNS.en;
    return {
        code: code || 'en',
        name: info.name,
        nativeName: info.nativeName,
        dir: info.dir,
        font: info.font,
        isRTL: info.dir === 'rtl'
    };
}

/**
 * Check if text contains RTL language
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export function isRTL(text) {
    return detectLanguage(text).isRTL;
}

/**
 * Get all supported languages
 * @returns {Array} Array of language objects
 */
export function getSupportedLanguages() {
    return Object.entries(LANGUAGE_PATTERNS).map(([code, info]) => ({
        code,
        name: info.name,
        nativeName: info.nativeName,
        dir: info.dir
    }));
}
