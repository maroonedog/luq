// ===========================================================================
// L4  src/compile/compile-array-node.ts — one ArrayFieldGroup becomes one
// ArrayNode, and its wildcard-carrying members become nested ArrayNodes.
//
// The node holds ONE reader for the array and a flat list of element fields.
// That is the whole of the loop interchange at run time: read once, then walk
// the elements, and for each element walk the fields.
//
// `read` is the ARRAY reader, so "there is no array at this path" is decided
// here, at the boundary, as null. The legacy tree spelled that rule inline in
// two places and forgot it in a third, which is how `matrix[*][*]` became
// silently unvalidated.
// ===========================================================================
import { createArrayReader } from "../path/create-array-reader";
import type {
  ArrayNode,
  CompiledField,
  PlanRef,
} from "./validation-plan.types";
import { compileField, type CompositeEraser } from "./compile-field";
import {
  groupArrayFields,
  type ArrayFieldGroup,
  type RelativeDeclaration,
} from "./group-array-fields";

/** Everything a field needs that is not the declaration itself. */
export interface NodeCompileContext {
  /** The plan a `recursively` rule on any of these fields re-enters. */
  readonly planRef: PlanRef;
  readonly eraseComposite: CompositeEraser;
}

/** The one adapter from a grouped declaration to compileField's request. */
export function compileRelativeDeclaration(
  declaration: RelativeDeclaration,
  context: NodeCompileContext
): CompiledField {
  return compileField({
    template: declaration.template,
    rules: declaration.rules,
    fieldPath: declaration.fieldPath,
    defaultOf: declaration.defaultOf,
    applyDefaultToNull: declaration.applyDefaultToNull,
    planRef: context.planRef,
    eraseComposite: context.eraseComposite,
  });
}

/**
 * Nesting is a re-grouping of the members, not a second traversal strategy:
 * `items[*].sub[*].x` arrives here as the group `items` whose one member is
 * still `sub[*].x`, and that member groups again into the nested node `sub`.
 * `matrix[*][*]` reaches the same shape through an EMPTY nested template —
 * the element of the outer array is itself the inner array.
 */
export function compileArrayNode(
  group: ArrayFieldGroup,
  context: NodeCompileContext
): ArrayNode {
  const grouped = groupArrayFields(group.members);
  const template = Object.freeze(group.template);
  const node: ArrayNode = {
    template,
    read: createArrayReader(template),
    elementFields: Object.freeze(
      grouped.direct.map((declaration) =>
        compileRelativeDeclaration(declaration, context)
      )
    ),
    nested: Object.freeze(
      grouped.arrays.map((nested) => compileArrayNode(nested, context))
    ),
  };
  return Object.freeze(node);
}
