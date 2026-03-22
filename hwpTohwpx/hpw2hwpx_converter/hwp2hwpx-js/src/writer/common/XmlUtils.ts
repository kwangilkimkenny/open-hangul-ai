/**
 * XML Utilities
 */

/**
 * Escapes special characters for XML safely.
 * @param text The string to escape
 * @returns Escaped XML string
 */
export function escapeXml(text: string): string {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Helper to build attribute string
 */
export function attr(name: string, value: string | number | undefined): string {
    if (value === undefined || value === null) return '';
    return ` ${name}="${escapeXml(String(value))}"`;
}
