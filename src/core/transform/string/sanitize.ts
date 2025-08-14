/**
 * Sanitizes a string by removing potentially dangerous HTML characters
 * @param value - The string value to sanitize
 * @returns The sanitized string
 */
export function sanitize(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}
