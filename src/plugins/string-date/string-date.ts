// ===========================================================================
// L7  src/plugins/string-date/string-date.ts
// `.date()` and the Draft-07 `date` format (RFC 3339 full-date).
//
// 1.x had TWO disagreeing date checks (the plugin's, and jsonSchema/
// format-validators.ts's `startsWith` round-trip). This is the only one left:
// zero-padded YYYY-MM-DD, a real calendar day, and a UTC round-trip that
// rejects anything the two earlier steps let through.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import type { MessageContextExtra } from "../../types";
import { isCalendarDate } from "./calendar-date";

const FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isIsoDate(value: string): boolean {
  const parts = FULL_DATE.exec(value);
  if (parts === null) return false;
  const [year, month, day] = [parts[1], parts[2], parts[3]];
  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }
  if (!isCalendarDate(Number(year), Number(month), Number(day))) return false;
  return new Date(`${value}T12:00:00Z`).toISOString().split("T")[0] === value;
}

export const stringDatePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "stringDate",
  method: "date",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || isIsoDate(value) ? PASS : fail({ actual: value }),
      describe: () => "Value must be a valid ISO 8601 date (YYYY-MM-DD)",
      buildMessageContext: () => ({}),
    }),
});
