/**
 * @luq-plugin
 * @name stringBase64
 * @category string
 * @description Validates base64 encoded string
 * @allowedTypes ["string"]
 * @see https://tools.ietf.org/html/rfc4648 - RFC 4648: The Base16, Base32, and Base64 Data Encodings
 * @see https://developer.mozilla.org/en-US/docs/Glossary/Base64 - MDN Base64 Encoding Reference
 * @see https://developer.mozilla.org/en-US/docs/Web/API/btoa - MDN btoa() Function
 * @example
 * ```typescript
 * // Basic usage - validates base64 encoded string (RFC 4648 compliant)
 * const validator = Builder()
 *   .use(stringBase64Plugin)
 *   .for<{ encodedData: string }>()
 *   .v("encodedData", (b) => b.string.base64())
 *   .build();
 *
 * // URL-safe base64 validation
 * const urlSafeValidator = Builder()
 *   .use(stringBase64Plugin)
 *   .for<{ token: string }>()
 *   .v("token", (b) => b.string.base64({ urlSafe: true }))
 *   .build();
 *
 * // ✅ VALID base64 strings (RFC 4648)
 * // Standard base64 encoding
 * validator.parse({ encodedData: "SGVsbG8gV29ybGQ=" });           // "Hello World"
 * validator.parse({ encodedData: "YW55IGNhcm5hbCBwbGVhc3VyZS4=" }); // "any carnal pleasure."
 * validator.parse({ encodedData: "" });                          // Empty string
 * validator.parse({ encodedData: "YQ==" });                      // Single char "a"
 * validator.parse({ encodedData: "YWI=" });                      // Two chars "ab"
 * validator.parse({ encodedData: "YWJj" });                      // Three chars "abc"
 * validator.parse({ encodedData: "YWJjZA==" });                  // Four chars "abcd"
 * validator.parse({ encodedData: "VGhpcyBpcyBhIHRlc3Q=" });       // "This is a test"
 * 
 * // With numbers and special base64 characters
 * validator.parse({ encodedData: "MTIzNDU2Nzg5MA==" });          // "1234567890"
 * validator.parse({ encodedData: "QUJDREVGRw==" });              // "ABCDEFG"
 * validator.parse({ encodedData: "YWJjZGVmZ2hpams=" });           // "abcdefghijk"
 * validator.parse({ encodedData: "Pz8/Pz8/Pz8=" });              // Contains + and / chars
 * validator.parse({ encodedData: "+/+/+/+/+/+=" });              // All special chars
 * 
 * // Different padding scenarios
 * validator.parse({ encodedData: "YWI=" });                      // One padding char
 * validator.parse({ encodedData: "YQ==" });                      // Two padding chars
 * validator.parse({ encodedData: "YWJj" });                      // No padding needed
 * validator.parse({ encodedData: "YWJjZA==" });                  // Two padding chars
 * 
 * // URL-safe base64 (RFC 4648 Section 5)
 * urlSafeValidator.parse({ token: "SGVsbG8gV29ybGQ" });          // URL-safe without padding
 * urlSafeValidator.parse({ token: "SGVsbG8gV29ybGQ=" });         // URL-safe with padding
 * urlSafeValidator.parse({ token: "YW55IGNhcm5hbC1wbGVhc3VyZS4" }); // Uses - instead of /
 * urlSafeValidator.parse({ token: "YWJjZGVmZ2hpams_" });         // Uses _ instead of +
 * urlSafeValidator.parse({ token: "-_-_-_-_-_-_" });            // All URL-safe special chars
 * 
 * // Real-world examples
 * validator.parse({ encodedData: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9" }); // JWT header
 * validator.parse({ encodedData: "VG8gYmUgb3Igbm90IHRvIGJlLCB0aGF0IGlzIHRoZSBxdWVzdGlvbg==" }); // Long text
 * validator.parse({ encodedData: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" }); // Base64 image
 *
 * // ❌ INVALID base64 strings
 * validator.parse({ encodedData: "SGVsbG8gV29ybGQ" });          // Wrong length (not multiple of 4)
 * validator.parse({ encodedData: "SGVsbG8gV29ybGQ===" });       // Too many padding chars (3)
 * validator.parse({ encodedData: "SGVsbG8gV29ybGQ====" });      // Too many padding chars (4)
 * validator.parse({ encodedData: "SGV@bG8gV29ybGQ=" });         // Invalid character (@)
 * validator.parse({ encodedData: "SGV sbG8gV29ybGQ=" });        // Space not allowed
 * validator.parse({ encodedData: "SGV\tbG8gV29ybGQ=" });        // Tab not allowed
 * validator.parse({ encodedData: "SGV\nbG8gV29ybGQ=" });        // Newline not allowed
 * validator.parse({ encodedData: "SGVsbG8\rgV29ybGQ=" });       // Carriage return not allowed
 * validator.parse({ encodedData: "SGVsbG8gV29ybGQ=" });         // Non-standard characters
 * validator.parse({ encodedData: "SGVsbG8gV29ybGQ!=" });        // Exclamation mark not allowed
 * validator.parse({ encodedData: "SGVsbG8gV29ybGQ?=" });        // Question mark not allowed
 * validator.parse({ encodedData: "SGVsbG8gV29ybGQ&=" });        // Ampersand not allowed
 * validator.parse({ encodedData: "SGVsbG8gV29ybGQ*=" });        // Asterisk not allowed
 * 
 * // Padding in wrong position
 * validator.parse({ encodedData: "SGVsbG=gV29ybGQ=" });         // Padding in middle
 * validator.parse({ encodedData: "=GVsbG8gV29ybGQ=" });         // Padding at start
 * validator.parse({ encodedData: "SGVsbG8=V29ybGQ=" });         // Padding before end
 * 
 * // URL-safe base64 invalid examples
 * urlSafeValidator.parse({ token: "SGVsbG8gV29ybGQ+" });        // + not allowed in URL-safe
 * urlSafeValidator.parse({ token: "SGVsbG8gV29ybGQ/" });        // / not allowed in URL-safe
 * validator.parse({ encodedData: "SGVsbG8gV29ybGQ-" });         // - not allowed in standard
 * validator.parse({ encodedData: "SGVsbG8gV29ybGQ_" });         // _ not allowed in standard
 * 
 * // Edge cases
 * validator.parse({ encodedData: " SGVsbG8gV29ybGQ=" });        // Leading space
 * validator.parse({ encodedData: "SGVsbG8gV29ybGQ= " });        // Trailing space
 * validator.parse({ encodedData: "SGVsbG8gV29ybGQ=\n" });       // Trailing newline
 * validator.parse({ encodedData: "SGVsbG8gV29ybGQ=\r\n" });     // CRLF at end
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string; urlSafe?: boolean } - Optional configuration
 * @returns Validation function that checks base64 encoding
 * @customError
 * ```typescript
 * .base64({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be valid base64 encoded string (received: ${value.substring(0, 20)}...)`
 * })
 * ```
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";
import type { MessageContext } from "./types";

// Standard base64 regex
const BASE64_REGEX = /^[A-Za-z0-9+/]*={0,2}$/;
// URL-safe base64 regex (uses - and _ instead of + and /)
const BASE64_URL_REGEX = /^[A-Za-z0-9\-_]*={0,2}$/;

export const stringBase64Plugin = plugin({
  name: "stringBase64",
  methodName: "base64",
  allowedTypes: ["string"] as const,
  category: "standard" as const,
  impl: (options?: { messageFactory?: (context: MessageContext) => string; urlSafe?: boolean }) => {
    const getErrorMessage = (value: string, path: string) => {
      const context: MessageContext = { path, value, code: "FORMAT_BASE64" };
      return options?.messageFactory?.(context) || `${path} must be a valid base64 encoded string`;
    };

    const messageFactory = (context: MessageContext) => {
      return options?.messageFactory?.(context) || `${context.path} must be a valid base64 encoded string`;
    };

    return {
      check: (value: string) => {
        if (typeof value !== "string") return false;
        if (value === "") return true; // Empty string is valid base64
        
        // Check if length is multiple of 4
        if (value.length % 4 !== 0) return false;
        
        const regex = options?.urlSafe ? BASE64_URL_REGEX : BASE64_REGEX;
        return regex.test(value);
      },
      code: "FORMAT_BASE64",
      getErrorMessage,
      messageFactory,
      params: [options],
    };
  },
});