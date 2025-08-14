/**
 * @luq-plugin
 * @name stringContentMediaType
 * @category string
 * @description Validates that a string's decoded content matches the specified media type
 * @allowedTypes ["string"]
 * @example
 * ```typescript
 * const validator = Builder()
 *   .use(stringContentMediaTypePlugin)
 *   .for<{ data: string }>()
 *   .v("data", (b) => b.string.contentMediaType("application/json"))
 *   .build();
 * 
 * // Valid: base64-encoded JSON
 * validator.validate({ data: "eyJrZXkiOiJ2YWx1ZSJ9" }); // {"key":"value"}
 * 
 * // Invalid: not valid JSON when decoded
 * validator.validate({ data: "aGVsbG8gd29ybGQ=" }); // "hello world"
 * ```
 * @params
 * - mediaType: string - The expected media type
 * - options?: { encoding?: string; messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that checks content media type
 * @customError
 * ```typescript
 * .contentMediaType("application/json", {
 *   messageFactory: ({ path, value }) =>
 *     `${path} must contain valid JSON content (received: ${value.substring(0, 20)}...)`
 * })
 * ```
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";
import type { MessageContext } from "./types";

// Helper to decode content based on encoding
function decodeContent(value: string, encoding?: string): string | null {
  try {
    if (encoding === "base64") {
      // Decode base64
      if (typeof Buffer !== "undefined") {
        // Node.js environment
        return Buffer.from(value, "base64").toString("utf-8");
      } else if (typeof atob !== "undefined") {
        // Browser environment
        return atob(value);
      }
    }
    // No encoding or unsupported encoding - return as is
    return value;
  } catch {
    return null;
  }
}

// Media type validators
const mediaTypeValidators: Record<string, (content: string) => boolean> = {
  "application/json": (content: string) => {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  },
  
  "text/html": (content: string) => {
    // Basic HTML validation - check for HTML-like tags
    return /<\/?[a-z][\s\S]*>/i.test(content);
  },
  
  "text/xml": (content: string) => {
    // Basic XML validation - check for XML declaration or root element
    return /^<\?xml[^>]*\?>|^<[a-zA-Z][\s\S]*>[\s\S]*<\/[a-zA-Z][\s\S]*>$/m.test(content.trim());
  },
  
  "text/plain": () => {
    // Plain text is always valid
    return true;
  },
  
  "text/css": (content: string) => {
    // Basic CSS validation - check for CSS-like syntax
    return /[a-zA-Z-]+\s*:\s*[^;]+;?|\.[a-zA-Z-]+\s*\{|#[a-zA-Z-]+\s*\{|[a-zA-Z]+\s*\{/.test(content);
  },
  
  "text/javascript": (content: string) => {
    // Basic JavaScript validation - check for JS-like syntax
    return /function\s+\w+\s*\(|const\s+\w+|let\s+\w+|var\s+\w+|=>\s*{|class\s+\w+/.test(content);
  },
  
  "application/xml": (content: string) => {
    // Same as text/xml
    return mediaTypeValidators["text/xml"](content);
  },
  
  "application/pdf": (content: string) => {
    // Check PDF magic number (when decoded from base64, should start with %PDF)
    return content.startsWith("%PDF");
  },
  
  "image/png": (content: string) => {
    // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
    // When decoded from base64, check for PNG signature
    if (typeof Buffer !== "undefined") {
      const buffer = Buffer.from(content, "binary");
      return buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4E &&
        buffer[3] === 0x47;
    }
    // In browser, check for PNG signature in string
    return content.charCodeAt(0) === 0x89 &&
      content.charCodeAt(1) === 0x50 &&
      content.charCodeAt(2) === 0x4E &&
      content.charCodeAt(3) === 0x47;
  },
  
  "image/jpeg": (content: string) => {
    // JPEG magic number: FF D8 FF
    if (typeof Buffer !== "undefined") {
      const buffer = Buffer.from(content, "binary");
      return buffer.length >= 3 &&
        buffer[0] === 0xFF &&
        buffer[1] === 0xD8 &&
        buffer[2] === 0xFF;
    }
    // In browser
    return content.charCodeAt(0) === 0xFF &&
      content.charCodeAt(1) === 0xD8 &&
      content.charCodeAt(2) === 0xFF;
  },
  
  "image/gif": (content: string) => {
    // GIF magic number: GIF87a or GIF89a
    return content.startsWith("GIF87a") || content.startsWith("GIF89a");
  },
  
  "image/svg+xml": (content: string) => {
    // SVG is XML with svg root element
    return /<svg[^>]*>[\s\S]*<\/svg>/i.test(content);
  }
};

function validateMediaType(value: string, mediaType: string, encoding?: string): boolean {
  // Decode content if encoding is specified
  const content = encoding ? decodeContent(value, encoding) : value;
  
  if (content === null) {
    // Failed to decode
    return false;
  }
  
  // Check if we have a validator for this media type
  const validator = mediaTypeValidators[mediaType.toLowerCase()];
  if (validator) {
    return validator(content);
  }
  
  // For unknown media types, check generic categories
  if (mediaType.startsWith("text/")) {
    // Any text type - just ensure it's valid UTF-8 (already decoded)
    return true;
  }
  
  if (mediaType.startsWith("application/") && mediaType.includes("json")) {
    // Any JSON-like media type
    return mediaTypeValidators["application/json"](content);
  }
  
  if (mediaType.startsWith("application/") && mediaType.includes("xml")) {
    // Any XML-like media type
    return mediaTypeValidators["application/xml"](content);
  }
  
  // Unknown media type - can't validate
  return true; // Be permissive for unknown types
}

export const stringContentMediaTypePlugin = plugin({
  name: "stringContentMediaType",
  methodName: "contentMediaType",
  allowedTypes: ["string"] as const,
  category: "standard" as const,
  impl: (mediaType: string, options?: { encoding?: string; messageFactory?: (context: MessageContext) => string }) => {
    const getErrorMessage = (value: string, path: string) => {
      const context: MessageContext = { path, value, code: "CONTENT_MEDIA_TYPE" };
      return options?.messageFactory?.(context) || `${path} must be valid ${mediaType} content${options?.encoding ? ` (${options.encoding} encoded)` : ''}`;
    };

    const messageFactory = (context: MessageContext) => {
      return options?.messageFactory?.(context) || `${context.path} must be valid ${mediaType} content${options?.encoding ? ` (${options.encoding} encoded)` : ''}`;
    };

    return {
      check: (value: string) => {
        if (typeof value !== "string") return false;
        return validateMediaType(value, mediaType, options?.encoding);
      },
      code: "CONTENT_MEDIA_TYPE",
      getErrorMessage,
      messageFactory,
      params: [mediaType, options],
    };
  },
});