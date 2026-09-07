// ===========================================================================
// L7  src/plugins/literal/literal.ts — strict equality against one constant.
//
// MARKER-FREE on purpose: its declared argument tuple is its runtime tuple, so
// IsMarkerFree is true and the Draft-07 `const` keyword can bind to it.
//
// The one deviation from `===` is legacy's, and is carried over: an expected
// value of NaN matches any NaN, because `NaN === NaN` is false and a schema
// that asks for NaN otherwise could never be satisfied.
// ===========================================================================
import { PASS, fail, isNumber, type TypeName } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
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

function isExpectedNaN(expected: unknown): boolean {
  return isNumber(expected) && Number.isNaN(expected);
}

function matchesLiteral(value: unknown, expected: unknown): boolean {
  if (isExpectedNaN(expected)) return isNumber(value) && Number.isNaN(value);
  return value === expected;
}

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
        matchesLiteral(value, expected)
          ? PASS
          : fail({ expected, actual: value }),
      describe: () => `Value must be ${formatLiteral(expected)}`,
      buildMessageContext: () => ({ expected }),
    }),
});
