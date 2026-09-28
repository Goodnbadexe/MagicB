/**
 * Export Utilities
 * Functions to export/download generated websites
 */

/**
 * Download HTML file
 * @param {string} html - HTML content
 * @param {string} filename - Filename (without extension)
 */
export function downloadHTML(html, filename = 'website') {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Copy HTML to clipboard
 * @param {string} html - HTML content
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(html) {
    try {
        await navigator.clipboard.writeText(html);
        return true;
    } catch {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = html;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Generate a shareable link (base64 encoded)
 * @param {string} html - HTML content
 * @returns {string} Shareable data URL
 */
export function generateShareableLink(html) {
    const compressed = btoa(unescape(encodeURIComponent(html)));
    return `data:text/html;base64,${compressed}`;
}

/**
 * Sandbox tokens for any frame that renders AI-generated / untrusted HTML.
 *
 * `allow-same-origin` is deliberately absent: without it the frame gets an
 * opaque origin, so generated scripts cannot read this app's localStorage
 * (where the Gemini API key lives), cookies, or DOM. Never add
 * `allow-same-origin` alongside `allow-scripts` — together they let the frame
 * remove its own sandbox.
 *   - allow-scripts: Tailwind CDN + any interactivity in the generated page
 *   - allow-forms:   generated contact forms can be submitted in the preview
 *   - allow-popups:  target="_blank" links work (popups inherit the sandbox)
 *
 * CSP note: a srcdoc frame (and the about:blank window used by
 * openInNewWindow) inherits this app's Content-Security-Policy even though
 * its origin is opaque. The policy in vercel.json therefore still allows
 * what generated pages need (Tailwind CDN, inline scripts/styles, https
 * styles/fonts/images). Tighten it only together with moving previews to a
 * separately served document.
 */
export const PREVIEW_SANDBOX = 'allow-scripts allow-forms allow-popups';

/**
 * Open HTML in new window
 *
 * The untrusted HTML is never written into the new window's document (an
 * about:blank window shares this app's origin). Instead the new window hosts
 * only a sandboxed iframe that renders the HTML via srcdoc.
 * @param {string} html - HTML content
 */
export function openInNewWindow(html) {
    const newWindow = window.open('', '_blank');
    if (!newWindow) return;

    // Sever the back-reference so the preview cannot navigate or script this tab.
    newWindow.opener = null;

    const doc = newWindow.document;
    doc.title = 'Preview';
    doc.documentElement.style.height = '100%';
    doc.body.style.cssText = 'margin:0;height:100%;';

    const frame = doc.createElement('iframe');
    frame.setAttribute('sandbox', PREVIEW_SANDBOX);
    frame.setAttribute('title', 'Generated Website');
    frame.style.cssText = 'border:0;width:100%;height:100%;display:block;';
    frame.srcdoc = html;
    doc.body.appendChild(frame);
}
