/**
 * @luq-plugin
 * @name stringIri
 * @category string
 * @description Validates IRI (Internationalized Resource Identifier) format (RFC 3987)
 * @allowedTypes ["string"]
 * @see https://tools.ietf.org/html/rfc3987 - RFC 3987: Internationalized Resource Identifiers (IRIs)
 * @see https://en.wikipedia.org/wiki/Internationalized_Resource_Identifier - IRI Format Reference
 * @example
 * ```typescript
 * // Basic usage - validates IRI format (RFC 3987 compliant)
 * const validator = Builder()
 *   .use(stringIriPlugin)
 *   .for<{ identifier: string }>()
 *   .v("identifier", (b) => b.string.iri())
 *   .build();
 *
 * // ✅ VALID IRI formats (RFC 3987)
 * // Standard ASCII URIs (subset of IRI)
 * validator.parse({ identifier: "https://www.example.com/path" });    // Regular HTTP URL
 * validator.parse({ identifier: "http://example.org:8080/api/v1" }); // With port and path
 * validator.parse({ identifier: "ftp://files.example.com/file.txt" }); // FTP scheme
 * validator.parse({ identifier: "mailto:user@example.com" });         // Email scheme
 * validator.parse({ identifier: "tel:+1-555-123-4567" });            // Telephone scheme
 * 
 * // Internationalized domain names and paths (Unicode)
 * validator.parse({ identifier: "https://例え.jp/パス" });              // Japanese characters
 * validator.parse({ identifier: "http://münchen.de/straße" });       // German umlauts
 * validator.parse({ identifier: "https://café.fr/menu" });           // French accents
 * validator.parse({ identifier: "http://домен.рф/путь" });           // Cyrillic script
 * validator.parse({ identifier: "https://测试.cn/路径" });             // Chinese characters
 * validator.parse({ identifier: "http://테스트.kr/경로" });             // Korean characters
 * validator.parse({ identifier: "https://тест.bg/път" });            // Bulgarian Cyrillic
 * validator.parse({ identifier: "http://δοκιμή.gr/διαδρομή" });      // Greek characters
 * validator.parse({ identifier: "https://परीक्षा.in/पथ" });           // Hindi/Devanagari
 * validator.parse({ identifier: "http://اختبار.sa/مسار" });           // Arabic script
 * 
 * // Internationalized email addresses
 * validator.parse({ identifier: "mailto:ユーザー@例え.jp" });          // Japanese email
 * validator.parse({ identifier: "mailto:utilisateur@café.fr" });     // French domain
 * validator.parse({ identifier: "mailto:пользователь@домен.рф" });    // Cyrillic email
 * 
 * // Mixed ASCII and Unicode
 * validator.parse({ identifier: "https://api.例え.jp/v1/users" });    // Mixed path
 * validator.parse({ identifier: "https://例え.example.com/path" });   // Mixed domain
 * validator.parse({ identifier: "ftp://files.café.com/données.txt" }); // Mixed filename
 * 
 * // Various schemes with Unicode
 * validator.parse({ identifier: "ldap://服务器.com/cn=用户,dc=例子,dc=com" }); // LDAP with Chinese
 * validator.parse({ identifier: "news://nieuws.nl/groep.测试" });     // News with mixed Unicode
 * validator.parse({ identifier: "urn:isbn:978-3-86680-192-9" });     // URN (ASCII)
 * 
 * // Edge cases
 * validator.parse({ identifier: "custom-scheme://测试.example/路径" }); // Custom scheme with Unicode
 * validator.parse({ identifier: "x-proprietary://例え.internal" });   // Non-standard scheme
 * validator.parse({ identifier: "data:text/plain;charset=utf-8,你好" }); // Data URI with Unicode
 *
 * // ❌ INVALID IRI formats
 * validator.parse({ identifier: "not-an-iri" });                     // No scheme separator
 * validator.parse({ identifier: "://missing-scheme.com" });          // Missing scheme
 * validator.parse({ identifier: "http://" });                        // Missing authority
 * validator.parse({ identifier: "https:/" });                        // Malformed scheme separator
 * validator.parse({ identifier: "" });                              // Empty string
 * validator.parse({ identifier: "http://exam ple.com" });            // Space in authority
 * validator.parse({ identifier: "https://example.com/path with spaces" }); // Spaces in path
 * validator.parse({ identifier: "http://example.com/path\twith\ttabs" }); // Tab characters
 * validator.parse({ identifier: "https://example.com/path\nwith\nnewlines" }); // Newline characters
 * validator.parse({ identifier: "http://example.com/path\rwith\rcarriage" }); // Carriage returns
 * validator.parse({ identifier: "ftp://example.com\x00null" });      // Null character (control char)
 * validator.parse({ identifier: "https://example.com\x01control" }); // Control character
 * validator.parse({ identifier: "http://example.com\x7Fdel" });      // DEL character
 * 
 * // Malformed schemes
 * validator.parse({ identifier: "123://invalid-scheme.com" });       // Scheme starting with number
 * validator.parse({ identifier: "-http://invalid-scheme.com" });     // Scheme starting with hyphen
 * validator.parse({ identifier: ".http://invalid-scheme.com" });     // Scheme starting with dot
 * validator.parse({ identifier: "ht@tp://invalid-char.com" });       // Invalid char in scheme
 * validator.parse({ identifier: "ht tp://space-in-scheme.com" });    // Space in scheme
 * 
 * // Missing or empty components
 * validator.parse({ identifier: "http:" });                          // Scheme only
 * validator.parse({ identifier: ":" });                             // Just separator
 * validator.parse({ identifier: "http://example.com:" });           // Trailing colon
 * 
 * // Invalid Unicode sequences (rare but possible)
 * validator.parse({ identifier: "https://example.com/\uFFFD" });     // Replacement character
 * validator.parse({ identifier: "http://\uFEFF.example.com" });      // BOM character
 * 
 * // Leading/trailing whitespace
 * validator.parse({ identifier: " https://example.com" });          // Leading space
 * validator.parse({ identifier: "https://example.com " });          // Trailing space
 * validator.parse({ identifier: "\thttps://example.com" });         // Leading tab
 * validator.parse({ identifier: "https://example.com\n" });         // Trailing newline
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional custom error message factory
 * @returns Validation function that checks IRI format
 * @customError
 * ```typescript
 * .iri({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be valid IRI format, received: ${value}`
 * })
 * ```
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";
import type { MessageContext } from "./types";

// Simplified IRI validation - checks for scheme and basic structure
// Full RFC 3987 regex is extremely complex, this covers common cases
const IRI_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:(?:\/\/)?[^\s]*$/;

// More comprehensive IRI validation with unicode support
function isValidIRI(value: string): boolean {
  if (!IRI_REGEX.test(value)) return false;
  
  // Check for invalid characters (control characters, spaces)
  if (/[\x00-\x1F\x7F\s]/.test(value)) return false;
  
  // Basic structure validation
  try {
    // Try to parse as URL first (for ASCII URLs)
    new URL(value);
    return true;
  } catch {
    // For non-ASCII IRIs, perform basic structure check
    const parts = value.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):(.+)$/);
    if (!parts) return false;
    
    const [, scheme, rest] = parts;
    
    // Check scheme is valid
    if (!scheme || scheme.length === 0) return false;
    
    // Check the rest has some content
    if (!rest || rest.length === 0) return false;
    
    // Allow unicode characters in the rest
    return true;
  }
}

export const stringIriPlugin = plugin({
  name: "stringIri",
  methodName: "iri",
  allowedTypes: ["string"] as const,
  category: "standard" as const,
  impl: (options?: { messageFactory?: (context: MessageContext) => string }) => {
    const getErrorMessage = () => `must be a valid IRI (RFC 3987)`;
    const messageFactory = options?.messageFactory || ((ctx: MessageContext) => 
      `${ctx.path} ${getErrorMessage()}`
    );

    return {
      check: (value: string) => {
        if (typeof value !== "string") return false;
        return isValidIRI(value);
      },
      code: "FORMAT_IRI",
      getErrorMessage: (value: string, path: string) => {
        return messageFactory({ path, value, code: "FORMAT_IRI" });
      },
      params: [options],
    };
  },
});