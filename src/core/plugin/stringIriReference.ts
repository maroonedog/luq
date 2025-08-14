/**
 * @luq-plugin
 * @name stringIriReference
 * @category string
 * @description Validates IRI-reference format (RFC 3987) - can be absolute or relative
 * @allowedTypes ["string"]
 * @example
 * ```typescript
 * const validator = Builder()
 *   .use(stringIriReferencePlugin)
 *   .for<{ ref: string }>()
 *   .v("ref", (b) => b.string.iriReference())
 *   .build();
 * 
 * // Valid: https://example.com/path
 * // Valid: /relative/path
 * // Valid: ../parent
 * // Valid: #fragment
 * // Valid: ?query=param
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional custom error message factory
 * @returns Validation function that checks IRI-reference format
 * @customError
 * ```typescript
 * .iriReference({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be valid IRI-reference format, received: ${value}`
 * })
 * ```
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";
import type { MessageContext } from "./types";

function isValidIRIReference(value: string): boolean {
  // Empty string is valid IRI-reference
  if (value === "") return true;
  
  // Check for invalid control characters
  if (/[\x00-\x1F\x7F]/.test(value)) return false;
  
  // Check for invalid whitespace (except in query or fragment)
  const beforeQueryOrFragment = value.split(/[?#]/)[0];
  if (/\s/.test(beforeQueryOrFragment)) return false;
  
  // IRI-reference can be:
  // 1. Absolute IRI (with scheme)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
    // Check if it's a valid absolute IRI
    try {
      new URL(value);
      return true;
    } catch {
      // For non-ASCII IRIs, basic validation
      return /^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/.test(value);
    }
  }
  
  // 2. Relative reference (path, query, fragment)
  // Can start with //, /, ./, ../, or directly with path segment
  // Can contain query (?) and fragment (#)
  
  // Network-path reference (starts with //)
  if (value.startsWith("//")) {
    return value.length > 2 && !value.slice(2).includes("//");
  }
  
  // Absolute-path reference (starts with /)
  if (value.startsWith("/")) {
    return true;
  }
  
  // Relative-path reference (starts with ./ or ../ or path segment)
  if (value.startsWith("./") || value.startsWith("../")) {
    return true;
  }
  
  // Query-only reference (starts with ?)
  if (value.startsWith("?")) {
    return true;
  }
  
  // Fragment-only reference (starts with #)
  if (value.startsWith("#")) {
    return true;
  }
  
  // Path segment (doesn't start with special characters)
  // Must not contain : in first segment (would be confused with scheme)
  const firstSegment = value.split(/[/?#]/)[0];
  if (firstSegment.includes(":")) {
    return false;
  }
  
  return true;
}

export const stringIriReferencePlugin = plugin({
  name: "stringIriReference",
  methodName: "iriReference",
  allowedTypes: ["string"] as const,
  category: "standard" as const,
  impl: (options?: { messageFactory?: (context: MessageContext) => string }) => {
    const getErrorMessage = () => `must be a valid IRI-reference (RFC 3987)`;
    const messageFactory = options?.messageFactory || ((ctx: MessageContext) => 
      `${ctx.path} ${getErrorMessage()}`
    );

    return {
      check: (value: string) => {
        if (typeof value !== "string") return false;
        return isValidIRIReference(value);
      },
      code: "FORMAT_IRI_REFERENCE",
      getErrorMessage: (value: string, path: string) => {
        return messageFactory({ path, value, code: "FORMAT_IRI_REFERENCE" });
      },
      params: [options],
    };
  },
});