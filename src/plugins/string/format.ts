// ===========================================================================
// L7  src/plugins/string/format.ts
// Marker-free by design: every argument is plain data, so IsMarkerFree<args>
// is true and the Draft-07 keyword table can bind to it. The method name is
// the legacy public surface (docs/legacy-public-surface.md): arrayMinLength's
// method really is `minLength`, NOT `minItems`. The keyword table is where
// `minItems -> minLength` is written down, and that binding is type-checked,
// so the legacy silent duck-typing cannot come back.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";

/**
 * A format check is supplied by the caller, not hard-coded here. The legacy
 * implementation carried three separate, disagreeing format tables; this
 * plugin owns none of them and reads one registry passed at build time.
 */
export type FormatChecker = (value: string) => boolean;

export const stringFormatPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [
    format: string,
    checkers?: Readonly<Record<string, FormatChecker>>,
  ];
  out: Unchanged;
  context: { format: string };
}>()({
  name: "stringFormat",
  method: "format",
  slots: ["string"] as const,
  build: (ctx, format, checkers) => {
    const checker = checkers?.[format];
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || checker === undefined || checker(value)
          ? PASS
          : fail({ expected: format, actual: value }),
      describe: () => `String must be a valid ${format}`,
      buildMessageContext: () => ({ format }),
    });
  },
});
