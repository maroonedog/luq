/**
 * @luq-plugin
 * @name stringTime
 * @category string
 * @description Validates time format (HH:MM:SS or HH:MM:SS.mmm)
 * @allowedTypes ["string"]
 * @example
 * ```typescript
 * const validator = Builder()
 *   .use(stringTimePlugin)
 *   .for<{ startTime: string }>()
 *   .v("startTime", (b) => b.string.time())
 *   .build();
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string; allowMilliseconds?: boolean } - Optional configuration
 * @returns Validation function that checks time format
 * @customError
 * ```typescript
 * .time({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be a valid time format, received: ${value}`
 * })
 * ```
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";
import type { MessageContext } from "./types";

// Time regex with optional milliseconds
const TIME_REGEX = /^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.[0-9]{1,3})?$/;
const TIME_NO_MS_REGEX = /^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/;

export const stringTimePlugin = plugin({
  name: "stringTime",
  methodName: "time",
  allowedTypes: ["string"] as const,
  category: "standard" as const,
  impl: (options?: { messageFactory?: (context: MessageContext) => string; allowMilliseconds?: boolean }) => {
    const getErrorMessage = () => `must be a valid time format (HH:MM:SS)`;
    const messageFactory = options?.messageFactory || ((ctx: MessageContext) => 
      `${ctx.path} ${getErrorMessage()}`
    );

    return {
      check: (value: string) => {
        if (typeof value !== "string") return false;
        const regex = options?.allowMilliseconds === false ? TIME_NO_MS_REGEX : TIME_REGEX;
        return regex.test(value);
      },
      code: "FORMAT_TIME",
      getErrorMessage: (value: string, path: string) => {
        return messageFactory({ path, value, code: "FORMAT_TIME" });
      },
      params: [options],
    };
  },
});