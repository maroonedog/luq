// ===========================================================================
// L8  src/json-schema/compose-keyword.ts — allOf / anyOf / oneOf / not.
//
// FOUR KEYWORDS, ONE RULE KIND. Each is a CompositeRule built from
// src/plugin-kit/create-rule.ts and nothing else: the four differ only in the
// `combine` they hand the engine, which is called ONCE at build time and
// returns the finished reduction. There is no schema evaluator here — a branch
// is a nested ValidationPlan run by the one engine — which is what retires
// 1.x's private `validateValueAgainstSchema`, a second, disagreeing Draft-07
// implementation that `chain.custom()` reached for allOf/anyOf/oneOf.
//
// A branch carries its sub-schema's own rules AND its `properties` as relative
// FIELDS (CompositeBranch.fields), so `anyOf: [{ properties: { a: ... } }]`
// really constrains `a` instead of being dropped the way 1.x dropped it.
// ===========================================================================
import { composite } from "../plugin-kit/create-rule";
import type {
  BranchRunner,
  CompositeBranch,
  Rule,
} from "../plugin-kit/compiled-rule";
import { PASS, fail } from "../types";
import type { CheckOutcome, RuleContext, ValidationIssue } from "../types";
import type { Draft07Schema, Draft07SchemaObject } from "./draft07.types";
import type { StructuralContext } from "./structural-expansion.types";

const NO_RULES: readonly Rule[] = Object.freeze([]);
const NO_CAUSES: readonly ValidationIssue[] = Object.freeze([]);

/** Every issue the failing branches reported, in branch order. */
function collectCauses(
  outcomes: readonly CheckOutcome[]
): readonly ValidationIssue[] {
  const causes: ValidationIssue[] = [];
  for (const outcome of outcomes) {
    if (outcome.ok) continue;
    for (const cause of outcome.detail.causes ?? NO_CAUSES) causes.push(cause);
  }
  return Object.freeze(causes);
}

/** `allOf`: every sub-schema holds. The first refusal names the arm. */
function combineAllOf(
  runners: readonly BranchRunner[]
): (value: unknown, ctx: RuleContext) => CheckOutcome {
  return (value, ctx) => {
    for (const runner of runners) {
      const outcome = runner.run(value, ctx);
      if (!outcome.ok) {
        return fail({ ...outcome.detail, branch: runner.label });
      }
    }
    return PASS;
  };
}

/** `anyOf`: at least one holds. Every arm's issues explain the refusal. */
function combineAnyOf(
  runners: readonly BranchRunner[]
): (value: unknown, ctx: RuleContext) => CheckOutcome {
  return (value, ctx) => {
    for (const runner of runners) {
      if (runner.run(value, ctx).ok) return PASS;
    }
    const outcomes = runners.map((runner) => runner.run(value, ctx));
    return fail({
      expected: runners.length,
      actual: 0,
      causes: collectCauses(outcomes),
    });
  };
}

/** `oneOf`: exactly one holds. Both "none" and "several" are refusals. */
function combineOneOf(
  runners: readonly BranchRunner[]
): (value: unknown, ctx: RuleContext) => CheckOutcome {
  return (value, ctx) => {
    const outcomes = runners.map((runner) => runner.run(value, ctx));
    const accepted = outcomes.filter((outcome) => outcome.ok).length;
    if (accepted === 1) return PASS;
    return fail({
      expected: 1,
      actual: accepted,
      causes: accepted === 0 ? collectCauses(outcomes) : NO_CAUSES,
    });
  };
}

/** `not`: the single arm must NOT hold. */
function combineNot(
  runners: readonly BranchRunner[]
): (value: unknown, ctx: RuleContext) => CheckOutcome {
  const negated = runners[0];
  return (value, ctx) => {
    if (negated === undefined) return PASS;
    return negated.run(value, ctx).ok ? fail({ actual: value }) : PASS;
  };
}

type Combine = (
  runners: readonly BranchRunner[]
) => (value: unknown, ctx: RuleContext) => CheckOutcome;

function composeBranches(
  code: string,
  branches: readonly CompositeBranch[],
  combine: Combine,
  describe: string,
  context: StructuralContext
): readonly Rule[] {
  if (branches.length === 0) return NO_RULES;
  return Object.freeze([
    composite({
      code,
      severity: context.build.config.defaultSeverity,
      branches,
      combine,
      describe: () => describe,
      buildMessageContext: () => ({}),
    }),
  ]);
}

function toBranches(
  keyword: string,
  schemas: readonly Draft07Schema[],
  context: StructuralContext
): readonly CompositeBranch[] {
  return schemas.map((member, index) =>
    context.toBranch(`${keyword}:${String(index)}`, member)
  );
}

export function composeAllOf(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const members = schema.allOf;
  if (members === undefined) return NO_RULES;
  return composeBranches(
    "allOf",
    toBranches("allOf", members, context),
    combineAllOf,
    "Value must match every schema in allOf",
    context
  );
}

export function composeAnyOf(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const members = schema.anyOf;
  if (members === undefined) return NO_RULES;
  return composeBranches(
    "anyOf",
    toBranches("anyOf", members, context),
    combineAnyOf,
    "Value must match at least one schema in anyOf",
    context
  );
}

export function composeOneOf(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const members = schema.oneOf;
  if (members === undefined) return NO_RULES;
  return composeBranches(
    "oneOf",
    toBranches("oneOf", members, context),
    combineOneOf,
    "Value must match exactly one schema in oneOf",
    context
  );
}

export function composeNot(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const negated = schema.not;
  if (negated === undefined) return NO_RULES;
  return composeBranches(
    "not",
    [context.toBranch("not", negated)],
    combineNot,
    "Value must not match the schema in not",
    context
  );
}
