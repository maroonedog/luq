import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";

const supportedTypes = ["string"] as const;

import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

// V8 Optimization: Module-level constants
const DEFAULT_EMAIL_REGEX =
  /^[a-zA-Z0-9]([a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
const DEFAULT_CODE = "stringEmail";

// Simplified email validation options - allowedDomains and customRegex
interface EmailValidationOptions extends ValidationOptions {
  allowedDomains?: string[]; // List of allowed domains (practical: corporate email restrictions)
  customRegex?: RegExp; // Custom regex (when you want to change the basic format)
}

/**
 * @luq-plugin
 * @name stringEmail
 * @category standard
 * @description Simple and fast email validation with domain restriction and custom regex support (RFC 5322 compliant)
 * @allowedTypes ["string"]
 * @see https://tools.ietf.org/html/rfc5322 - RFC 5322: Internet Message Format
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/email - MDN Email Input Validation
 * @example
 * ```typescript
 * // Basic usage - validates email format (RFC 5322 compliant)
 * const validator = Builder()
 *   .use(stringEmailPlugin)
 *   .for<UserProfile>()
 *   .v("email", (b) => b.string.email())
 *   .v("contactEmail", (b) => b.string.required().email())
 *   .build();
 *
 * // Domain restriction (practical: corporate email only)
 * builder.v("workEmail", b => b.string.required().email({
 *   allowedDomains: ["company.com", "subsidiary.co.jp"]
 * }))
 *
 * // Custom regex for specific format requirements
 * builder.v("strictEmail", b => b.string.email({
 *   customRegex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
 * }))
 *
 * // For length limits, use existing string plugins:
 * builder.v("email", b => b.string.required().max(100).email())
 *
 * // ✅ VALID email formats (RFC 5322)
 * validator.parse({ email: "user@example.com" });              // Standard format
 * validator.parse({ email: "test.email+tag@domain.co.uk" });   // With plus and dots
 * validator.parse({ email: "user123@test-server.com" });       // Numbers and hyphens
 * validator.parse({ email: "firstname.lastname@example.org" }); // Multiple dots
 * validator.parse({ email: "user+filter@gmail.com" });         // Plus addressing
 * validator.parse({ email: "a@b.co" });                        // Minimal valid
 * validator.parse({ email: "test_email@domain-name.com" });     // Underscores and hyphens
 * 
 * // ❌ INVALID email formats
 * validator.parse({ email: "plainaddress" });          // No @ symbol
 * validator.parse({ email: "@missingdomain.com" });    // Missing local part
 * validator.parse({ email: "missing.domain@" });       // Missing domain
 * validator.parse({ email: "spaces @domain.com" });    // Spaces not allowed
 * validator.parse({ email: "user@.com" });             // Invalid domain start
 * validator.parse({ email: "user@domain" });           // Missing TLD
 * validator.parse({ email: "user@@domain.com" });      // Double @ symbol
 * validator.parse({ email: "user@domain..com" });      // Double dots in domain
 * validator.parse({ email: ".user@domain.com" });      // Leading dot
 * validator.parse({ email: "user.@domain.com" });      // Trailing dot
 * ```
 * @params
 * - options?: EmailValidationOptions - Simple email validation configuration
 *   - allowedDomains?: string[] - Only allow emails from these domains (practical for corporate restrictions)
 *   - customRegex?: RegExp - Custom regex to override basic validation (practical escape hatch)
 *   - messageFactory?: (context: MessageContext) => string - Custom error message factory
 * @returns Validation function optimized for performance - regex validation with optional domain filtering or custom regex
 * @customError
 * ```typescript
 * .email({
 *   allowedDomains: ["company.com"],
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be a company email address (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const stringEmailPlugin = plugin({
  name: "stringEmail",
  methodName: "email",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (options?: EmailValidationOptions) => {
    // V8 Optimization: Pre-compute EVERYTHING in curry phase
    const code = options?.code || DEFAULT_CODE;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: MessageContext & { reason?: string }) =>
        ctx.reason ? `Invalid email: ${ctx.reason}` : "Invalid email address");

    // Pre-process options for performance
    const allowedDomains = options?.allowedDomains
      ? new Set(options.allowedDomains.map((d) => d.toLowerCase()))
      : null;
    const emailRegex = options?.customRegex || DEFAULT_EMAIL_REGEX;

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        // Skip validation for non-strings
        if (typeof value !== "string") return true;

        // 1. Execute basic format check (trim should be done by user if needed)
        if (!emailRegex.test(value)) return false;

        // 2. Check domain restrictions if specified
        if (allowedDomains) {
          const atIndex = value.lastIndexOf("@");
          if (atIndex === -1) return false;

          const domain = value.substring(atIndex + 1).toLowerCase();
          return allowedDomains.has(domain);
        }

        return true;
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        // Provide specific error context based on which validation failed
        if (typeof value !== "string") {
          return messageFactory({ path, value, code });
        }

        let reason = "";

        // Determine specific failure reason for better error messages
        if (!emailRegex.test(value)) {
          reason = "invalid format";
        } else if (allowedDomains) {
          const atIndex = value.lastIndexOf("@");
          if (atIndex !== -1) {
            const domain = value.substring(atIndex + 1).toLowerCase();
            if (!allowedDomains.has(domain)) {
              reason = `domain not allowed (allowed: ${Array.from(allowedDomains).join(", ")})`;
            }
          }
        }

        const ctx = { path, value, code, reason };
        return messageFactory(ctx);
      },
      params: options ? [options] : [],
      // Store validation options for debugging and context
      validationOptions: options,
    };
  },
});
