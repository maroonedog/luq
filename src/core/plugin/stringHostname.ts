/**
 * @luq-plugin
 * @name stringHostname
 * @category string
 * @description Validates hostname format (RFC 1123)
 * @allowedTypes ["string"]
 * @see https://tools.ietf.org/html/rfc1123 - RFC 1123: Requirements for Internet Hosts - Application and Support
 * @see https://tools.ietf.org/html/rfc952 - RFC 952: DoD Internet Host Table Specification
 * @see https://en.wikipedia.org/wiki/Hostname - Hostname Format Reference
 * @example
 * ```typescript
 * // Basic usage - validates hostname format (RFC 1123 compliant)
 * const validator = Builder()
 *   .use(stringHostnamePlugin)
 *   .for<{ hostname: string }>()
 *   .v("hostname", (b) => b.string.hostname())
 *   .build();
 *
 * // ✅ VALID hostnames (RFC 1123)
 * validator.parse({ hostname: "example.com" });                 // Standard domain
 * validator.parse({ hostname: "www.example.com" });             // Subdomain
 * validator.parse({ hostname: "mail-server.company.org" });     // With hyphens
 * validator.parse({ hostname: "a.b.c" });                      // Short labels
 * validator.parse({ hostname: "host123.domain.co.uk" });        // With numbers
 * validator.parse({ hostname: "localhost" });                  // Single label
 * validator.parse({ hostname: "api-v2.service.internal" });     // Multiple hyphens
 * validator.parse({ hostname: "test" });                       // Single word
 * validator.parse({ hostname: "1a.2b.3c" });                   // Starting with numbers
 * validator.parse({ hostname: "x" });                          // Single character
 * validator.parse({ hostname: "sub.domain.example.com" });      // Multiple levels
 * validator.parse({ hostname: "ftp.files.company-name.org" });  // Complex structure
 * validator.parse({ hostname: "db1.cluster.production" });      // Database naming
 * validator.parse({ hostname: "web01.dmz.corp" });             // Network zones
 * validator.parse({ hostname: "backup-server.it.department" }); // Organizational
 * 
 * // Edge cases
 * validator.parse({ hostname: "a".repeat(63) });               // Max label length (63 chars)
 * validator.parse({ hostname: "a".repeat(63) + "." + "b".repeat(63) }); // Multiple max labels
 * validator.parse({ hostname: "0" });                          // Single digit
 * validator.parse({ hostname: "9a" });                         // Number followed by letter
 *
 * // ❌ INVALID hostnames
 * validator.parse({ hostname: "-example.com" });               // Starting with hyphen
 * validator.parse({ hostname: "example-.com" });               // Label ending with hyphen
 * validator.parse({ hostname: "example.com-" });               // Hostname ending with hyphen  
 * validator.parse({ hostname: ".example.com" });               // Starting with dot
 * validator.parse({ hostname: "example..com" });               // Double dot (empty label)
 * validator.parse({ hostname: "example.com." });               // Trailing dot
 * validator.parse({ hostname: "" });                          // Empty string
 * validator.parse({ hostname: "example .com" });               // Space in hostname
 * validator.parse({ hostname: "example_com" });                // Underscore not allowed
 * validator.parse({ hostname: "EXAMPLE.COM" });                // All caps (valid but not recommended)
 * validator.parse({ hostname: "example.com/path" });           // With path
 * validator.parse({ hostname: "example.com:8080" });           // With port
 * validator.parse({ hostname: "user@example.com" });           // With user
 * validator.parse({ hostname: "http://example.com" });         // Full URL
 * validator.parse({ hostname: "192.168.1.1" });               // IP address (not hostname)
 * validator.parse({ hostname: "[::1]" });                     // IPv6 address
 * 
 * // Label too long (> 63 characters)
 * validator.parse({ hostname: "a".repeat(64) + ".com" });      // Single label > 63 chars
 * 
 * // Hostname too long (> 253 characters total)
 * const longLabel = "a".repeat(50);
 * const longHostname = Array(10).fill(longLabel).join(".") + ".com"; // > 253 chars total
 * validator.parse({ hostname: longHostname });
 * 
 * // Special characters not allowed
 * validator.parse({ hostname: "exam@ple.com" });               // @ symbol
 * validator.parse({ hostname: "exam#ple.com" });               // # symbol
 * validator.parse({ hostname: "exam$ple.com" });               // $ symbol
 * validator.parse({ hostname: "exam%ple.com" });               // % symbol
 * validator.parse({ hostname: "exam&ple.com" });               // & symbol
 * validator.parse({ hostname: "example.com!" });               // Exclamation mark
 * validator.parse({ hostname: "example.com?" });               // Question mark
 * 
 * // Unicode/international domain names (IDN not supported in basic hostname)
 * validator.parse({ hostname: "ドメイン.com" });                // Japanese characters
 * validator.parse({ hostname: "münchen.de" });                // German umlaut
 * validator.parse({ hostname: "café.fr" });                   // French accent
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional custom error message factory
 * @returns Validation function that checks hostname format
 * @customError
 * ```typescript
 * .hostname({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be valid hostname format, received: ${value}`
 * })
 * ```
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";
import type { MessageContext } from "./types";

// RFC 1123 compliant hostname regex
const HOSTNAME_REGEX = /^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])(\.([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9]))*$/;

export const stringHostnamePlugin = plugin({
  name: "stringHostname",
  methodName: "hostname",
  allowedTypes: ["string"] as const,
  category: "standard" as const,
  impl: (options?: { messageFactory?: (context: MessageContext) => string }) => {
    const getErrorMessage = () => `must be a valid hostname`;
    const messageFactory = options?.messageFactory || ((ctx: MessageContext) => 
      `${ctx.path} ${getErrorMessage()}`
    );

    return {
      check: (value: string) => {
        if (typeof value !== "string") return false;
        // Length check (max 253 characters for hostname)
        if (value.length > 253) return false;
        return HOSTNAME_REGEX.test(value);
      },
      code: "FORMAT_HOSTNAME",
      getErrorMessage: (value: string, path: string) => {
        return messageFactory({ path, value, code: "FORMAT_HOSTNAME" });
      },
      params: [options],
    };
  },
});