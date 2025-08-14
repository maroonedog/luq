/**
 * @luq-plugin
 * @name stringDate
 * @category string
 * @description Validates ISO 8601 date format (YYYY-MM-DD)
 * @allowedTypes ["string"]
 * @example
 * ```typescript
 * const validator = Builder()
 *   .use(stringDatePlugin)
 *   .for<{ birthDate: string }>()
 *   .v("birthDate", (b) => b.string.date())
 *   .build();
 * 
 * // Valid formats:
 * // 2024-01-15
 * // 2024-12-31
 * // 2000-02-29 (leap year)
 * 
 * // Invalid:
 * // 2024-13-01 (invalid month)
 * // 2024-02-30 (invalid day)
 * // 2024-1-1 (must be zero-padded)
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that checks ISO 8601 date format
 * @customError
 * ```typescript
 * .date({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be a valid ISO 8601 date format (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";
import type { MessageContext } from "./types";

// ISO 8601 date regex
// Format: YYYY-MM-DD
const ISO8601_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidDate(value: string): boolean {
  const match = value.match(ISO8601_DATE_REGEX);
  
  if (!match) {
    return false;
  }
  
  // Extract date components
  const [, yearStr, monthStr, dayStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  
  // Validate month range
  if (month < 1 || month > 12) {
    return false;
  }
  
  // Validate day range
  if (day < 1 || day > 31) {
    return false;
  }
  
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
  // Create a date at noon to avoid timezone issues
  const date = new Date(`${value}T12:00:00Z`);
  if (isNaN(date.getTime())) {
    return false;
  }
  
  // Verify the date didn't get adjusted (e.g., Feb 31 -> Mar 3)
  const dateCheck = date.toISOString().split('T')[0];
  return dateCheck === value;
}

export const stringDatePlugin = plugin({
  name: "stringDate",
  methodName: "date",
  allowedTypes: ["string"] as const,
  category: "standard" as const,
  impl: (options?: { messageFactory?: (context: MessageContext) => string }) => {
    const getErrorMessage = (value: string, path: string) => {
      const context: MessageContext = { path, value, code: "FORMAT_DATE" };
      return options?.messageFactory?.(context) || `${path} must be a valid ISO 8601 date (YYYY-MM-DD)`;
    };

    const messageFactory = (context: MessageContext) => {
      return options?.messageFactory?.(context) || `${context.path} must be a valid ISO 8601 date (YYYY-MM-DD)`;
    };

    return {
      check: (value: string) => {
        if (typeof value !== "string") return false;
        return isValidDate(value);
      },
      code: "FORMAT_DATE",
      getErrorMessage,
      messageFactory,
      params: [options],
    };
  },
});