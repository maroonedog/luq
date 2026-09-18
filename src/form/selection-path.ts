import { parseFieldPath } from "../path/parse-field-path";
import type { PathSegment } from "../path/path-segment.types";

export type SelectionSegment =
  | PathSegment
  | { readonly kind: "index"; readonly index: number };
export type SelectionPath = readonly SelectionSegment[];

/** Parse concrete brackets using the declaration grammar for keys and wildcards. */
export function parseSelectionPath(path: string): SelectionPath {
  const indices: (number | null)[] = [];
  const pattern = path.replace(/\[([^\]]*)\]/g, (bracket, content: string) => {
    if (content === "*") {
      indices.push(null);
      return bracket;
    }
    const index = readSelectionIndex(content);
    if (index === null)
      throw new RangeError(`Invalid array index in "${path}".`);
    indices.push(index);
    return "[*]";
  });
  let cursor = 0;
  return Object.freeze(
    parseFieldPath(pattern).map((segment): SelectionSegment => {
      if (segment.kind !== "each") return segment;
      const index = indices[cursor++];
      return index === null || index === undefined
        ? segment
        : Object.freeze({ kind: "index", index });
    })
  );
}

export function readSelectionIndex(key: string): number | null {
  if (!/^(0|[1-9]\d*)$/.test(key)) return null;
  const index = Number(key);
  return Number.isSafeInteger(index) && index < 4294967295 ? index : null;
}

export function selectionMatchesSegment(
  selected: SelectionSegment,
  declared: PathSegment
): boolean {
  if (declared.kind === "key")
    return selected.kind === "key" && selected.key === declared.key;
  return selected.kind !== "key" || readSelectionIndex(selected.key) !== null;
}

/** A selected container includes declarations below it, without string-prefix collisions. */
export function selectsDeclaration(
  selected: SelectionPath,
  declared: readonly PathSegment[]
): boolean {
  return (
    selected.length <= declared.length &&
    selected.every((segment, index) => {
      const target = declared[index];
      return target !== undefined && selectionMatchesSegment(segment, target);
    })
  );
}
