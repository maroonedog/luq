// ===========================================================================
// L4  src/compile/resolve-conditional-presence.ts
// Every ConditionalPresenceRule on a field, turned into finished policies at
// BUILD time. One entry per rule, in declaration order.
//
// resolve-presence merges the unconditional rules into a single policy because
// it can: their answer never changes. A conditional rule's answer does, so it
// cannot be merged — but everything ABOUT it that does not depend on the root
// still can be. So both sides of the predicate become complete PresencePolicy
// objects here, and the run time is left with one call and one reference: it
// picks, it does not assemble.
//
// A side left null is a rule declining to have an opinion. `.requiredIf(cond)`
// says nothing at all while `cond` is false, which is exactly what keeps
// `.required().requiredIf(cond)` rejecting a missing value in that case.
// ===========================================================================
import type {
  ConditionalPresenceRule,
  PresenceAllowance,
} from "../plugin-kit/compiled-rule";
import type {
  ConditionalPresence,
  PresencePolicy,
} from "./validation-plan.types";

/** Shared and frozen: a field with no conditional rule allocates nothing. */
export const NO_PRESENCE_OVERRIDES: readonly ConditionalPresence[] =
  Object.freeze([]);

export function resolveConditionalPresence(
  rules: readonly ConditionalPresenceRule[]
): readonly ConditionalPresence[] {
  if (rules.length === 0) return NO_PRESENCE_OVERRIDES;
  return Object.freeze(rules.map(compileOneOverride));
}

function compileOneOverride(
  rule: ConditionalPresenceRule
): ConditionalPresence {
  const override: ConditionalPresence = {
    // Stored BY IDENTITY. Re-wrapping the user's predicate would put a layer
    // between it and the RuleContext members the array runner fills in.
    when: rule.when,
    whenMet: toPolicy(rule, rule.whenMet),
    whenUnmet: toPolicy(rule, rule.whenUnmet),
  };
  return Object.freeze(override);
}

/**
 * Both sides report under the SAME code, severity and message: a conditional
 * presence rule is one rule with one identity, and only one of its sides can
 * ever refuse a value anyway.
 */
function toPolicy(
  rule: ConditionalPresenceRule,
  allowance: PresenceAllowance | null
): PresencePolicy | null {
  if (allowance === null) return null;
  const policy: PresencePolicy = {
    code: rule.code,
    severity: rule.severity,
    allowUndefined: allowance.allowUndefined,
    allowNull: allowance.allowNull,
    emptyStringIsMissing: allowance.emptyStringIsMissing,
    nullIsValue: allowance.nullIsValue === true,
    // Wrapped rather than aliased, so a `describe` written as an object
    // method keeps its receiver.
    describe: (messageContext) => rule.describe(messageContext),
  };
  return Object.freeze(policy);
}
