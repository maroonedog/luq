// ===========================================================================
// L8  src/json-schema/declare-presence.ts — is this property allowed to be
// ABSENT, and is it allowed to be NULL?
//
// Draft-07 answers with two different keywords in two different places: the
// PARENT's `required` array decides absence, and the child's own `type` decides
// null (a `type` that omits "null" forbids it; NO `type` at all forbids
// nothing). Luq answers with one merged PresencePolicy per field, so the two
// have to be resolved together — which is also why this is not the `required`
// KEYWORD BINDING from keyword-map-object.ts.
//
// WHY NOT `.required()` (measured, and a deliberate deviation): requiredPlugin
// declares `emptyStringIsMissing: true`, carried over verbatim from 1.x's
// form-oriented emptiness, and src/compile/resolve-presence.ts merges that flag
// with `.some()`, so no companion rule can switch it back off. Under
// `.required()` the document `{"name": ""}` therefore FAILS `required: ["name"]`,
// which Draft-07 §6.5.3 permits — the keyword is about the property being
// PRESENT, not about it being non-empty. The policy below is the same rule kind
// from the same factory with `emptyStringIsMissing: false`.
// ===========================================================================
import { presence } from "../plugin-kit/create-rule";
import type { Rule } from "../plugin-kit/compiled-rule";
import type { IssueSeverity } from "../types";

export interface PresenceDeclaration {
  readonly isRequired: boolean;
  readonly severity: IssueSeverity;
}

/**
 * The rule is emitted even when it forbids nothing, because it carries
 * `nullIsValue` and that is not a permission — it is the statement that null
 * has to be JUDGED here rather than settled by presence. A subject with no
 * presence rule carries OPEN_PRESENCE, which ends the field on null before a
 * single check runs; under Draft-07 that is wrong, because `false`,
 * `{"not": {}}` and an `enum` without null all forbid null while saying
 * nothing about `type`. Null therefore goes to the checks, and `type`
 * (declare-value-keywords.ts) is what rejects it when the document says so —
 * one answer instead of two that have to agree.
 */
export function declarePresenceRules(
  declaration: PresenceDeclaration
): readonly Rule[] {
  return Object.freeze([
    presence({
      code: declaration.isRequired ? "required" : "type",
      severity: declaration.severity,
      allowUndefined: !declaration.isRequired,
      // Unreachable for null while nullIsValue is true; `type` decides.
      allowNull: true,
      emptyStringIsMissing: false,
      nullIsValue: true,
      describe: (messageContext) =>
        declaration.isRequired
          ? `${messageContext.path} is required`
          : `${messageContext.path} must not be null`,
      buildMessageContext: () => ({}),
    }),
  ]);
}
