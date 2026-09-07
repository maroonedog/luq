// ===========================================================================
// L4  src/compile/resolve-presence.ts
// Every PresenceRule on a field, merged into ONE policy, at build time.
//
// The merge is a UNION of what the rules permit: `.optional().nullable()` and
// `.nullable().optional()` produce the identical policy, so the order a user
// happened to type the two methods in cannot change whether null is accepted.
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
 * The identity a failure is reported under: the rule that forbids the most,
 * ties broken by the lexicographically smaller code.
 *
 * Tie-breaking on the CODE rather than on declaration order is what keeps the
 * whole policy — not merely its three flags — independent of the order the
 * rules arrived in. `.optional().nullable()` and `.nullable().optional()` are
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
    if (difference > 0 || (difference === 0 && rule.code < strictest.code)) {
      strictest = rule;
    }
  }
  return strictest;
}
