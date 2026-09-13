// ===========================================================================
// L5  src/runtime/field-stages.ts
//
// The stages a field runs only when it declared one.
//
// Separate from run-field.ts because the two routes through a field are the
// thing that file is about now, and because keeping the short route small is
// the whole point of having one: what is being avoided is not the arithmetic
// in these guards, it is what a larger enclosing function does to inlining,
// and through inlining to escape analysis.
// ===========================================================================
import type { RuleContext } from "../types";
import type { CompiledField } from "../compile/validation-plan.types";

/**
 * The default is substituted BEFORE anything else looks at the value, so
 * validate() and parse() judge the same value. Only parse writes it back,
 * which is the caller's decision and not this one's.
 */
export function applyDefault(
  field: CompiledField,
  value: unknown,
  root: unknown
): unknown {
  if (field.defaultOf === null) return value;
  if (value === undefined) return field.defaultOf(root);
  if (value === null && field.applyDefaultToNull) return field.defaultOf(root);
  return value;
}

/**
 * Tidies the value before anything judges it: after default, before presence.
 *
 * Never called for undefined or null. That closes the accident where a
 * caller's `(v) => String(v).trim()` turns a missing field into the string
 * `"undefined"` and walks it past `.required()`. Absence is default's job.
 */
export function applyNormalize(field: CompiledField, value: unknown): unknown {
  if (field.normalize === null || value === undefined || value === null) {
    return value;
  }
  return field.normalize(value);
}

/** A closed gate ends the field successfully: no check, no transform. */
export function openGates(
  field: CompiledField,
  value: unknown,
  ruleContext: RuleContext
): boolean {
  const gates = field.gates;
  for (let i = 0; i < gates.length; i += 1) {
    const gate = gates[i];
    if (gate === undefined) continue;
    if (!gate.shouldRun(value, ruleContext)) return false;
  }
  return true;
}
