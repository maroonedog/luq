import type { ArrayNode } from "../compile/validation-plan.types";
import {
  readSelectionIndex,
  selectionMatchesSegment,
  selectsDeclaration,
} from "./selection-path";
import type { SelectionPath } from "./selection-path";

/** Build an element-specific plan once; validation only chooses its row. */
export function selectArrayNode(
  node: ArrayNode,
  selected: readonly SelectionPath[]
): ArrayNode | null {
  const tails = selected.flatMap((selection) => {
    if (selectsDeclaration(selection, node.template)) return [[]];
    if (
      !node.template.every((segment, index) => {
        const target = selection[index];
        return target !== undefined && selectionMatchesSegment(target, segment);
      })
    )
      return [];
    return [selection.slice(node.template.length)];
  });
  if (tails.some((tail) => tail.length === 0)) return node;
  const wildcard: SelectionPath[] = [];
  const byIndex = new Map<number, SelectionPath[]>();
  for (const tail of tails) {
    const head = tail[0];
    if (head === undefined) continue;
    const remaining = tail.slice(1);
    if (head.kind === "each") {
      wildcard.push(remaining);
      continue;
    }
    const index =
      head.kind === "index" ? head.index : readSelectionIndex(head.key);
    if (index === null) continue;
    const previous = byIndex.get(index) ?? [];
    byIndex.set(index, [...previous, remaining]);
  }
  const fallback = selectContents(node, wildcard);
  if (byIndex.size === 0) return fallback;
  const variants = new Map<number, ArrayNode | null>();
  for (const [index, paths] of byIndex)
    variants.set(index, selectContents(node, [...wildcard, ...paths]));
  const union = selectContents(node, [
    ...wildcard,
    ...[...byIndex.values()].flat(),
  ]);
  if (union === null) return null;
  return Object.freeze({
    ...union,
    selectElement: (index: number) => variants.get(index) ?? fallback,
  });
}

function selectContents(
  node: ArrayNode,
  selected: readonly SelectionPath[]
): ArrayNode | null {
  if (selected.length === 0) return null;
  const elementFields = node.elementFields.filter((field) =>
    selected.some((selection) => selectsDeclaration(selection, field.template))
  );
  const nested = node.nested.flatMap((child) => {
    const selectedChild = selectArrayNode(child, selected);
    return selectedChild === null ? [] : [selectedChild];
  });
  if (elementFields.length === 0 && nested.length === 0) return null;
  return Object.freeze({
    ...node,
    elementFields: Object.freeze(elementFields),
    nested: Object.freeze(nested),
  });
}
