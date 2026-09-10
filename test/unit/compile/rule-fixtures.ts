import { PASS, fail } from "../../../src/types";
import type {
  ArrayItemContext,
  CheckOutcome,
  IssueSeverity,
  RuleContext,
} from "../../../src/types";
import type {
  CheckRule,
  CompositeBranch,
  CompositeRule,
  ConditionalPresenceRule,
  GateRule,
  PresenceAllowance,
  PresenceRule,
  RecursiveRule,
  TransformRule,
} from "../../../src/plugin-kit/compiled-rule";
import type {
  CompiledCheck,
  PlanRef,
  ValidationPlan,
} from "../../../src/compile/validation-plan.types";
import type { CompositeEraser } from "../../../src/compile/compile-field";

export const EMPTY_PLAN: ValidationPlan = Object.freeze({
  fields: Object.freeze([]),
  arrays: Object.freeze([]),
  hasTransforms: false,
  hasDefaults: false,
  hasNormalizers: false,
});

export function planRefTo(plan: ValidationPlan): PlanRef {
  return { resolve: () => plan };
}

/** A PlanRef whose resolve() must not be called during compilation. */
export function unresolvablePlanRef(): PlanRef {
  return {
    resolve: () => {
      throw new Error("the plan was resolved at BUILD time");
    },
  };
}

export function refuseComposite(): CompositeEraser {
  return () => {
    throw new Error("eraseComposite was called with no composite declared");
  };
}

export function makeCheck(
  code: string,
  run: (value: unknown, ctx: RuleContext) => CheckOutcome = () => PASS,
  severity: IssueSeverity = "error"
): CheckRule {
  return {
    kind: "check",
    code,
    severity,
    run,
    describe: () => `${code} failed`,
  };
}

export function makeFailingCheck(code: string): CheckRule {
  return makeCheck(code, (value) => fail({ actual: value }));
}

export function makePresence(
  code: string,
  allowUndefined: boolean,
  allowNull: boolean,
  emptyStringIsMissing: boolean,
  severity: IssueSeverity = "error"
): PresenceRule {
  return {
    kind: "presence",
    code,
    severity,
    allowUndefined,
    allowNull,
    emptyStringIsMissing,
    describe: () => `${code} policy`,
  };
}

export const REJECTS_ABSENCE: PresenceAllowance = Object.freeze({
  allowUndefined: false,
  allowNull: false,
  emptyStringIsMissing: true,
});

export const ALLOWS_ABSENCE: PresenceAllowance = Object.freeze({
  allowUndefined: true,
  allowNull: true,
  emptyStringIsMissing: false,
});

/** Defaults to the requiredIf shape: demanding when true, silent when false. */
export function makeConditionalPresence(
  code: string,
  when: (root: unknown, arrayContext?: ArrayItemContext) => boolean,
  whenMet: PresenceAllowance | null = REJECTS_ABSENCE,
  whenUnmet: PresenceAllowance | null = null,
  severity: IssueSeverity = "error"
): ConditionalPresenceRule {
  return {
    kind: "conditionalPresence",
    code,
    severity,
    when,
    whenMet,
    whenUnmet,
    describe: () => `${code} policy`,
  };
}

export const requiredRule = (): PresenceRule =>
  makePresence("required", false, false, true);
export const optionalRule = (): PresenceRule =>
  makePresence("optional", true, false, false);
export const nullableRule = (): PresenceRule =>
  makePresence("nullable", false, true, false);

export function makeGate(
  code: string,
  shouldRun: (value: unknown, ctx: RuleContext) => boolean = () => true
): GateRule {
  return { kind: "gate", code, shouldRun };
}

export function makeTransform(
  apply: (value: unknown, ctx: RuleContext) => unknown = (value) => value
): TransformRule {
  return { kind: "transform", apply };
}

export function makeComposite(
  code: string,
  branches: readonly CompositeBranch[] = Object.freeze([])
): CompositeRule {
  return {
    kind: "composite",
    code,
    severity: "error",
    branches,
    combine: () => () => PASS,
    describe: () => `${code} failed`,
  };
}

export function makeRecursive(
  code: string,
  maxDepth = 10,
  target: RecursiveRule["target"] = "self"
): RecursiveRule {
  return {
    kind: "recursive",
    code,
    severity: "warning",
    target,
    maxDepth,
    describe: () => `${code} exceeded`,
  };
}

/** Erases a composite to a check that records nothing but its own identity. */
export function eraseCompositeToCheck(rule: CompositeRule): CompiledCheck {
  return {
    code: rule.code,
    severity: rule.severity,
    run: () => PASS,
    describe: (detail, ctx) => rule.describe(detail, ctx),
  };
}
