// ===========================================================================
// L5  src/runtime/fold-fields.ts
// The field list, folded into a chain of closures once, so validate() walks no
// array.
//
// WHY. run-plan indexes `plan.fields` on every call, and around each index it
// re-asks questions whose answers were settled by L4: whether this field is
// plain, whether its outcome needs writing back, whether the plan should stop.
// Measured against a hand-written validator for the same three-field shape,
// the whole generic route costs about six times what straight-line code does,
// and the gap is almost entirely this walking rather than the rules
// themselves: calling a rule through an opaque function reference with a
// context object measured within 9% of inlining the rule's body outright.
// V8 inlines the calls; it cannot inline away the loop.
//
// WHAT IT REFUSES. A fold is only correct where nothing can rewrite the
// subject under it, so this returns null — and run-plan keeps its loop —
// unless every field is plain. A plain field has no default, no normalizer, no
// gate, no transform and no recursion, so it cannot write back, and the value
// each step reads is the value the caller passed. That is the same `isPlain`
// the runtime already dispatches on, asked once more at the only other place
// it can be answered for free.
//
// NO CODE IS GENERATED. There is no `new Function` here and there must never
// be one: a run-time schema working under a strict Content-Security-Policy is
// something this package measures and publishes, and the check that keeps it
// true (`npm run check:no-dynamic-code`) reads this directory.
// ===========================================================================
import type { CompiledField } from "../compile/validation-plan.types";
import { runPlainField } from "./run-field";
import type { FieldRunContext } from "./run-field";

/**
 * Every field of a plan, in declaration order, as one call.
 *
 * Returns nothing: a folded plan is only built where no field writes back, so
 * the subject the caller holds is still the subject after it runs.
 */
export type FoldedFields = (subject: unknown, context: FieldRunContext) => void;

/**
 * The fold, or null when the plan has a field this cannot speak for.
 *
 * Null is not a failure. It is the plan saying it needs the general route, and
 * run-plan reads it that way.
 */
export function foldFields(
  fields: readonly CompiledField[]
): FoldedFields | null {
  for (const field of fields) {
    if (!field.isPlain) return null;
  }

  let folded: FoldedFields | null = null;
  for (const field of fields) {
    const previous: FoldedFields | null = folded;
    // Each step closes over ONE field, so nothing is indexed at run time.
    const step: FoldedFields = (subject, context) => {
      runPlainField(field, subject, context);
    };
    folded =
      previous === null
        ? step
        : (subject, context) => {
            previous(subject, context);
            // The same question the loop asked between iterations, asked in
            // the same place. abortEarly stops at the field that failed and
            // not after the one behind it.
            if (context.sink.shouldStopPlan()) return;
            step(subject, context);
          };
  }
  return folded;
}
