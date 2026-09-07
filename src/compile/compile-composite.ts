// ===========================================================================
// L4  src/compile/compile-composite.ts — COMPOSITE ERASURE.
//
// A CompositeRule is the only rule kind that owns other rules. It is erased
// here into a plain CompiledCheck, so the six-member Rule union collapses to
// four things the runtime can see (presence, gate, check, transform) plus
// recursion, and no rule kind other than "check" ever reaches L5.
//
// The reduction — all-apply, positional, existential, scatter, routing — is
// the plugin's, expressed once by `combine`. Compilation is the core's. So:
//   * every branch is compiled to a nested plan HERE, at build time;
//   * each plan is wrapped as a BranchRunner over the injected BranchExecutor,
//     which is L5's runPlan reached through a port rather than an import;
//   * `combine` is called EXACTLY ONCE and its result is stored by identity.
// Calling combine per validation would rebuild the reduction on the hot path,
// which is the mistake the legacy array batch made.
// ===========================================================================
import type {
  BranchRunner,
  CompositeBranch,
  CompositeRule,
} from "../plugin-kit/compiled-rule";
import type { BranchExecutor } from "./branch-executor.port";
import type { CompiledCheck, ValidationPlan } from "./validation-plan.types";

/**
 * Compiles one branch to a nested plan. Supplied by compileSchema, which owns
 * plan assembly; injecting it is what keeps compile-composite and
 * compile-schema from importing each other.
 */
export type BranchPlanCompiler = (branch: CompositeBranch) => ValidationPlan;

export interface CompositeCompileContext {
  readonly executor: BranchExecutor;
  readonly compileBranchPlan: BranchPlanCompiler;
}

/**
 * `runners[i]` corresponds to `branches[i]`: tupleBuilder addresses branch i by
 * position, so the array must not be reordered or filtered.
 */
export function compileComposite(
  rule: CompositeRule,
  context: CompositeCompileContext
): CompiledCheck {
  const runners = rule.branches.map((branch) =>
    compileBranchRunner(branch, context)
  );
  const execute = rule.combine(Object.freeze(runners));
  const check: CompiledCheck = {
    code: rule.code,
    severity: rule.severity,
    // Stored by identity: what combine returned IS the check's run.
    run: execute,
    // Wrapped, not aliased, so a `describe` written as an object method keeps
    // its receiver.
    describe: (detail, messageContext) => rule.describe(detail, messageContext),
  };
  return Object.freeze(check);
}

function compileBranchRunner(
  branch: CompositeBranch,
  context: CompositeCompileContext
): BranchRunner {
  const plan = context.compileBranchPlan(branch);
  const { executor } = context;
  const runner: BranchRunner = {
    label: branch.label,
    run: (value, ruleContext) => executor.runBranch(plan, value, ruleContext),
  };
  return Object.freeze(runner);
}
