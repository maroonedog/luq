/**
 * @luq-plugin
 * @name stringContentEncoding
 * @category string
 * @description Validates string content encoding (base64, base32, binary, etc.)
 * @allowedTypes ["string"]
 * @example
 * ```typescript
 * const validator = Builder()
 *   .use(stringContentEncodingPlugin)
 *   .for<{ data: string }>()
 *   .v("data", (b) => b.string.contentEncoding("base64"))
 *   .build();
 * 
 * // Valid for base64: SGVsbG8gV29ybGQ=
 * // Valid for base32: JBSWY3DPEBLW64TMMQ======
 * // Valid for binary: 01001000 01100101
 * ```
 * @params
 * - encoding: "base64" | "base32" | "binary" | "7bit" | "8bit" | "quoted-printable"
 * - options?: { messageFactory?: (context: MessageContext) => string }
 * @returns Validation function that checks content encoding
 * @customError
 * ```typescript
 * .contentEncoding("base64", {
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be valid base64 encoded content (received: ${value.substring(0, 20)}...)`
 * })
 * ```
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";
import type { MessageContext } from "./types";

// Base64 validation (standard)
const BASE64_REGEX = /^[A-Za-z0-9+/]*={0,2}$/;

// Base32 validation (RFC 4648)
const BASE32_REGEX = /^[A-Z2-7]*={0,6}$/;

// Binary string (0 and 1 only)
const BINARY_REGEX = /^[01\s]*$/;

// 7bit ASCII (0x00-0x7F)
function is7Bit(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 127) return false;
  }
  return true;
}

// 8bit (0x00-0xFF) - all strings are valid in JavaScript
function is8Bit(value: string): boolean {
  return true; // JavaScript strings can contain any Unicode character
}

// Quoted-printable validation
function isQuotedPrintable(value: string): boolean {
  // Simplified check: lines should not be longer than 76 chars
  // and = should be followed by two hex digits or line break
  const lines = value.split(/\r?\n/);
  
  for (const line of lines) {
    if (line.length > 76) return false;
    
    // Check for valid quoted-printable sequences
    let i = 0;
    while (i < line.length) {
      if (line[i] === '=') {
        if (i === line.length - 1) {
          // Soft line break at end of line is valid
          break;
        }
        if (i + 2 < line.length) {
          // Should be followed by two hex digits
          const hex = line.substring(i + 1, i + 3);
          if (!/^[0-9A-Fa-f]{2}$/.test(hex)) {
            return false;
          }
          i += 3;
        } else {
          return false;
        }
      } else {
        i++;
      }
    }
  }
  
  return true;
}

function validateEncoding(value: string, encoding: string): boolean {
  switch (encoding.toLowerCase()) {
    case 'base64':
      if (value === '') return true;
      if (value.length % 4 !== 0) return false;
      return BASE64_REGEX.test(value);
      
    case 'base32':
      if (value === '') return true;
      if (value.length % 8 !== 0) return false;
      return BASE32_REGEX.test(value);
      
    case 'binary':
      return BINARY_REGEX.test(value);
      
    case '7bit':
      return is7Bit(value);
      
    case '8bit':
      return is8Bit(value);
      
    case 'quoted-printable':
      return isQuotedPrintable(value);
      
    default:
      // Unknown encoding, be permissive
      return true;
  }
}

export const stringContentEncodingPlugin = plugin({
  name: "stringContentEncoding",
  methodName: "contentEncoding",
  allowedTypes: ["string"] as const,
  category: "standard" as const,
  impl: (
    encoding: "base64" | "base32" | "binary" | "7bit" | "8bit" | "quoted-printable" | string,
    options?: { messageFactory?: (context: MessageContext) => string }
  ) => {
    const getErrorMessage = (value: string, path: string) => {
      const context: MessageContext = { path, value, code: "CONTENT_ENCODING" };
      return options?.messageFactory?.(context) || `${path} must be valid ${encoding} encoded content`;
    };

    const messageFactory = (context: MessageContext) => {
      return options?.messageFactory?.(context) || `${context.path} must be valid ${encoding} encoded content`;
    };

    return {
      check: (value: string) => {
        if (typeof value !== "string") return false;
        return validateEncoding(value, encoding);
      },
      code: "CONTENT_ENCODING",
      getErrorMessage,
      messageFactory,
      params: [encoding, options],
    };
  },
});