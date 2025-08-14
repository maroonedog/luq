import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";

const DEFAULT_CODE = "stringUrl";

// URL validation using native URL constructor for accurate parsing

const supportedTypes = ["string"] as const;

/**
 * @luq-plugin
 * @name stringUrl
 * @category standard
 * @description Validates that a string is a valid URL format
 * @allowedTypes ["string"]
 * @see https://developer.mozilla.org/en-US/docs/Web/API/URL - MDN URL API Reference
 * @see https://tools.ietf.org/html/rfc3986 - RFC 3986: Uniform Resource Identifier (URI) Generic Syntax
 * @example
 * ```typescript
 * // Basic usage - validates all URL formats (RFC 3986 compliant)
 * const validator = Builder()
 *   .use(stringUrlPlugin)
 *   .for<UserProfile>()
 *   .v("website", (b) => b.string.url())
 *   .v("profileUrl", (b) => b.string.required().url())
 *   .build();
 *
 * // Custom protocols (e.g., allow ftp://)
 * builder.v("ftpServer", b => b.string.url({
 *   protocols: ['ftp:', 'ftps:']
 * }))
 *
 * // Allow URLs without protocol (assumes https://)
 * builder.v("domain", b => b.string.url({
 *   allowWithoutProtocol: true
 * }))
 *
 * // ✅ VALID URL formats (RFC 3986)
 * validator.parse({ website: "https://example.com" });                    // Standard HTTPS
 * validator.parse({ website: "http://www.test.co.uk/path?q=value#frag" }); // Full URL with query and fragment
 * validator.parse({ website: "ftp://files.domain.com/file.txt" });        // FTP protocol
 * validator.parse({ website: "ws://localhost:3000" });                    // WebSocket protocol
 * validator.parse({ website: "https://subdomain.example.com:8080/api" }); // With port and path
 * validator.parse({ website: "https://127.0.0.1:3000" });                // IP address
 * validator.parse({ website: "https://[::1]:8080" });                    // IPv6 address
 * validator.parse({ website: "mailto:user@example.com" });                // mailto protocol
 * validator.parse({ website: "tel:+1-555-123-4567" });                   // tel protocol
 * validator.parse({ website: "https://user:pass@example.com" });          // With credentials
 *
 * // With allowWithoutProtocol: true
 * const flexValidator = builder.v("site", b => b.string.url({ allowWithoutProtocol: true }));
 * flexValidator.parse({ site: "example.com" });                          // Assumes https://
 * flexValidator.parse({ site: "www.domain.co.uk/path" });                // Assumes https://
 *
 * // ❌ INVALID URL formats
 * validator.parse({ website: "not-a-url" });              // Plain text
 * validator.parse({ website: "http://" });                // Missing host
 * validator.parse({ website: "://missing-protocol" });    // Missing protocol
 * validator.parse({ website: "https://" });               // Missing host after protocol
 * validator.parse({ website: "http://.com" });            // Invalid host
 * validator.parse({ website: "https://example." });       // Incomplete domain
 * validator.parse({ website: "just text with spaces" });  // Contains spaces
 * validator.parse({ website: "ftp://[invalid-ipv6]" });   // Invalid IPv6
 * validator.parse({ website: "https://exam ple.com" });   // Space in domain
 * validator.parse({ website: "" });                       // Empty string
 * ```
 * @params
 * - options?: StringUrlOptions - URL validation configuration
 *   - protocols?: string[] - Allowed protocols (default: all protocols allowed)
 *   - allowWithoutProtocol?: boolean - Allow URLs without protocol (default: false)
 *   - messageFactory?: (context: MessageContext) => string - Custom error message factory
 * @returns Validation function that returns true if string is a valid URL
 * @customError
 * ```typescript
 * .url({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be a valid URL (received: ${value})`
 * })
 *
 * // Restrict to specific protocols
 * .url({
 *   protocols: ['https:'],
 *   messageFactory: ({ path }) => `${path} must be a secure HTTPS URL`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export interface StringUrlOptions extends ValidationOptions {
  /**
   * Array of allowed protocols. Default: null (allow all protocols)
   * @example ['http:', 'https:', 'ftp:', 'ws:', 'wss:']
   */
  protocols?: string[];

  /**
   * Whether to allow URLs without protocol (will default to https://)
   * @default false
   */
  allowWithoutProtocol?: boolean;
}

export const stringUrlPlugin = plugin({
  name: "stringUrl",
  methodName: "url",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (options?: StringUrlOptions) => {
    const code = options?.code || DEFAULT_CODE;
    // By default, allow common web protocols, but can be customized
    const allowedProtocols = options?.protocols || null; // null = allow all protocols
    const allowWithoutProtocol = options?.allowWithoutProtocol || false;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: MessageContext) => "Invalid URL format");

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        // Only validate strings
        if (typeof value !== "string") return true;

        try {
          let urlToValidate = value;

          // Handle URLs without protocol
          if (allowWithoutProtocol && !value.includes("://")) {
            urlToValidate = `https://${value}`;
          }

          // Use URL constructor for accurate validation
          const url = new URL(urlToValidate);

          // Check if protocol is allowed (only if protocols are specified)
          if (allowedProtocols && !allowedProtocols.includes(url.protocol)) {
            return false;
          }

          return true;
        } catch {
          // Invalid URL format
          return false;
        }
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const ctx = { path, value, code };
        return messageFactory(ctx);
      },
      params: options ? [options] : [],
    };
  },
  // Metadata for optimized error handling
});
