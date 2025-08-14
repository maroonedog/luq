/**
 * @luq-plugin
 * @name stringDuration
 * @category string
 * @description Validates ISO 8601 duration format
 * @allowedTypes ["string"]
 * @example
 * ```typescript
 * const validator = Builder()
 *   .use(stringDurationPlugin)
 *   .for<{ duration: string }>()
 *   .v("duration", (b) => b.string.duration())
 *   .build();
 * 
 * // Valid: P3Y6M4DT12H30M5S (3 years, 6 months, 4 days, 12 hours, 30 minutes, 5 seconds)
 * // Valid: PT1H30M (1 hour, 30 minutes)
 * // Valid: P7D (7 days)
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional custom error message factory
 * @returns Validation function that checks ISO 8601 duration format
 * @customError
 * ```typescript
 * .duration({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be valid ISO 8601 duration format, received: ${value}`
 * })
 * ```
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";
import type { MessageContext } from "./types";

// ISO 8601 Duration regex
const DURATION_REGEX = /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/;

export const stringDurationPlugin = plugin({
  name: "stringDuration",
  methodName: "duration",
  allowedTypes: ["string"] as const,
  category: "standard" as const,
  impl: (options?: { messageFactory?: (context: MessageContext) => string }) => {
    const getErrorMessage = () => `must be a valid ISO 8601 duration`;
    const messageFactory = options?.messageFactory || ((ctx: MessageContext) => 
      `${ctx.path} ${getErrorMessage()}`
    );

    return {
      check: (value: string) => {
        if (typeof value !== "string") return false;
        return DURATION_REGEX.test(value);
      },
      code: "FORMAT_DURATION",
      getErrorMessage: (value: string, path: string) => {
        return messageFactory({ path, value, code: "FORMAT_DURATION" });
      },
      params: [options],
    };
  },
});