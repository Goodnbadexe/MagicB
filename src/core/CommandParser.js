
import { MACROS, ENGINES } from '../config/macros.js';
import { detectLanguage } from './LanguageDetector.js';

export const COMMAND_Types = {
    REDIRECT: 'REDIRECT',
    BUILD: 'BUILD',
    SEARCH: 'SEARCH',
    CALCULATOR: 'CALCULATOR',
    CONFIG: 'CONFIG',
};

// Multilingual build keywords
const BUILD_KEYWORDS = [
    // English
    'build', 'create', 'make', 'generate', 'design', 'construct',
    'website', 'site', 'page', 'landing', 'app',
    // Arabic
    'موقع', 'إنشاء', 'تصميم', 'صفحة', 'بناء',
    // Spanish
    'crear', 'diseñar', 'construir', 'sitio', 'página',
    // French
    'créer', 'concevoir', 'construire', 'site',
    // German
    'erstellen', 'entwerfen', 'website', 'seite',
    // Portuguese
    'criar', 'projetar', 'site', 'página',
    // Chinese
    '创建', '设计', '网站', '页面',
    // Japanese
    '作成', 'デザイン', 'ウェブサイト', 'ページ',
    // Korean
    '만들기', '디자인', '웹사이트', '페이지',
    // Russian
    'создать', 'дизайн', 'сайт', 'страница'
];

/**
 * Parsed result of a command
 * @typedef {Object} CommandResult
 * @property {string} type - 'REDIRECT' | 'BUILD' | 'SEARCH'
 * @property {Object} [macro] - The macro object if found
 * @property {string} [url] - The final URL for redirect
 * @property {string} query - The original query
 * @property {string} [param] - The parameter for the macro (e.g. video ID)
 */

/**
 * Parses the user input string.
 * @param {string} input 
 * @returns {CommandResult}
 */
export function parseCommand(input) {
    if (!input || !input.trim()) return null;
    const trimmed = input.trim();

    // 1. Check for Website Builder Prompt
    // Improved heuristics: Works with shorter prompts, better keyword detection
    const lower = trimmed.toLowerCase();
    const hasBuildKeyword = BUILD_KEYWORDS.some(kw => lower.includes(kw));
    
    // More lenient: if it has build keywords, it's likely a build command
    // Also check for website-related terms even without explicit "build"
    const websiteTerms = ['website', 'site', 'page', 'landing', 'app', 'portfolio', 'shop', 'blog', 'restaurant', 'agency'];
    const hasWebsiteTerm = websiteTerms.some(term => lower.includes(term));
    
    // If it has build keywords OR website terms with some context (length > 5)
    if ((hasBuildKeyword || hasWebsiteTerm) && trimmed.length > 5) {
        return {
            type: COMMAND_Types.BUILD,
            query: trimmed
        };
    }

    // 2. Check for Macros by trigger (primary command mode)
    // Format: "trigger" or "trigger parameter"
    const parts = trimmed.split(' ');
    const trigger = parts[0].toLowerCase();
    const param = parts.slice(1).join(' ');

    const macro = MACROS.find(m => m.triggers.includes(trigger));

    if (macro) {
        let url = macro.url;

        // If there is a param, try to find a specific command template
        if (param) {
            if (macro.commands && macro.commands.go && !parts[1].startsWith('?')) {
                // e.g. "yt dQw4w9WgXcQ" -> youtube.com/watch?v=... (depends on template)
                // For simplicity, we implement a basic replacement logic similar to legacy
                url = macro.commands.go.template
                    .replace('{@}', macro.url)
                    .replace('{$}', encodeURIComponent(param));
            } else if (macro.commands && macro.commands.search) {
                url = macro.commands.search.template
                    .replace('{@}', macro.url)
                    .replace('{$}', encodeURIComponent(param));
            }
        }

        return {
            type: COMMAND_Types.REDIRECT,
            macro,
            url,
            query: trimmed,
            param
        };
    }

    // 2b. Check for Macros by name (human-friendly mode)
    // Example: "instagram" or "instagram someuser"
    const firstWord = parts[0].toLowerCase();
    const rest = parts.slice(1).join(' ');

    const nameMacro = MACROS.find(m => m.name.toLowerCase() === firstWord);

    if (nameMacro) {
        let url = nameMacro.url;

        if (rest) {
            // Reuse command logic if this macro supports search / go
            if (nameMacro.commands && nameMacro.commands.go && !rest.startsWith('?')) {
                url = nameMacro.commands.go.template
                    .replace('{@}', nameMacro.url)
                    .replace('{$}', encodeURIComponent(rest));
            } else if (nameMacro.commands && nameMacro.commands.search) {
                url = nameMacro.commands.search.template
                    .replace('{@}', nameMacro.url)
                    .replace('{$}', encodeURIComponent(rest));
            }
        }

        return {
            type: COMMAND_Types.REDIRECT,
            macro: nameMacro,
            url,
            query: trimmed,
            param: rest
        };
    }

    // 3. Calculator Check
    // Regex allows numbers, operators, parens, and spaces.
    const mathRegex = /^[\d\s\+\-\*\/\(\)\.]*$/;
    // Must contain at least one operator to be a math expression (avoid matching just "2024")
    const hasOperator = /[\+\-\*\/]/.test(trimmed);

    if (hasOperator && mathRegex.test(trimmed)) {
        try {
            // Evaluates the math expression safely-ish
            // Note: In production you'd want a proper math parser, but for this demo:
            const result = new Function('return ' + trimmed)();
            if (Number.isFinite(result)) {
                return {
                    type: COMMAND_Types.CALCULATOR,
                    query: trimmed,
                    result: result
                };
            }
        } catch (e) {
            // Ignore syntax errors, just proceed to search
        }
    }

    // 5. Config Command Check (e.g., "config key sk-...")
    if (trimmed.startsWith('config key ')) {
        const key = trimmed.replace('config key ', '').trim();
        return {
            type: COMMAND_Types.CONFIG,
            key: key,
            query: trimmed
        };
    }

    // 6. Fallback: Default Search Engine
    const defaultEngine = ENGINES.google;
    return {
        type: COMMAND_Types.SEARCH,
        url: defaultEngine.types.query.template.replace('{$}', encodeURIComponent(trimmed)),
        query: trimmed
    };
}
