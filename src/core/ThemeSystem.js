/**
 * Theme System
 * Manages theme, color, and styling configurations
 */

/**
 * Get theme classes based on theme preferences
 * @param {Object} theme - Theme object from prompt analysis
 * @param {Object} colors - Colors object from prompt analysis
 * @returns {Object}
 */
export function getThemeClasses(theme, colors) {
    const isDark = theme.all.includes('dark');
    const isMinimal = theme.all.includes('minimal');
    const isColorful = theme.all.includes('colorful');

    return {
        bg: isDark ? 'bg-neutral-900' : 'bg-white',
        text: isDark ? 'text-white' : 'text-gray-900',
        cardBg: isDark ? 'bg-neutral-800' : 'bg-white',
        border: isDark ? 'border-neutral-700' : 'border-gray-100',
        pattern: isMinimal ? '' : 'pattern',
        primaryColor: colors.primary
    };
}

/**
 * Generate CSS styles for theme
 * @param {Object} colors - Colors object
 * @param {Object} theme - Theme object
 * @returns {string}
 */
/**
 * Adjust brightness of a color
 * @param {string} hex - Hex color code
 * @param {number} percent - Percentage to adjust (-100 to 100)
 * @returns {string}
 */
export function adjustBrightness(hex, percent) {
    let c = hex.replace('#', '');
    if (c.length === 3) {
        c = c.split('').map(char => char + char).join('');
    }
    const num = parseInt(c, 16);
    if (isNaN(num)) return hex; // Fallback

    const r = Math.min(255, Math.max(0, (num >> 16) + percent));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Generate CSS variables for the theme
 */
export function generateThemeStyles(colors, theme) {
    const primaryColor = colors.primary;
    const isDark = theme.all.includes('dark');
    const rgb = hexToRgb(primaryColor);

    return `
        :root {
            --primary-color: ${primaryColor};
            --primary-rgb: ${rgb};
            --bg-opacity: ${isDark ? '0.05' : '0.1'};
        }
        .glass {
            background: rgba(255, 255, 255, var(--bg-opacity));
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }
        .pattern {
            background-image: radial-gradient(rgba(var(--primary-rgb), 0.15) 1px, transparent 1px);
            background-size: 24px 24px;
        }
        .gradient-primary {
            background: linear-gradient(135deg, ${primaryColor}, ${adjustBrightness(primaryColor, -20)});
        }
        .text-gradient {
            background: linear-gradient(135deg, ${primaryColor}, ${adjustBrightness(primaryColor, 30)});
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
    `;
}

/**
 * Convert hex color to RGB
 * Handles #abc, #aabbcc, and missing hash
 */
export function hexToRgb(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) {
        c = c.split('').map(char => char + char).join('');
    }
    const num = parseInt(c, 16);
    if (isNaN(num)) return '59, 130, 246'; // Default blue
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `${r}, ${g}, ${b}`;
}

/**
 * Get font family based on language
 * @param {Object} language - Language object from detection
 * @returns {string}
 */
export function getFontFamily(language) {
    return language.font || 'Inter, Outfit, Arial';
}

/**
 * Get macro style (legacy support)
 * @param {Object} macro - Macro object
 * @returns {Object}
 */
export function getMacroStyle(macro) {
    if (!macro) return {};

    const bgColor = macro.bgColor;
    const textColor = macro.textColor || '#ffffff';

    if (!bgColor) {
        return { color: textColor };
    }

    if (bgColor.type === 'gradient') {
        const colors = bgColor.colors || [];
        const stops = bgColor.stops || [];

        if (bgColor.gradientType === 'radial') {
            return {
                background: `radial-gradient(circle at ${bgColor.stops?.[0] || 60}%, ${colors.join(', ')})`,
                color: textColor
            };
        } else {
            const angle = bgColor.angle || 45;
            return {
                background: `linear-gradient(${angle}deg, ${colors.join(', ')})`,
                color: textColor
            };
        }
    } else {
        return {
            backgroundColor: bgColor.color || '#000000',
            color: textColor
        };
    }
}
