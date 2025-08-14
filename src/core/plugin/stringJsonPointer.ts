/**
 * @luq-plugin
 * @name stringJsonPointer
 * @category string
 * @description Validates JSON Pointer format (RFC 6901)
 * @allowedTypes ["string"]
 * @see https://tools.ietf.org/html/rfc6901 - RFC 6901: JavaScript Object Notation (JSON) Pointer
 * @see https://datatracker.ietf.org/doc/html/rfc6901 - JSON Pointer Specification
 * @example
 * ```typescript
 * // Basic usage - validates JSON Pointer format (RFC 6901 compliant)
 * const validator = Builder()
 *   .use(stringJsonPointerPlugin)
 *   .for<{ pointer: string }>()
 *   .v("pointer", (b) => b.string.jsonPointer())
 *   .build();
 *
 * // ✅ VALID JSON Pointers (RFC 6901)
 * validator.parse({ pointer: "" });                    // Empty string (points to root document)
 * validator.parse({ pointer: "/" });                   // Points to empty property name
 * validator.parse({ pointer: "/foo" });                // Simple property access
 * validator.parse({ pointer: "/foo/bar" });            // Nested property access
 * validator.parse({ pointer: "/foo/0" });              // Array element by index
 * validator.parse({ pointer: "/foo/0/bar" });          // Property of array element
 * validator.parse({ pointer: "/users/123/name" });     // Deep nested access
 * validator.parse({ pointer: "/data/items/0/id" });    // Array element property
 * 
 * // Escaped characters (RFC 6901 escape sequences)
 * validator.parse({ pointer: "/~0" });                 // Escaped ~ character (represents "~")
 * validator.parse({ pointer: "/~1" });                 // Escaped / character (represents "/")
 * validator.parse({ pointer: "/~0~1" });               // Both escapes (represents "~/")
 * validator.parse({ pointer: "/foo~1bar" });           // Forward slash escaped in middle
 * validator.parse({ pointer: "/~0field" });            // Tilde escaped at start of token
 * validator.parse({ pointer: "/field~0" });            // Tilde escaped at end of token
 * validator.parse({ pointer: "/foo~0bar~1baz" });      // Multiple escapes in one token
 * 
 * // Real-world JSON structure examples
 * // For JSON: { "user": { "settings": { "theme": "dark" } } }
 * validator.parse({ pointer: "/user" });               // Access user object
 * validator.parse({ pointer: "/user/settings" });      // Access nested settings
 * validator.parse({ pointer: "/user/settings/theme" }); // Access theme value
 * 
 * // For JSON: { "items": [{"name": "Item1"}, {"name": "Item2"}] }
 * validator.parse({ pointer: "/items" });              // Access items array
 * validator.parse({ pointer: "/items/0" });            // First item
 * validator.parse({ pointer: "/items/1" });            // Second item
 * validator.parse({ pointer: "/items/0/name" });       // Name of first item
 * 
 * // For JSON with special property names
 * // { "": "empty name", "a/b": "slash in name", "c~d": "tilde in name" }
 * validator.parse({ pointer: "/" });                   // Empty property name
 * validator.parse({ pointer: "/a~1b" });               // Property "a/b" (/ escaped as ~1)
 * validator.parse({ pointer: "/c~0d" });               // Property "c~d" (~ escaped as ~0)
 * 
 * // Edge cases
 * validator.parse({ pointer: "/0" });                  // String "0" as property name
 * validator.parse({ pointer: "/-1" });                 // String "-1" as property name
 * validator.parse({ pointer: "/123" });                // Numeric string as property name
 * validator.parse({ pointer: "/true" });               // Boolean string as property name
 * validator.parse({ pointer: "/null" });               // Null string as property name
 *
 * // ❌ INVALID JSON Pointers
 * validator.parse({ pointer: "foo" });                 // Missing initial slash
 * validator.parse({ pointer: "foo/bar" });             // Missing initial slash
 * validator.parse({ pointer: "/foo/" });               // Trailing slash (points to empty property)
 * validator.parse({ pointer: "/foo//" });              // Double slash (empty token)
 * validator.parse({ pointer: "/~" });                  // Incomplete escape sequence
 * validator.parse({ pointer: "/~2" });                 // Invalid escape sequence (only ~0 and ~1 allowed)
 * validator.parse({ pointer: "/~3" });                 // Invalid escape sequence
 * validator.parse({ pointer: "/foo~" });               // Incomplete escape at end
 * validator.parse({ pointer: "/foo~bar" });            // Tilde without proper escape
 * validator.parse({ pointer: "/foo~/bar" });           // Incomplete escape in middle
 * validator.parse({ pointer: "~/foo" });               // Escape at start without leading slash
 * validator.parse({ pointer: "/foo bar" });            // Space in token (technically valid by RFC but often problematic)
 * validator.parse({ pointer: "/foo\tbar" });           // Tab character
 * validator.parse({ pointer: "/foo\nbar" });           // Newline character
 * validator.parse({ pointer: "/foo\rbar" });           // Carriage return
 * validator.parse({ pointer: "/foo\"bar" });           // Double quote (valid but can be problematic)
 * validator.parse({ pointer: "/foo'bar" });            // Single quote (valid but can be problematic)
 * validator.parse({ pointer: "/foo\\bar" });           // Backslash (valid but can be confusing)
 * validator.parse({ pointer: " /foo" });               // Leading space
 * validator.parse({ pointer: "/foo " });               // Trailing space
 * validator.parse({ pointer: "//foo" });               // Double slash at start
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional custom error message factory
 * @returns Validation function that checks JSON Pointer format
 * @customError
 * ```typescript
 * .jsonPointer({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be valid JSON Pointer format, received: ${value}`
 * })
 * ```
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";
import type { MessageContext } from "./types";

// JSON Pointer regex (RFC 6901)
// Must be empty or start with /, and use ~0 for ~ and ~1 for /
const JSON_POINTER_REGEX = /^(\/([^~]|(~[01]))*)*$/;

export const stringJsonPointerPlugin = plugin({
  name: "stringJsonPointer",
  methodName: "jsonPointer",
  allowedTypes: ["string"] as const,
  category: "standard" as const,
  impl: (options?: { messageFactory?: (context: MessageContext) => string }) => {
    const getErrorMessage = () => `must be a valid JSON Pointer (RFC 6901)`;
    const messageFactory = options?.messageFactory || ((ctx: MessageContext) => 
      `${ctx.path} ${getErrorMessage()}`
    );

    return {
      check: (value: string) => {
        if (typeof value !== "string") return false;
        return JSON_POINTER_REGEX.test(value);
      },
      code: "FORMAT_JSON_POINTER",
      getErrorMessage: (value: string, path: string) => {
        return messageFactory({ path, value, code: "FORMAT_JSON_POINTER" });
      },
      params: [options],
    };
  },
});