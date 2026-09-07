// ===========================================================================
// L7  src/plugins/compare-field/compare-field.ts
// The MIXED marker tuple: a FieldRef followed by a plain argument. The call
// site therefore gets `FieldPath<TRoot> & string` for the path and the plain
// comparison function verbatim, and build() sees a real string it can compile
// into a reader ONCE.
//
// Legacy (docs/legacy-spec/plugin-catalog-relational.md) read the other field
// with a hand-rolled dotted-path accessor and failed the whole rule when
// `allValues` was missing. Here the root is always present in RuleContext, so
// that branch does not exist, and the path is parsed by the ONE L1 parser.
// ===========================================================================
import { PASS, fail } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import { createValueReader, parseFieldPath } from "../../path/index";
import type { FieldRef, Unchanged } from "../../plugin-kit/marker.types";

/** The plain second argument. Both sides arrive unnarrowed, as 1.x's did. */
export type CompareFieldValues = (
  value: unknown,
  targetValue: unknown
) => boolean;

/** 1.x's messageFactory context for this plugin, member for member. */
export interface CompareFieldExtra {
  readonly fieldPath: string;
  readonly targetValue: unknown;
}

const COMPARE_FIELD_SLOTS = [
  "string",
  "number",
  "boolean",
  "date",
  "object",
  "array",
  "tuple",
  "union",
] as const;

function equalsStrictly(value: unknown, targetValue: unknown): boolean {
  return value === targetValue;
}

export const compareFieldPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [other: FieldRef, compare?: CompareFieldValues];
  out: Unchanged;
  context: CompareFieldExtra;
}>()({
  name: "compareField",
  method: "compareField",
  slots: COMPARE_FIELD_SLOTS,
  build: (ctx, other, compare) => {
    const readTarget = createValueReader(parseFieldPath(other));
    const compares = compare ?? equalsStrictly;
    return check<CompareFieldExtra>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value, runCtx) => {
        const targetValue = readTarget(runCtx.root);
        return compares(value, targetValue)
          ? PASS
          : fail({ expected: targetValue, actual: value });
      },
      describe: () => `Value must be equal to ${other}`,
      buildMessageContext: (detail) => ({
        fieldPath: other,
        targetValue: detail.expected,
      }),
    });
  },
});
