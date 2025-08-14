/**
 * @luq-plugin
 * @name stringRelativeJsonPointer
 * @category string
 * @description Validates Relative JSON Pointer format (draft-handrews-relative-json-pointer)
 * @allowedTypes ["string"]
 * @example
 * ```typescript
 * const validator = Builder()
 *   .use(stringRelativeJsonPointerPlugin)
 *   .for<{ pointer: string }>()
 *   .v("pointer", (b) => b.string.relativeJsonPointer())
 *   .build();
 * 
 * // Valid: 0 (current location)
 * // Valid: 1/foo/bar (up 1 level, then to /foo/bar)
 * // Valid: 2/0 (up 2 levels, then to index 0)
 * // Valid: 0# (current location's key/index)
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional custom error message factory
 * @returns Validation function that checks Relative JSON Pointer format
 * @customError
 * ```typescript
 * .relativeJsonPointer({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be valid Relative JSON Pointer format, received: ${value}`
 * })
 * ```
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";
import type { MessageContext } from "./types";

// Relative JSON Pointer format:
// <non-negative-integer>(<json-pointer>|#)
// Where json-pointer follows RFC 6901
function isValidRelativeJsonPointer(value: string): boolean {
  // Must start with a non-negative integer
  const match = value.match(/^(\d+)(.*)$/);
  if (!match) return false;
  
  const [, levelStr, remainder] = match;
  
  // Check if the integer is valid (no leading zeros except for "0")
  if (levelStr.length > 1 && levelStr[0] === '0') {
    return false; // No leading zeros
  }
  
  // The remainder must be either:
  // 1. Empty (just the number)
  // 2. "#" (reference to key/index)
  // 3. A valid JSON Pointer (starts with /)
  
  if (remainder === '') {
    return true; // Just the number is valid
  }
  
  if (remainder === '#') {
    return true; // Number followed by # is valid
  }
  
  // Must be a JSON Pointer (RFC 6901)
  if (!remainder.startsWith('/')) {
    return false;
  }
  
  // Validate JSON Pointer part
  // Must use ~0 for ~ and ~1 for /
  const jsonPointerRegex = /^(\/([^~]|(~[01]))*)*$/;
  return jsonPointerRegex.test(remainder);
}

export const stringRelativeJsonPointerPlugin = plugin({
  name: "stringRelativeJsonPointer",
  methodName: "relativeJsonPointer",
  allowedTypes: ["string"] as const,
  category: "standard" as const,
  impl: (options?: { messageFactory?: (context: MessageContext) => string }) => {
    const getErrorMessage = () => `must be a valid Relative JSON Pointer`;
    const messageFactory = options?.messageFactory || ((ctx: MessageContext) => 
      `${ctx.path} ${getErrorMessage()}`
    );

    return {
      check: (value: string) => {
        if (typeof value !== "string") return false;
        return isValidRelativeJsonPointer(value);
      },
      code: "FORMAT_RELATIVE_JSON_POINTER",
      getErrorMessage: (value: string, path: string) => {
        return messageFactory({ path, value, code: "FORMAT_RELATIVE_JSON_POINTER" });
      },
      params: [options],
    };
  },
});