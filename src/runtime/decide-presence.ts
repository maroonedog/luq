// ===========================================================================
// L5  src/runtime/decide-presence.ts
// Is this field's value THERE, and if not, is that allowed?
//
// Absence is decided once, here, and it is the only thing that can silence a
// field. Permitted absence (`.optional()` / `.nullable()`) ends the field with
// no issue and runs no check and no transform — a length rule must not fire on
// a value the schema said may be missing. Forbidden absence ends it with
// exactly one issue, under the presence rule's own code. A field that declared
// no presence rule carries OPEN_PRESENCE, which permits both, so a missing
// value is silently absent rather than implicitly REQUIRED: the one uniform
// answer replacing legacy's fast/slow-path split, where adding an array
// elsewhere in the schema switched implicit REQUIRED on.
//
// Which policy applies can depend on the root — `.requiredIf(when)` — so the
// policy is SELECTED before the value is judged. Selecting is all that happens
// at run time: both sides of every condition were finished at compile time.
// ===========================================================================
import type { RuleContext } from "../types";
import type {
  CompiledField,
  PresencePolicy,
} from "../compile/validation-plan.types";
import { createIssue } from "./create-issue";
import type { IssueSink } from "./issue-sink";

/** True when the field should go on to its gates, checks and transforms. */
export function decidePresence(
  field: CompiledField,
  value: unknown,
  ruleContext: RuleContext,
  sink: IssueSink
): boolean {
  const policy = selectPolicy(field, ruleContext);
  const isMissing =
    value === undefined || (policy.emptyStringIsMissing && value === "");
  if (!isMissing && value !== null) return true;
  const isAllowed = isMissing ? policy.allowUndefined : policy.allowNull;
  return reportUnlessAllowed(policy, isAllowed, value, ruleContext.path, sink);
}

/**
 * The merged static policy, then every conditional override that applies, in
 * declaration order — so a later `.optionalIf(...)` wins over an earlier
 * `.requiredIf(...)` on the same field, the way a later assignment wins.
 *
 * The empty case costs one length test and returns the policy the compiler
 * already built. Nothing here inspects a rule or builds a policy.
 */
function selectPolicy(
  field: CompiledField,
  ruleContext: RuleContext
): PresencePolicy {
  const overrides = field.presenceOverrides;
  if (overrides.length === 0) return field.presence;
  let policy = field.presence;
  for (const override of overrides) {
    const side = override.when(ruleContext.root, ruleContext.item)
      ? override.whenMet
      : override.whenUnmet;
    if (side !== null) policy = side;
  }
  return policy;
}

function reportUnlessAllowed(
  policy: PresencePolicy,
  isAllowed: boolean,
  value: unknown,
  path: string,
  sink: IssueSink
): boolean {
  if (!isAllowed) {
    sink.add(
      createIssue({
        path,
        code: policy.code,
        severity: policy.severity,
        value,
        render: (ctx) => policy.describe(ctx),
      })
    );
  }
  return false;
}
