import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

// Local error message function
function getErrorMessage(ctx: MessageContext & { version?: string }): string {
  return ctx.version
    ? `Value must be a valid UUID ${ctx.version} format`
    : "Value must be a valid UUID format";
}

// UUID validation for string type only
const supportedTypes = ["string"] as const;

// Supported UUID versions
const SUPPORTED_VERSIONS = [1, 3, 4, 5, 6, 7, 8] as const;
type UUIDVersion = (typeof SUPPORTED_VERSIONS)[number];

// Generate UUID pattern for a specific version
function createUUIDPattern(version: UUIDVersion): RegExp {
  return new RegExp(
    `^[0-9a-f]{8}-[0-9a-f]{4}-${version}[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`,
    "i"
  );
}

// Pre-compile patterns for all versions (cached for performance)
const UUID_PATTERNS: Record<UUIDVersion, RegExp> = {} as Record<
  UUIDVersion,
  RegExp
>;
for (const version of SUPPORTED_VERSIONS) {
  UUID_PATTERNS[version] = createUUIDPattern(version);
}

// General UUID pattern (any version 1-8)
const GENERAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @luq-plugin
 * @name uuid
 * @category standard
 * @description Validates that a string is a valid UUID (Universally Unique Identifier)
 * @allowedTypes ["string"]
 * @see https://tools.ietf.org/html/rfc4122 - RFC 4122: A Universally Unique IDentifier (UUID) URN Namespace
 * @see https://developer.mozilla.org/en-US/docs/Glossary/UUID - MDN UUID Reference
 * @example
 * ```typescript
 * // Basic usage - validate any UUID version (RFC 4122 compliant)
 * const validator = Builder()
 *   .use(uuidPlugin)
 *   .for<Entity>()
 *   .v("id", (b) => b.string.uuid())
 *   .v("correlationId", (b) => b.string.required().uuid())
 *   .build();
 *
 * // Validate specific UUID version
 * builder.v("userId", b => b.string.uuid(4))  // UUID v4 only
 * builder.v("namespaceId", b => b.string.uuid(5))  // UUID v5 only
 * builder.v("timestamp", b => b.string.uuid(7))  // UUID v7 only (time-based)
 *
 * // ✅ VALID UUID formats (RFC 4122)
 * // UUID v1 (MAC address + timestamp based)
 * validator.parse({ id: "12345678-1234-1234-8123-123456789abc" });
 * validator.parse({ id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" });
 * 
 * // UUID v3 (MD5 hash based)
 * validator.parse({ id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" });
 * validator.parse({ id: "12345678-1234-3234-8123-123456789abc" });
 * 
 * // UUID v4 (random)
 * validator.parse({ id: "550e8400-e29b-41d4-a716-446655440000" });
 * validator.parse({ id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" });
 * validator.parse({ id: "12345678-1234-4234-9123-123456789abc" });
 * 
 * // UUID v5 (SHA-1 hash based)
 * validator.parse({ id: "6ba7b811-9dad-11d1-80b4-00c04fd430c8" });
 * validator.parse({ id: "12345678-1234-5234-8123-123456789abc" });
 * 
 * // UUID v6 (reordered timestamp)
 * validator.parse({ id: "1EC9414C-232A-6B00-B3C8-9E6BDECED846" });
 * validator.parse({ id: "12345678-1234-6234-9123-123456789abc" });
 * 
 * // UUID v7 (Unix timestamp based)
 * validator.parse({ id: "017F22E2-79B0-7CC3-98C4-DC0C0C07398F" });
 * validator.parse({ id: "12345678-1234-7234-8123-123456789abc" });
 * 
 * // UUID v8 (custom/application-specific)
 * validator.parse({ id: "12345678-1234-8234-9123-123456789abc" });
 * 
 * // Case insensitive
 * validator.parse({ id: "F47AC10B-58CC-4372-A567-0E02B2C3D479" });
 * validator.parse({ id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" });
 *
 * // ❌ INVALID UUID formats
 * validator.parse({ id: "not-a-uuid" });                      // Plain text
 * validator.parse({ id: "12345678-1234-1234-1234-123456789" }); // Too short
 * validator.parse({ id: "12345678-1234-1234-1234-123456789abcd" }); // Too long
 * validator.parse({ id: "12345678-1234-0234-8123-123456789abc" }); // Invalid version (0)
 * validator.parse({ id: "12345678-1234-9234-8123-123456789abc" }); // Invalid version (9)
 * validator.parse({ id: "12345678-1234-4234-0123-123456789abc" }); // Invalid variant (0)
 * validator.parse({ id: "12345678-1234-4234-c123-123456789abc" }); // Invalid variant (c)
 * validator.parse({ id: "12345678-1234-4234-g123-123456789abc" }); // Invalid hex char (g)
 * validator.parse({ id: "12345678123412348123123456789abc" });     // Missing hyphens
 * validator.parse({ id: "12345678-1234-4234-8123-123456789ab" });  // Missing last char
 * validator.parse({ id: "12345678-1234-4234-8123-123456789abcX" }); // Extra char
 * validator.parse({ id: "" });                                    // Empty string
 * validator.parse({ id: "12345678-1234-4234-8123-123456789ab " }); // Trailing space
 * validator.parse({ id: " 12345678-1234-4234-8123-123456789abc" }); // Leading space
 * ```
 * @params
 * - version?: 1 | 3 | 4 | 5 | 6 | 7 | 8 - Specific UUID version to validate (optional)
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if string is a valid UUID
 * @customError
 * ```typescript
 * .uuid(4, {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} must be a valid UUID v${params.version} (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const uuidPlugin = plugin({
  name: "stringUuid",
  methodName: "uuid",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (
    version?: UUIDVersion | readonly UUIDVersion[],
    options?: ValidationOptions
  ) => {
    const messageFactory = options?.messageFactory || getErrorMessage;

    if (!version) {
      // No version specified - general UUID validation
      const code = options?.code || "uuid";

      // Return hoisted validator format
      return {
        check: (value: any) => {
          // Pure validation - no side effects
          // Skip validation for non-strings
          if (typeof value !== "string") return true;
          return GENERAL_UUID_PATTERN.test(value);
        },
        code: code,

        getErrorMessage: (value: any, path: string) => {
          const ctx = { path, value, code };
          return messageFactory(ctx);
        },
        params: [version, options],
      };
    }

    // Version(s) specified
    const versions = Array.isArray(version) ? version : [version];
    const versionStr = Array.isArray(version)
      ? `v${version.join(", v")}`
      : `v${version}`;
    const code = options?.code || "uuidVersion";

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        // Skip validation for non-strings
        if (typeof value !== "string") return true;

        // Early exit on first match
        const versionsLength = versions.length;
        for (let i = 0; i < versionsLength; i++) {
          const v = versions[i] as UUIDVersion;
          if (UUID_PATTERNS[v] && UUID_PATTERNS[v].test(value)) {
            return true;
          }
        }
        return false;
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const ctx = { path, value, code, version: versionStr };
        return messageFactory(ctx);
      },
      params: [version, options],
    };
  },
});
