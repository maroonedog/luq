// ===========================================================================
// L7  src/plugins/string-datetime/string-datetime.ts
// `.datetime(options?)` and the Draft-07 `date-time` format.
//
// 1.x had two readings of this format: the plugin accepted a numeric offset
// (+09:00) while jsonSchema/format-validators.ts accepted only "Z". The
// PLUGIN's reading wins and is now the only one: the offset is accepted, and
// `strict: true` is what makes a timezone mandatory.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import { isCalendarDate } from "./calendar-date";

const LENIENT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/i;
const STRICT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/i;

export interface DatetimeFormatOptions {
  /** true makes a timezone designator mandatory. */
  readonly strict?: boolean;
}

function hasRealComponents(parts: RegExpExecArray): boolean {
  const [year, month, day, hour, minute, second] = [
    parts[1],
    parts[2],
    parts[3],
    parts[4],
    parts[5],
    parts[6],
  ];
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    return false;
  }
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 60) {
    return false;
  }
  return isCalendarDate(Number(year), Number(month), Number(day));
}

function isIsoDatetime(value: string, pattern: RegExp): boolean {
  const parts = pattern.exec(value);
  if (parts === null) return false;
  if (!hasRealComponents(parts)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

export const stringDatetimePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [options?: DatetimeFormatOptions];
  out: Unchanged;
  context: { readonly strict: boolean };
}>()({
  name: "stringDatetime",
  method: "datetime",
  slots: ["string"] as const,
  build: (ctx, options) => {
    const strict = options?.strict === true;
    const pattern = strict ? STRICT : LENIENT;
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || isIsoDatetime(value, pattern)
          ? PASS
          : fail({ actual: value }),
      describe: () => "Value must be a valid ISO 8601 datetime",
      buildMessageContext: () => ({ strict }),
    });
  },
});
