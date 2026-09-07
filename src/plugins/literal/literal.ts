// ===========================================================================
// L7  src/plugins/literal/literal.ts — equality against one constant.
//
// MARKER-FREE on purpose: its declared argument tuple is its runtime tuple, so
// IsMarkerFree is true and the Draft-07 `const` keyword can bind to it.
//
// EQUALITY IS STRUCTURAL, from src/plugin-kit/is-json-value-equal.ts. `===`
// would mean `.literal({a:1})` and `const: {"a":1}` could never match a value
// that came out of JSON.parse — measured on the official Draft-07 suite, that
// and the same defect in `oneOf` cost 17 of 929 cases. Legacy's one documented
// deviation from `===` is preserved by construction: SameValueZero at the
// leaves makes an expected NaN match any NaN, so a schema asking for NaN is
// still satisfiable.
// ===========================================================================
import { PASS, fail, type TypeName } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import { isJsonValueEqual } from "../../plugin-kit/is-json-value-equal";
import type { Unchanged } from "../../plugin-kit/marker.types";

export interface LiteralExtra {
  readonly expected: unknown;
}

const LITERAL_SLOTS: readonly TypeName[] = [
  "string",
  "number",
  "boolean",
  "date",
  "array",
  "tuple",
  "object",
  "union",
  "any",
];

/** Legacy rendering: strings are quoted, everything else is String()-ed. */
function formatLiteral(expected: unknown): string {
  return typeof expected === "string"
    ? JSON.stringify(expected)
    : String(expected);
}

export const literalPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [expected: unknown];
  out: Unchanged;
  context: LiteralExtra;
}>()({
  name: "literal",
  method: "literal",
  slots: LITERAL_SLOTS,
  build: (ctx, expected) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        isJsonValueEqual(value, expected)
          ? PASS
          : fail({ expected, actual: value }),
      describe: () => `Value must be ${formatLiteral(expected)}`,
      buildMessageContext: () => ({ expected }),
    }),
});
