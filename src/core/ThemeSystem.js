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
export function generateThemeStyles(colors, theme) {
    const primaryColor = colors.primary;
    const isDark = theme.all.includes('dark');
    
    return `
        :root {
            --primary-color: ${primaryColor};
            --primary-rgb: ${hexToRgb(primaryColor)};
        }
        .glass {
            background: rgba(255, 255, 255, ${isDark ? '0.05' : '0.1'});
            backdrop-filter: blur(10px);
        }
        .pattern {
            background-image: radial-gradient(${primaryColor}22 1px, transparent 1px);
            background-size: 20px 20px;
        }
        .gradient-primary {
            background: linear-gradient(135deg, ${primaryColor}, ${adjustBrightness(primaryColor, -20)});
        }
    `;
}

/**
 * Convert hex color to RGB
 * @param {string} hex - Hex color code
 * @returns {string}
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : '37, 99, 235';
}

/**
 * Adjust brightness of a color
 * @param {string} hex - Hex color code
 * @param {number} percent - Percentage to adjust (-100 to 100)
 * @returns {string}
 */
function adjustBrightness(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + percent));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
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
