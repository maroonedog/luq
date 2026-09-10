// ===========================================================================
// L5  src/runtime/output-writer.ts
// parse()'s output side: COPY-ON-WRITE, and nothing else.
//
// A CompiledField already carries its own `write` (null unless the field
// declared a transform or a default), so a field writes itself. What L4 could
// not carry is the writer for an ARRAY NODE: ArrayNode has a reader and no
// writer, yet a transform on `items[*].name` produces a new element, hence a
// new array, which has to land back at `items`. Those node writers are built
// ONCE here, from the plan, at build() time — the same moment compileSchema
// runs — so validation never calls createValueWriter.
//
// The targets mirror the node tree by POSITION because they are derived from
// it by the same recursion: `targets[i]` belongs to `nodes[i]`, always. An
// EMPTY target list therefore means "this run writes nothing", which is what
// validate(), a branch and a recursive re-entry all pass.
//
// Nothing here mutates its argument. The legacy tree wrote transform results
// with setNestedValue straight into the caller's nested objects, so parse()
// destroyed the input it was handed; every function below returns the new
// value and leaves untouched siblings at their original identity.
// ===========================================================================
import type {
  ArrayNode,
  CompiledField,
  ValidationPlan,
} from "../compile/validation-plan.types";
import { createValueWriter } from "../path/create-value-writer";
import type { ValueWriter } from "../path/create-value-writer";
import type { FieldRunOutcome } from "./run-field";

/** The write-back companion of one ArrayNode, plus those of its nested nodes. */
export interface ArrayWriteTarget {
  /** Puts a rebuilt array back at the node's own path in its subject. */
  readonly write: ValueWriter;
  readonly nested: readonly ArrayWriteTarget[];
}

/** Shared and frozen: a validate() run allocates no target at all. */
export const NO_WRITE_TARGETS: readonly ArrayWriteTarget[] = Object.freeze([]);

export function createArrayWriteTargets(
  nodes: readonly ArrayNode[]
): readonly ArrayWriteTarget[] {
  if (nodes.length === 0) return NO_WRITE_TARGETS;
  return Object.freeze(
    nodes.map((node) =>
      Object.freeze({
        write: createValueWriter(node.template),
        nested: createArrayWriteTargets(node.nested),
      })
    )
  );
}

/**
 * null when the plan writes nothing at all — no transform anywhere and no
 * default anywhere. createValidator turns that null into "parse() runs exactly
 * the validate() path", which is the whole of "hasTransforms === false skips
 * the writer entirely": no target is built, no writer is called, and parse()
 * hands back the very object it was given.
 */
export function createPlanWriteTargets(
  plan: ValidationPlan
): readonly ArrayWriteTarget[] | null {
  // A field declaring only a normalizer is still written back by parse().
  // Leave it out of this condition and no writer is made, so the value read
  // comes back unchanged and in silence.
  if (!plan.hasTransforms && !plan.hasDefaults && !plan.hasNormalizers) {
    return null;
  }
  return createArrayWriteTargets(plan.arrays);
}

/**
 * `shouldWrite` is the parse/validate decision, taken by the caller and passed
 * down rather than re-derived here. validate() must not write even though a
 * default DID produce a new value for the rules to judge: legacy computed
 * defaults into a copy and threw the copy away, and that is the behaviour the
 * two entry points still share.
 *
 * `field.write` is null exactly when the field declared neither a transform
 * nor a default, so the null test is not a rule-kind decision — it is the
 * compiled answer to "does this field have an output at all".
 */
export function writeFieldValue(
  field: CompiledField,
  subject: unknown,
  outcome: FieldRunOutcome,
  shouldWrite: boolean
): unknown {
  if (!shouldWrite || !outcome.hasWriteBack || field.write === null) {
    return subject;
  }
  return field.write(subject, outcome.value);
}

/**
 * One element replaced, copy-on-write. An element that came back by identity
 * costs nothing: a 10k-element array with no transform is never copied, which
 * is why the identity test comes before the slice.
 */
export function replaceElement(
  array: readonly unknown[],
  index: number,
  element: unknown
): readonly unknown[] {
  if (array[index] === element) return array;
  const copy = array.slice();
  copy[index] = element;
  return copy;
}
