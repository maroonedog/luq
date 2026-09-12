// ===========================================================================
// L4  src/compile/resolve-presence.ts
// Every PresenceRule on a field, merged into ONE policy, at build time.
//
// The merge is a UNION of what the rules permit: `.optional().nullable()` and
// `.nullable().optional()` produce the identical policy, so the order a user
// happened to type the two methods in cannot change whether null is accepted.
// The identity the policy reports is chosen the same way — from the presence
// flags alone, never from the codes — so renaming a published code moves no
// behaviour. See outranksOnRestriction.
//
// A field that declared NO presence rule gets OPEN_PRESENCE, which forbids
// nothing. That is the one uniform answer to the legacy "implicit REQUIRED":
// there, a missing field became an error or not depending on whether the
// schema happened to contain an array or a transform elsewhere. Here only the
// required / optional / nullable plugins decide what missing means.
// ===========================================================================
import type { IssueSeverity } from "../types";
import type { PresenceRule } from "../plugin-kit/compiled-rule";
import type { PresencePolicy } from "./validation-plan.types";

/** The code of a policy that can never fail, and so can never be emitted. */
export const OPEN_PRESENCE_CODE = "presence";

const OPEN_SEVERITY: IssueSeverity = "error";

const OPEN_POLICY: PresencePolicy = {
  code: OPEN_PRESENCE_CODE,
  severity: OPEN_SEVERITY,
  allowUndefined: true,
  allowNull: true,
  emptyStringIsMissing: false,
  nullIsValue: false,
  describe: () => "This field declares no presence rule",
};

export const OPEN_PRESENCE: PresencePolicy = Object.freeze(OPEN_POLICY);

export function resolvePresence(
  rules: readonly PresenceRule[]
): PresencePolicy {
  const strictest = selectStrictestPresence(rules);
  if (strictest === undefined) return OPEN_PRESENCE;
  const policy: PresencePolicy = {
    code: strictest.code,
    severity: strictest.severity,
    allowUndefined: rules.some((rule) => rule.allowUndefined),
    allowNull: rules.some((rule) => rule.allowNull),
    emptyStringIsMissing: rules.some((rule) => rule.emptyStringIsMissing),
    // One rule saying "null is a value here" is enough: the checks then run
    // and decide, which is strictly more judgement, never less.
    nullIsValue: rules.some((rule) => rule.nullIsValue === true),
    describe: (ctx) => strictest.describe(ctx),
  };
  return Object.freeze(policy);
}

/** How much this one rule forbids. Order-free, so the maximum is too. */
function countRestrictions(rule: PresenceRule): number {
  return (
    (rule.allowUndefined ? 0 : 1) +
    (rule.allowNull ? 0 : 1) +
    (rule.emptyStringIsMissing ? 1 : 0)
  );
}

/**
 * Which of two equally restrictive rules is reported, decided on WHAT each one
 * forbids: undefined first, then null, then the empty string.
 *
 * The order is declared here rather than falling out of something else. It
 * runs from the broadest absence to the narrowest — a field that is not there
 * at all, a field that is there holding null, a field holding "" — so the
 * identity a caller sees names the largest thing that was missing.
 *
 * Nothing in this comparison reads a code. A code is a published name, pinned
 * in config/issue-code.lock.json, and re-spelling one must not move which rule
 * a failure is reported under; comparing the two codes made exactly that
 * happen, silently, from a one-word rename.
 *
 * Two rules forbidding the identical three things are indistinguishable to
 * every reader of the policy, so neither outranks the other and the one
 * declared first stays. That is the only case where the order the methods were
 * typed in is observable at all.
 */
function outranksOnRestriction(
  rule: PresenceRule,
  incumbent: PresenceRule
): boolean {
  if (rule.allowUndefined !== incumbent.allowUndefined) {
    return !rule.allowUndefined;
  }
  if (rule.allowNull !== incumbent.allowNull) return !rule.allowNull;
  if (rule.emptyStringIsMissing !== incumbent.emptyStringIsMissing) {
    return rule.emptyStringIsMissing;
  }
  return false;
}

/**
 * The identity a failure is reported under: the rule that forbids the most,
 * ties broken by which absence it forbids.
 *
 * Both halves of the decision read only the three presence flags, so the whole
 * policy — not merely its flags — is independent of the order the rules
 * arrived in. `.optional().nullable()` and `.nullable().optional()` are
 * deep-equal, which is the property the tests assert.
 */
function selectStrictestPresence(
  rules: readonly PresenceRule[]
): PresenceRule | undefined {
  let strictest: PresenceRule | undefined;
  for (const rule of rules) {
    if (strictest === undefined) {
      strictest = rule;
      continue;
    }
    const difference = countRestrictions(rule) - countRestrictions(strictest);
    if (
      difference > 0 ||
      (difference === 0 && outranksOnRestriction(rule, strictest))
    ) {
      strictest = rule;
    }
  }
  return strictest;
}
