import { plugin } from "../builder/plugins/plugin-creator";
import type { MessageContext } from "./types";

// ISO 8601 datetime regex patterns
// Strict: requires timezone (Z or offset)
const ISO8601_DATETIME_STRICT = 
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

// Lenient: timezone optional
const ISO8601_DATETIME_LENIENT = 
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/;

function isValidDateTime(value: string, strict: boolean = false): boolean {
  // Check format
  const regex = strict ? ISO8601_DATETIME_STRICT : ISO8601_DATETIME_LENIENT;
  const match = value.match(regex);
  
  if (!match) {
    return false;
  }
  
  // Extract date and time components
  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const second = parseInt(secondStr, 10);
  
  // Validate ranges
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;
  if (second < 0 || second > 60) return false; // 60 for leap seconds
  
  // Validate days in month
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  // Check for leap year
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  if (isLeapYear) {
    daysInMonth[1] = 29;
  }
  
  if (day > daysInMonth[month - 1]) {
    return false;
  }
  
  // Additional validation: try to parse with Date
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * @luq-plugin
 * @name stringDatetime
 * @category string
 * @description Validates ISO 8601 datetime format with optional timezone support
 * @allowedTypes ["string"]
 * @see https://tools.ietf.org/html/rfc3339 - RFC 3339: Date and Time on the Internet: Timestamps
 * @see https://en.wikipedia.org/wiki/ISO_8601 - ISO 8601 Date and Time Format
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date - MDN Date Object
 * @example
 * ```typescript
 * // Basic usage - validates ISO 8601 datetime format (RFC 3339 compliant)
 * const validator = Builder()
 *   .use(stringDatetimePlugin)
 *   .for<{ timestamp: string }>()
 *   .v("timestamp", (b) => b.string.datetime())
 *   .build();
 *
 * // Strict mode - requires timezone
 * const strictValidator = Builder()
 *   .use(stringDatetimePlugin)
 *   .for<{ timestamp: string }>()
 *   .v("timestamp", (b) => b.string.datetime({ strict: true }))
 *   .build();
 * 
 * // ✅ VALID datetime formats (RFC 3339 / ISO 8601)
 * // UTC timezone
 * validator.parse({ timestamp: "2024-01-15T10:30:00Z" });           // UTC with Z
 * validator.parse({ timestamp: "2024-12-31T23:59:59Z" });           // End of year
 * validator.parse({ timestamp: "2000-01-01T00:00:00Z" });           // Y2K date
 * 
 * // With timezone offsets
 * validator.parse({ timestamp: "2024-01-15T10:30:00+09:00" });      // Japan timezone
 * validator.parse({ timestamp: "2024-01-15T10:30:00-05:00" });      // EST timezone
 * validator.parse({ timestamp: "2024-01-15T10:30:00+00:00" });      // UTC with offset
 * validator.parse({ timestamp: "2024-01-15T10:30:00-12:00" });      // Far west timezone
 * validator.parse({ timestamp: "2024-01-15T10:30:00+14:00" });      // Far east timezone
 * 
 * // With milliseconds
 * validator.parse({ timestamp: "2024-01-15T10:30:00.123Z" });       // 3-digit milliseconds
 * validator.parse({ timestamp: "2024-01-15T10:30:00.1Z" });         // 1-digit milliseconds
 * validator.parse({ timestamp: "2024-01-15T10:30:00.12Z" });        // 2-digit milliseconds
 * validator.parse({ timestamp: "2024-01-15T10:30:00.999+09:00" });  // Max milliseconds with offset
 * 
 * // Leap year dates
 * validator.parse({ timestamp: "2024-02-29T12:00:00Z" });           // Valid leap day 2024
 * validator.parse({ timestamp: "2000-02-29T12:00:00Z" });           // Valid leap day 2000
 * 
 * // Edge cases
 * validator.parse({ timestamp: "2024-01-01T00:00:00Z" });           // Start of year
 * validator.parse({ timestamp: "2024-12-31T23:59:59.999Z" });       // End of year with ms
 * validator.parse({ timestamp: "1970-01-01T00:00:00Z" });           // Unix epoch
 * validator.parse({ timestamp: "9999-12-31T23:59:59Z" });           // Far future
 * 
 * // Without timezone (lenient mode only)
 * validator.parse({ timestamp: "2024-01-15T10:30:00" });            // Local time (strict: false)
 * validator.parse({ timestamp: "2024-01-15T10:30:00.123" });        // Local time with ms
 *
 * // ❌ INVALID datetime formats
 * validator.parse({ timestamp: "invalid-datetime" });               // Plain text
 * validator.parse({ timestamp: "2024-13-15T10:30:00Z" });           // Invalid month (13)
 * validator.parse({ timestamp: "2024-00-15T10:30:00Z" });           // Invalid month (0)
 * validator.parse({ timestamp: "2024-01-32T10:30:00Z" });           // Invalid day (32)
 * validator.parse({ timestamp: "2024-01-00T10:30:00Z" });           // Invalid day (0)
 * validator.parse({ timestamp: "2024-01-15T25:30:00Z" });           // Invalid hour (25)
 * validator.parse({ timestamp: "2024-01-15T10:60:00Z" });           // Invalid minute (60)
 * validator.parse({ timestamp: "2024-01-15T10:30:61Z" });           // Invalid second (61)
 * validator.parse({ timestamp: "2024-02-30T10:30:00Z" });           // Invalid day for February
 * validator.parse({ timestamp: "2023-02-29T10:30:00Z" });           // Not a leap year
 * validator.parse({ timestamp: "2024-04-31T10:30:00Z" });           // Invalid day for April
 * validator.parse({ timestamp: "2024-01-15 10:30:00Z" });           // Space instead of T
 * validator.parse({ timestamp: "2024/01/15T10:30:00Z" });           // Wrong date separator
 * validator.parse({ timestamp: "24-01-15T10:30:00Z" });             // 2-digit year
 * validator.parse({ timestamp: "2024-1-15T10:30:00Z" });            // Single-digit month
 * validator.parse({ timestamp: "2024-01-5T10:30:00Z" });            // Single-digit day
 * validator.parse({ timestamp: "2024-01-15T10:30:00" });            // Missing timezone (strict: true)
 * validator.parse({ timestamp: "2024-01-15T10:30:00+25:00" });      // Invalid timezone offset
 * validator.parse({ timestamp: "2024-01-15T10:30:00.1234Z" });      // Too many milliseconds digits
 * validator.parse({ timestamp: "" });                              // Empty string
 * validator.parse({ timestamp: "2024-01-15T10:30:00Z " });          // Trailing space
 * validator.parse({ timestamp: " 2024-01-15T10:30:00Z" });          // Leading space
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string; strict?: boolean } - Optional configuration
 * @returns Validation function that checks ISO 8601 datetime format
 * @customError
 * ```typescript
 * .datetime({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be a valid ISO 8601 datetime (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const stringDatetimePlugin = plugin({
  name: "stringDatetime",
  methodName: "datetime",
  allowedTypes: ["string"] as const,
  category: "standard" as const,
  impl: (options?: { messageFactory?: (context: MessageContext) => string; strict?: boolean }) => {
    const getErrorMessage = (value: string, path: string) => {
      const context: MessageContext = { path, value, code: "FORMAT_DATETIME" };
      return options?.messageFactory?.(context) || `${path} must be a valid ISO 8601 datetime`;
    };

    const messageFactory = (context: MessageContext) => {
      return options?.messageFactory?.(context) || `${context.path} must be a valid ISO 8601 datetime`;
    };

    return {
      check: (value: string) => {
        if (typeof value !== "string") return false;
        return isValidDateTime(value, options?.strict);
      },
      code: "FORMAT_DATETIME",
      getErrorMessage,
      messageFactory,
      params: [options],
    };
  },
});
