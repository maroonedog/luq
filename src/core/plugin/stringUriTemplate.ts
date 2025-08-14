/**
 * @luq-plugin
 * @name stringUriTemplate
 * @category string
 * @description Validates URI Template format (RFC 6570)
 * @allowedTypes ["string"]
 * @example
 * ```typescript
 * const validator = Builder()
 *   .use(stringUriTemplatePlugin)
 *   .for<{ template: string }>()
 *   .v("template", (b) => b.string.uriTemplate())
 *   .build();
 * 
 * // Valid: https://api.example.com/users/{id}
 * // Valid: /search{?q,lang}
 * // Valid: /path{/segments*}
 * // Valid: {+path}/here
 * // Valid: {#section}
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional custom error message factory
 * @returns Validation function that checks URI Template format
 * @customError
 * ```typescript
 * .uriTemplate({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be a valid URI Template, received: ${value}`
 * })
 * ```
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";
import type { MessageContext } from "./types";

// RFC 6570 URI Template validation
function isValidURITemplate(value: string): boolean {
  // Track bracket state
  let inExpression = false;
  let i = 0;
  
  while (i < value.length) {
    const char = value[i];
    
    if (char === '{') {
      if (inExpression) return false; // Nested brackets not allowed
      inExpression = true;
      i++;
      
      // Check for expression operator (+, #, /, ;, ?, &, =, ,, !, @, |)
      if (i < value.length) {
        const operator = value[i];
        if ("+#/;?&=,!@|".includes(operator)) {
          i++;
        }
      }
      
      // Expression must contain at least one variable
      let hasVariable = false;
      let varStart = i;
      
      while (i < value.length && value[i] !== '}') {
        const c = value[i];
        
        // Variable name characters (ALPHA / DIGIT / _ / %)
        if (/[a-zA-Z0-9_%]/.test(c)) {
          hasVariable = true;
        } else if (c === '.') {
          // Dot allowed in variable names
          if (i === varStart) return false; // Can't start with dot
        } else if (c === ':') {
          // Prefix modifier
          i++;
          // Must be followed by max length (1-4 digits)
          let digitCount = 0;
          while (i < value.length && /\d/.test(value[i]) && digitCount < 4) {
            i++;
            digitCount++;
          }
          if (digitCount === 0) return false;
          continue;
        } else if (c === '*') {
          // Explode modifier
          i++;
          // Must be at end of variable or followed by comma
          if (i < value.length && value[i] !== '}' && value[i] !== ',') {
            return false;
          }
          continue;
        } else if (c === ',') {
          // Variable separator
          if (!hasVariable) return false; // Must have variable before comma
          hasVariable = false;
          varStart = i + 1;
        } else {
          return false; // Invalid character in expression
        }
        i++;
      }
      
      if (i >= value.length) return false; // Unclosed expression
      if (!hasVariable) return false; // Empty expression
      
      // We found the closing bracket, mark expression as closed
      if (value[i] === '}') {
        inExpression = false;
      } else {
        return false; // Expected closing bracket
      }
      
    } else if (char === '}') {
      if (!inExpression) return false; // Closing bracket without opening
      inExpression = false;
    } else {
      // Characters outside expressions
      // Reserved characters need to be percent-encoded
      // But we'll be lenient here and just check for obviously invalid chars
      if (char === '{' || char === '}') {
        return false; // Brackets must be part of expressions
      }
    }
    i++;
  }
  
  return !inExpression; // All expressions must be closed
}

export const stringUriTemplatePlugin = plugin({
  name: "stringUriTemplate",
  methodName: "uriTemplate",
  allowedTypes: ["string"] as const,
  category: "standard" as const,
  impl: (options?: { messageFactory?: (context: MessageContext) => string }) => {
    const getErrorMessage = () => `must be a valid URI Template (RFC 6570)`;
    const messageFactory = options?.messageFactory || ((ctx: MessageContext) => 
      `${ctx.path} ${getErrorMessage()}`
    );

    return {
      check: (value: string) => {
        if (typeof value !== "string") return false;
        return isValidURITemplate(value);
      },
      code: "FORMAT_URI_TEMPLATE",
      getErrorMessage: (value: string, path: string) => {
        return messageFactory({ path, value, code: "FORMAT_URI_TEMPLATE" });
      },
      params: [options],
    };
  },
});