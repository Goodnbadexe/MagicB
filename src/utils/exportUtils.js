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
    } catch (err) {
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
        } catch (e) {
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
 * Open HTML in new window
 * @param {string} html - HTML content
 */
export function openInNewWindow(html) {
    const newWindow = window.open();
    if (newWindow) {
        newWindow.document.write(html);
        newWindow.document.close();
    }
}
