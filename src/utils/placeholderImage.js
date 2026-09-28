/**
 * Local SVG placeholder images for the instant (parametric) template.
 *
 * The template used to hotlink source.unsplash.com, which Unsplash has shut
 * down, so every image rendered broken. These placeholders are built in the
 * browser from the section title and theme colours and returned as data:
 * URIs: no third-party image service, no network request, nothing to break.
 */

const DEFAULT_PRIMARY = '#2563eb';

function normalizeHex(color) {
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color || '').trim());
    if (!match) return DEFAULT_PRIMARY;
    const hex = match[1].length === 3
        ? match[1].split('').map(c => c + c).join('')
        : match[1];
    return `#${hex.toLowerCase()}`;
}

/** Blend `hex` toward `target` by `amount` (0..1). */
function mix(hex, target, amount) {
    const a = parseInt(hex.slice(1), 16);
    const b = parseInt(target.slice(1), 16);
    const channel = shift => {
        const from = (a >> shift) & 0xff;
        const to = (b >> shift) & 0xff;
        return Math.round(from + (to - from) * amount);
    };
    const value = (channel(16) << 16) | (channel(8) << 8) | channel(0);
    return `#${value.toString(16).padStart(6, '0')}`;
}

function escapeXml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/** Small deterministic hash so each label gets its own composition. */
function hashString(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function shorten(text, max) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Build a themed placeholder image.
 * @param {Object} options
 * @param {string} [options.label]   - Section title rendered on the image
 * @param {string} [options.primary] - Theme primary colour (hex)
 * @param {boolean} [options.dark]   - Dark theme variant
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @returns {string} data:image/svg+xml URI, safe to drop into an src="" attribute
 */
export function placeholderImage({ label = '', primary = DEFAULT_PRIMARY, dark = false, width = 800, height = 600 } = {}) {
    const base = normalizeHex(primary);
    const text = shorten(label, 32);
    const seed = hashString(`${text}|${base}`);
    const pick = (shift, min, range) => Math.round(min + ((seed >>> shift) % Math.max(1, Math.round(range))));

    const bgFrom = dark ? mix(base, '#000000', 0.55) : mix(base, '#ffffff', 0.82);
    const bgTo = dark ? mix(base, '#000000', 0.82) : mix(base, '#ffffff', 0.55);
    const ink = dark ? mix(base, '#ffffff', 0.85) : mix(base, '#000000', 0.55);

    // Fit the label inside the central square so object-cover crops never cut it.
    const fontSize = Math.max(20, Math.min(56, Math.floor((Math.min(width, height) * 0.85) / (Math.max(text.length, 1) * 0.6))));
    const circleA = { cx: pick(0, width * 0.55, width * 0.4), cy: pick(4, 0, height * 0.45), r: pick(8, height * 0.25, height * 0.25) };
    const circleB = { cx: pick(12, 0, width * 0.35), cy: pick(16, height * 0.6, height * 0.35), r: pick(20, height * 0.15, height * 0.2) };
    const tilt = pick(24, -18, 36);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
        `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${bgFrom}"/><stop offset="1" stop-color="${bgTo}"/>` +
        `</linearGradient></defs>` +
        `<rect width="${width}" height="${height}" fill="url(#bg)"/>` +
        `<circle cx="${circleA.cx}" cy="${circleA.cy}" r="${circleA.r}" fill="${base}" fill-opacity="0.28"/>` +
        `<circle cx="${circleB.cx}" cy="${circleB.cy}" r="${circleB.r}" fill="${base}" fill-opacity="0.18"/>` +
        `<rect x="${width * 0.3}" y="${height * 0.3}" width="${width * 0.4}" height="${height * 0.4}" rx="${Math.round(height * 0.05)}" ` +
        `fill="${base}" fill-opacity="0.12" transform="rotate(${tilt} ${width / 2} ${height / 2})"/>` +
        (text
            ? `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" ` +
              `font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="${fontSize}" font-weight="700" ` +
              `fill="${ink}">${escapeXml(text)}</text>`
            : '') +
        `</svg>`;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
