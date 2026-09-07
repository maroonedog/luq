// ===========================================================================
// L7  src/plugins/tuple-builder/tuple-builder.ts
// `b.tuple.builder([position0, position1, ...], rest?)`.
//
// Legacy semantics (docs/legacy-spec/plugin-catalog-structural.md#tupleBuilderPlugin):
// positional element schemas, an optional rest schema reused for every surplus
// element, exact length without a rest, at-least length with one, and per
// element the failure carries that element's index.
//
// LEGACY BUG FIXED, and it is the whole plugin: legacy's tupleBuilder threw
// `TypeError: Cannot read properties of undefined (reading 'addValidator')`
// during build(), through the composable-directly mechanism that reached for a
// `builder._executionPlan` nobody set. Tuple validation therefore never ran a
// single line. It needs no separate mechanism here: positions are BRANCHES of
// an ordinary composite, and the engine compiles them like any other branch.
//
// CONTRADICTION A-15: `positions` is an ARRAY of ElementChain markers, so both
// marker resolvers must descend into the array and resolve each element.
//
// `b.tuple` gets no injected type guard (docs/legacy-spec/plugin-contract.md),
// which is why this plugin — alone among the collection plugins — rejects a
// non-array instead of passing it through.
// ===========================================================================
import { definePlugin } from "../../plugin-kit/plugin-definition";
import { branch, composite } from "../../plugin-kit/create-rule";
import { fail, isArray, isNumber, PASS } from "../../types";
import type { CheckOutcome, RuleContext } from "../../types";
import type {
  BranchRunner,
  CompositeBranch,
} from "../../plugin-kit/compiled-rule";
import type { ElementChain, Unchanged } from "../../plugin-kit/marker.types";

/** Which of the four failures happened. Legacy spelled these as four codes. */
export type TupleFailure =
  | "notArray"
  | "lengthMismatch"
  | "tooShort"
  | "element";

export interface TupleBuilderContext {
  readonly failure: TupleFailure;
  readonly positionCount: number;
  readonly index: number;
  readonly actualLength: number;
}

function checkLength(
  value: readonly unknown[],
  positionCount: number,
  hasRest: boolean
): CheckOutcome {
  if (!hasRest && value.length !== positionCount) {
    return fail({
      branch: "lengthMismatch",
      expected: positionCount,
      actual: value.length,
    });
  }
  if (hasRest && value.length < positionCount) {
    return fail({
      branch: "tooShort",
      expected: positionCount,
      actual: value.length,
    });
  }
  return PASS;
}

/**
 * Branch i is position i; the branch after the last position, when there is
 * one, is the rest schema and every surplus element runs through it.
 */
function applyPositionally(
  runners: readonly BranchRunner[],
  positionCount: number,
  hasRest: boolean
): (value: unknown, ctx: RuleContext) => CheckOutcome {
  return (value, ctx) => {
    if (!isArray(value)) {
      return fail({ branch: "notArray", expected: "array", actual: value });
    }
    const lengthOutcome = checkLength(value, positionCount, hasRest);
    if (!lengthOutcome.ok) return lengthOutcome;
    for (let index = 0; index < value.length; index += 1) {
      const runner =
        index < positionCount ? runners[index] : runners[positionCount];
      if (runner === undefined) continue;
      const outcome = runner.run(value[index], ctx);
      if (!outcome.ok) {
        return fail({
          ...outcome.detail,
          index,
          branch: "element",
          actual: value.length,
        });
      }
    }
    return PASS;
  };
}

function readFailure(branchLabel: string | undefined): TupleFailure {
  if (branchLabel === "notArray") return "notArray";
  if (branchLabel === "lengthMismatch") return "lengthMismatch";
  if (branchLabel === "tooShort") return "tooShort";
  return "element";
}

function describeFailure(
  failure: TupleFailure,
  positionCount: number,
  actualLength: number,
  index: number
): string {
  if (failure === "notArray") return "Value must be an array";
  if (failure === "lengthMismatch") {
    return `Tuple must have exactly ${String(positionCount)} elements, got ${String(actualLength)}`;
  }
  if (failure === "tooShort") {
    return `Tuple must have at least ${String(positionCount)} elements, got ${String(actualLength)}`;
  }
  return `Validation failed for element ${String(index)}`;
}

/**
 * WHICH argument positions carry a sub-chain cannot be recovered from a
 * plugin's type at run time — a NarrowedChain and a RootPredicate are both
 * plain functions once erased — so src/chain/collect-branch-rules.ts reads it
 * from this declared field. definePlugin's spec does not carry it yet (see
 * needsFromOthers), which is why it is spread on rather than passed in.
 */
export const tupleBuilderPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [positions: readonly ElementChain[], rest?: ElementChain];
  out: Unchanged;
  context: TupleBuilderContext;
}>()({
  name: "tupleBuilder",
  method: "builder",
  slots: ["tuple"] as const,
  build: (ctx, positions, rest) => {
    const branches: CompositeBranch[] = positions.map((rules, index) =>
      branch(`position:${String(index)}`, rules)
    );
    if (rest !== undefined) branches.push(branch("rest", rest));
    const positionCount = positions.length;
    return composite<TupleBuilderContext>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches,
      combine: (runners) =>
        applyPositionally(runners, positionCount, rest !== undefined),
      describe: (detail) =>
        describeFailure(
          readFailure(detail.branch),
          positionCount,
          isNumber(detail.actual) ? detail.actual : -1,
          detail.index ?? -1
        ),
      buildMessageContext: (detail) => ({
        failure: readFailure(detail.branch),
        positionCount,
        index: detail.index ?? -1,
        actualLength: isNumber(detail.actual) ? detail.actual : -1,
      }),
    });
  },
  subChainArguments: [0, 1],
});
