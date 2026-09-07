// ===========================================================================
// L5  src/runtime/run-branch.ts — THE ONE BranchExecutor.
//
// L4 declares the port and never implements it; this is the only implementation
// in the library, and all it does is call runPlan. That is what makes "branch
// execution is the engine" a fact rather than an intention: a composite cannot
// reach a second traversal, because there is no second traversal to reach.
//
// A branch answers one question — did this plan hold for this value — and
// reports WHY through `causes`. The issues are collected in a private sink, so
// a branch that fails inside `oneOf` does not put its failure in the caller's
// result; only the composite's own issue is reported, and the branch issues
// hang off its detail.
//
// A branch with an EMPTY plan passes. That is not a special case: a composite
// declared with `branches: []` (additionalProperties in its boolean form)
// compiles to zero runners, and a branch with no fields and no rules compiles
// to a plan with no fields and no arrays. runPlan walks both to completion and
// the sink stays empty.
// ===========================================================================
import { PASS, fail } from "../types";
import type { RuleContext } from "../types";
import type { BranchExecutor } from "../compile/branch-executor.port";
import { IndexStack } from "./index-stack";
import { IssueSink } from "./issue-sink";
import type { AbortPolicy } from "./issue-sink";
import { createRecursionRunner } from "./run-recursion";
import { prefixIssuePaths, runPlan } from "./run-plan";

/**
 * A branch is a decision, not a report: the first failure already answers it,
 * so both aborts stay on. Collecting every issue of every alternative of a
 * `oneOf` would make the cost of the reduction the cost of validating the
 * whole schema once per branch.
 */
export const BRANCH_ABORT_POLICY: AbortPolicy = Object.freeze({
  abortEarly: true,
  abortEarlyOnEachField: true,
});

/**
 * Stateless and shareable: everything that varies lives in the call. L6 wires
 * one of these into compileSchema, and the same object serves every plan.
 */
export function createBranchExecutor(): BranchExecutor {
  return {
    runBranch(plan, value, ruleContext: RuleContext) {
      const sink = new IssueSink(BRANCH_ABORT_POLICY);
      runPlan(plan, value, {
        root: ruleContext.root,
        sink,
        indices: new IndexStack(),
        shouldApplyTransforms: false,
        runRecursion: createRecursionRunner({
          root: ruleContext.root,
          sink,
          external: ruleContext.external,
        }),
        item: ruleContext.item,
        external: ruleContext.external,
      });
      if (sink.count === 0) return PASS;
      const causes = prefixIssuePaths(ruleContext.path, sink.issues);
      return fail({ causes: Object.freeze(causes) });
    },
  };
}
