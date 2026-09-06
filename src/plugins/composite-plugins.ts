import { definePlugin } from "../plugin-kit/plugin-definition";
import { branch, composite, recursive } from "../plugin-kit/create-rule";
import { fail, isArray, isNumber, PASS } from "../types";
import type { CheckOutcome, MessageContextExtra, RuleContext } from "../types";
import type {
  BranchRunner,
  CompositeBranch,
} from "../plugin-kit/compiled-rule";
import type {
  ElementChain,
  GuardOut,
  NarrowedChain,
  SelfGuard,
  Unchanged,
} from "../plugin-kit/marker.types";
import type { SelfGuardFn } from "../plugin-kit/runtime-args.types";

function countMatchingElements(
  runners: readonly BranchRunner[],
  min: number,
  max: number
): (value: unknown, ctx: RuleContext) => CheckOutcome {
  const matcher = runners[0];
  return (value, ctx) => {
    if (matcher === undefined) return PASS;
    if (!isArray(value))
      return fail({ expected: "array", actual: typeof value });
    let matched = 0;
    for (const element of value) {
      if (matcher.run(element, ctx).ok) matched += 1;
      if (matched > max) break;
    }
    return matched < min || matched > max
      ? fail({ expected: min, actual: matched, branch: matcher.label })
      : PASS;
  };
}

/** ElementChain: the chain has ALREADY run the sub-chain callback exactly once. */
export const arrayContainsPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [
    element: ElementChain,
    bounds?: { readonly min?: number; readonly max?: number },
  ];
  out: Unchanged;
  context: { matched: number; min: number; max: number };
}>()({
  name: "arrayContains",
  method: "contains",
  slots: ["array", "tuple"] as const,
  build: (ctx, element, bounds) => {
    const min = bounds?.min ?? 1;
    const max = bounds?.max ?? Number.POSITIVE_INFINITY;
    return composite({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches: [branch("contains", element)],
      combine: (runners) => countMatchingElements(runners, min, max),
      describe: (detail) =>
        `Array must contain at least ${String(detail.expected)} matching element(s), found ${String(detail.actual)}`,
      buildMessageContext: (detail) => ({
        matched: isNumber(detail.actual) ? detail.actual : 0,
        min,
        max,
      }),
    });
  },
});

function runGuardedBranch(
  runners: readonly BranchRunner[],
  condition: SelfGuardFn
): (value: unknown, ctx: RuleContext) => CheckOutcome {
  const guarded = runners[0];
  return (value, ctx) => {
    if (guarded === undefined || !condition(value)) return PASS;
    return guarded.run(value, ctx);
  };
}

/** union guard: the chain SYNTHESISES this method from `out: GuardOut`. */
export const unionGuardPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [condition: SelfGuard, define: NarrowedChain];
  out: GuardOut;
  context: MessageContextExtra;
}>()({
  name: "unionGuard",
  method: "guard",
  slots: ["union"] as const,
  build: (ctx, condition, define) =>
    composite({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches: [branch("guard", define)],
      combine: (runners) => runGuardedBranch(runners, condition),
      describe: () => "Value does not satisfy the guarded branch",
      buildMessageContext: () => ({}),
    }),
});

function takenBranch(label: string | undefined): "then" | "else" | "none" {
  if (label === "then") return "then";
  if (label === "else") return "else";
  return "none";
}

function routeConditional(
  runners: readonly BranchRunner[],
  thenIndex: number,
  elseIndex: number
): (value: unknown, ctx: RuleContext) => CheckOutcome {
  const condition = runners[0];
  return (value, ctx) => {
    if (condition === undefined) return PASS;
    const taken = condition.run(value, ctx).ok ? thenIndex : elseIndex;
    if (taken < 0) return PASS;
    const runner = runners[taken];
    return runner === undefined ? PASS : runner.run(value, ctx);
  };
}

/**
 * VERBATIM from the confirmed design's Appendix B. It DECLARES fine, but is
 * uncallable on its own object/string/number/boolean slots: see
 * test/probe-elementchain.ts. Kept under a different symbol so the defect
 * stays visible; the usable form lives in ./conditional-schema.ts.
 */
export const conditionalSchemaAsDesignedPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [
    condition: ElementChain,
    then?: ElementChain,
    otherwise?: ElementChain,
  ];
  out: Unchanged;
  context: { taken: "then" | "else" | "none" };
}>()({
  name: "conditionalSchema",
  method: "conditionalSchema",
  slots: ["object", "array", "string", "number", "boolean"] as const,
  build: (ctx, condition, then, otherwise) => {
    const branches: CompositeBranch[] = [branch("if", condition)];
    const thenIndex =
      then === undefined ? -1 : branches.push(branch("then", then)) - 1;
    const elseIndex =
      otherwise === undefined
        ? -1
        : branches.push(branch("else", otherwise)) - 1;
    return composite({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches,
      combine: (runners) => routeConditional(runners, thenIndex, elseIndex),
      describe: (detail) =>
        `Value must match the "${detail.branch ?? "then"}" schema`,
      buildMessageContext: (detail) => ({ taken: takenBranch(detail.branch) }),
    });
  },
});

/** recursion: pure declaration, ZERO execution logic in the plugin. */
export const objectRecursivelyPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [
    target: "self" | "element",
    options?: { readonly maxDepth?: number },
  ];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "objectRecursively",
  method: "recursively",
  slots: ["object", "array"] as const,
  build: (ctx, target, options) =>
    recursive({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      target,
      maxDepth: options?.maxDepth ?? 10,
      describe: (detail) =>
        `Recursive validation stopped at the maximum depth of ${String(detail.expected)}`,
      buildMessageContext: () => ({}),
    }),
});
