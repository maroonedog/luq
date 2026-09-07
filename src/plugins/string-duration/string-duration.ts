// ===========================================================================
// L7  src/plugins/string-duration/string-duration.ts
// `.duration()` and the `duration` format.
//
// The 1.x plugin pattern is the one kept: a bare "P" is rejected, a "T" must
// be followed by a digit, fractional seconds are allowed and the week
// designator W stands beside Y/M/D. jsonSchema/format-validators.ts's rival
// pattern (no W at all) is gone.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import type { MessageContextExtra } from "../../types";

const ISO_DURATION =
  /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/;

export const stringDurationPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "stringDuration",
  method: "duration",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || ISO_DURATION.test(value)
          ? PASS
          : fail({ actual: value }),
      describe: () => "Value must be a valid ISO 8601 duration",
      buildMessageContext: () => ({}),
    }),
});
