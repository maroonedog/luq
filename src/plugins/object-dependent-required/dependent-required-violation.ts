// ===========================================================================
// L7  src/plugins/object-dependent-required/dependent-required-violation.ts
// One trigger key and the keys it demanded but did not get.
//
// It lives in its own module because it travels through IssueDetail.actual,
// which is `unknown` by design: the detail is data the runtime never inspects,
// so the plugin that put a shape in is the plugin that must prove the shape on
// the way out. The guard below is that proof, and it is the reason
// object-dependent-required.ts contains no assertion.
// ===========================================================================
import { isPlainObject, isString, isStringArray } from "../../types";

export interface DependentRequiredViolation {
  readonly trigger: string;
  readonly missing: readonly string[];
}

/** A key counts as present when it is an own key AND not undefined. */
function isPresentKey(subject: Record<string, unknown>, key: string): boolean {
  return (
    Object.prototype.hasOwnProperty.call(subject, key) &&
    subject[key] !== undefined
  );
}

export function findDependentRequiredViolations(
  subject: Record<string, unknown>,
  dependencies: Readonly<Record<string, readonly string[]>>
): readonly DependentRequiredViolation[] {
  const violations: DependentRequiredViolation[] = [];
  for (const [trigger, required] of Object.entries(dependencies)) {
    if (!isPresentKey(subject, trigger)) continue;
    const missing = required.filter((key) => !isPresentKey(subject, key));
    if (missing.length > 0) violations.push({ trigger, missing });
  }
  return violations;
}

function isViolation(value: unknown): value is DependentRequiredViolation {
  return (
    isPlainObject(value) &&
    isString(value.trigger) &&
    isStringArray(value.missing)
  );
}

export function readViolations(
  detail: unknown
): readonly DependentRequiredViolation[] {
  return Array.isArray(detail) && detail.every(isViolation) ? detail : [];
}

export function describeViolations(
  violations: readonly DependentRequiredViolation[]
): string {
  return violations
    .map(
      (violation) =>
        `When '${violation.trigger}' is present, the following properties are required: ${violation.missing.join(", ")}`
    )
    .join("; ");
}
