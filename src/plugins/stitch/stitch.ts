// ===========================================================================
// L7  src/plugins/stitch/stitch.ts — THE ONE stitch.
// 1.x shipped three implementations of this responsibility (stitch.ts,
// stitch-typed.ts, stitchSimple.ts), all three claiming methodName "stitch".
// This is their single successor: the positional shape of stitch.ts
// (fields, check, options) with stitchSimple's untyped call still accepted,
// because the declared paths are the only thing the type system needs to see.
//
// Two 1.x defects are NOT carried over:
//   - the check function was run a SECOND time to build the message; here the
//     outcome's message travels in the IssueDetail, so a user function with a
//     cost or a side effect runs exactly once;
//   - "no allValues -> fail" is gone: RuleContext.root is always present.
// ===========================================================================
import { PASS, fail, isPlainObject, isString } from "../../types";
import type { CrossFieldOutcome } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import { createValueReader, parseFieldPath } from "../../path/index";
import type { ValueReader } from "../../path/index";
import type { PickPaths } from "../../path/index";
import type { FieldRefs, StitchOut } from "../../plugin-kit/marker.types";

/**
 * The bundle handed to the check at RUN TIME, keyed by the path exactly as
 * declared.
 *
 * 呼び出し側がこれを見ることはもう無い。`.stitch(["price"], ...)` と書いた
 * 時点でパスの集合は分かっているので、述語が受け取る束の型は
 * `PickPaths<TRoot, F>` として組まれる (src/chain/chain-method.types.ts の
 * StitchOut の腕)。この型が残っているのは、実行時に集める側が「キーは
 * パス文字列」という事実を書き留めておく場所だからである。
 */
export type StitchFieldValues = Readonly<Record<string, unknown>>;

/**
 * PickPaths applied to a declared tuple: `StitchFieldsOf<Order, ["price",
 * "quantity"]>` is `{ readonly price: number; readonly quantity: number }`.
 * The chain method is not generic over its own arguments (the plugin contract
 * frozen at step 7 gives every non-transform plugin the same shape), so this
 * type is what a call site narrows the bundle TO with its own guard, which is
 * the same alternative-2 move readExternalContext makes for async context.
 */
export type StitchFieldsOf<
  TRoot,
  TFields extends readonly string[],
> = PickPaths<TRoot, TFields>;

/**
 * 1.x の `{ valid, message? }`、名前も形もそのまま。実体は src/types の
 * CrossFieldOutcome で、チェーン層が呼び出し側の型を組むのに参照する —
 * L3 から L7 を import しないための置き場である。
 */
export type StitchOutcome = CrossFieldOutcome;

/**
 * 実行時に build() が受け取る形。**呼び出し側が見る型ではない。**
 *
 * `.stitch(["price", "quantity"], ...)` と書いた時点でパスの集合は分かって
 * いるので、述語が受け取る束は `PickPaths<TRoot, F>` として組まれ、キーごとに
 * 値の型が付く (src/chain/chain-method.types.ts の StitchOut の腕)。
 * ここが `Record<string, unknown>` のままだったのが、その腕を足すまでの
 * stitch である。
 */
export type StitchCheck = (
  fieldValues: StitchFieldValues,
  value: unknown,
  root: unknown
) => StitchOutcome;

/** 1.x's messageFactory context for this plugin, minus the re-run. */
export interface StitchExtra {
  readonly fields: readonly string[];
  readonly fieldValues: StitchFieldValues;
  readonly message?: string;
}

interface DeclaredField {
  readonly path: string;
  readonly read: ValueReader;
}

const STITCH_SLOTS = [
  "string",
  "number",
  "boolean",
  "date",
  "object",
  "array",
  "tuple",
  "union",
] as const;

const NO_FIELD_VALUES: StitchFieldValues = Object.freeze({});

function collectFieldValues(
  declared: readonly DeclaredField[],
  root: unknown
): StitchFieldValues {
  const collected: Record<string, unknown> = {};
  for (const field of declared) collected[field.path] = field.read(root);
  return collected;
}

export const stitchPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [fields: FieldRefs, check: StitchCheck];
  out: StitchOut;
  context: StitchExtra;
}>()({
  name: "stitch",
  method: "stitch",
  slots: STITCH_SLOTS,
  build: (ctx, fields, runCheck) => {
    const declared: readonly DeclaredField[] = fields.map((path) => ({
      path,
      read: createValueReader(parseFieldPath(path)),
    }));
    const declaredPaths: readonly string[] = declared.map(
      (field) => field.path
    );
    return check<StitchExtra>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value, runCtx) => {
        const fieldValues = collectFieldValues(declared, runCtx.root);
        const outcome = runCheck(fieldValues, value, runCtx.root);
        return outcome.valid
          ? PASS
          : fail({ expected: fieldValues, actual: outcome.message });
      },
      describe: (detail, msgCtx) =>
        isString(detail.actual)
          ? detail.actual
          : `Cross-field validation failed for ${msgCtx.path}`,
      buildMessageContext: (detail) => ({
        fields: declaredPaths,
        fieldValues: isPlainObject(detail.expected)
          ? detail.expected
          : NO_FIELD_VALUES,
        message: isString(detail.actual) ? detail.actual : undefined,
      }),
    });
  },
});
