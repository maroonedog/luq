import type {
  ArrayNode,
  CompiledField,
  ValidationPlan,
} from "../compile/validation-plan.types";
import type { PathSegment } from "../path/path-segment.types";
import { parseSelectionPath, selectsDeclaration } from "./selection-path";
import type { SelectionPath } from "./selection-path";
import { selectArrayNode } from "./select-array-node";

export function selectValidationPlan(
  plan: ValidationPlan,
  paths: readonly string[]
): ValidationPlan {
  const selected = paths.map(parseSelectionPath);
  const declared = collectDeclarations(plan.fields, plan.arrays, []);
  selected.forEach((selection, index) => {
    if (!declared.some((template) => selectsDeclaration(selection, template))) {
      throw new RangeError(
        `No declared validation field matches "${paths[index]}".`
      );
    }
  });
  return Object.freeze({
    fields: Object.freeze(selectFields(plan.fields, selected)),
    arrays: Object.freeze(
      plan.arrays.flatMap((node) => {
        const selectedNode = selectArrayNode(node, selected);
        return selectedNode === null ? [] : [selectedNode];
      })
    ),
    hasDefaults: false,
    hasNormalizers: false,
    hasTransforms: false,
  });
}

function selectFields(
  fields: readonly CompiledField[],
  selected: readonly SelectionPath[]
): CompiledField[] {
  return fields.filter((field) =>
    selected.some((selection) => selectsDeclaration(selection, field.template))
  );
}

function collectDeclarations(
  fields: readonly CompiledField[],
  arrays: readonly ArrayNode[],
  prefix: readonly PathSegment[]
): readonly (readonly PathSegment[])[] {
  return [
    ...fields.map((field) => [...prefix, ...field.template]),
    ...arrays.flatMap((node) =>
      collectDeclarations(node.elementFields, node.nested, [
        ...prefix,
        ...node.template,
        { kind: "each" },
      ])
    ),
  ];
}
