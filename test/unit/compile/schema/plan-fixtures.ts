// ===========================================================================
// A minimal BranchExecutor stand-in for the L4 tests.
//
// L5 does not exist yet, and compile/ must never import it anyway. What these
// tests need from an executor is only that it be OBSERVABLE: which plan object
// it was handed, how often, and whether the plan it received actually carries
// the branch's compiled fields. So this walks a plan's fields and array nodes
// and stops at the first failing check. It is a test double, not a preview of
// runPlan: it has no presence handling, no transforms and no issue paths.
// ===========================================================================
import { PASS, isArray } from "../../../../src/types";
import type { CheckOutcome, RuleContext } from "../../../../src/types";
import type { BranchExecutor } from "../../../../src/compile/branch-executor.port";
import type {
  ArrayNode,
  ValidationPlan,
} from "../../../../src/compile/validation-plan.types";
import type {
  CompositeBranch,
  Rule,
} from "../../../../src/plugin-kit/compiled-rule";

export interface ExecutorProbe {
  readonly executor: BranchExecutor;
  /** Every plan object handed to runBranch, in call order. */
  readonly plansSeen: ValidationPlan[];
}

export const ROOT_CONTEXT: RuleContext = { root: {}, path: "" };

export function createRecordingExecutor(): ExecutorProbe {
  const plansSeen: ValidationPlan[] = [];
  const executor: BranchExecutor = {
    runBranch(plan, value, ruleContext) {
      plansSeen.push(plan);
      return runFields(plan, value, ruleContext);
    },
  };
  return { executor, plansSeen };
}

/** An executor that must never be reached; compilation runs no branch. */
export function createRefusingExecutor(): BranchExecutor {
  return {
    runBranch() {
      throw new Error("a branch was executed at BUILD time");
    },
  };
}

function runFields(
  plan: ValidationPlan,
  value: unknown,
  ruleContext: RuleContext
): CheckOutcome {
  for (const field of plan.fields) {
    const read = field.read(value);
    for (const check of field.checks) {
      const outcome = check.run(read, ruleContext);
      if (!outcome.ok) return outcome;
    }
  }
  for (const node of plan.arrays) {
    const outcome = runArrayNode(node, value, ruleContext);
    if (!outcome.ok) return outcome;
  }
  return PASS;
}

function runArrayNode(
  node: ArrayNode,
  value: unknown,
  ruleContext: RuleContext
): CheckOutcome {
  const array = node.read(value);
  if (!isArray(array)) return PASS;
  for (const element of array) {
    const outcome = runFields(asPlan(node), element, ruleContext);
    if (!outcome.ok) return outcome;
  }
  return PASS;
}

function asPlan(node: ArrayNode): ValidationPlan {
  return {
    fields: node.elementFields,
    arrays: node.nested,
    hasTransforms: false,
    hasDefaults: false,
  };
}

export function branchOf(
  label: string,
  rules: readonly Rule[] = [],
  fields: CompositeBranch["fields"] = []
): CompositeBranch {
  return { label, rules, fields };
}
