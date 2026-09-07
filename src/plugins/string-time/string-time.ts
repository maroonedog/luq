// ===========================================================================
// L7  src/plugins/string-time/string-time.ts
// `.time(options?)` and the Draft-07 `time` format.
//
// Milliseconds are allowed BY DEFAULT; only an explicit
// `allowMilliseconds: false` selects the strict pattern (undefined does not).
// Seconds are mandatory and no timezone offset is accepted — 1.x exactly.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";

const WITH_MILLISECONDS =
  /^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.[0-9]{1,3})?$/;
const WITHOUT_MILLISECONDS = /^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/;

export interface TimeFormatOptions {
  /** Only an explicit false forbids a fractional part. */
  readonly allowMilliseconds?: boolean;
}

export const stringTimePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [options?: TimeFormatOptions];
  out: Unchanged;
  context: { readonly allowMilliseconds: boolean };
}>()({
  name: "stringTime",
  method: "time",
  slots: ["string"] as const,
  build: (ctx, options) => {
    const millisecondsAllowed = options?.allowMilliseconds !== false;
    const pattern = millisecondsAllowed
      ? WITH_MILLISECONDS
      : WITHOUT_MILLISECONDS;
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || pattern.test(value)
          ? PASS
          : fail({ actual: value }),
      describe: () => "Value must be a valid time format (HH:MM:SS)",
      buildMessageContext: () => ({ allowMilliseconds: millisecondsAllowed }),
    });
  },
});
