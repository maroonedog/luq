// ===========================================================================
// L4  src/compile/group-array-fields.ts — LOOP INTERCHANGE.
//
// `addresses[*].type`, `addresses[*].city` and `addresses[*].zip` are three
// declarations over ONE array. Compiled field by field they make the engine
// walk `addresses` three times. Grouped here they become a single node with
// three element fields, applied to each element in one pass: "for each field,
// for each element" is exchanged into "for each element, for each field".
//
// The legacy tree found the same optimisation (array-batch-optimizer) and then
// gave the win back by rebuilding the batch validator inside validate(). Here
// the grouping is a build-time transformation over SEGMENTS — no string is
// re-split — and validation never sees a declaration again.
//
// This function splits exactly ONE level. `items[*].sub[*].x` leaves `sub[*].x`
// in the member list still carrying a wildcard; compileArrayNode calls back in
// to split the next level. Recursion belongs to whoever builds the node, not
// to the grouping rule.
// ===========================================================================
import type { PathSegment } from "../path/path-segment.types";
import { formatFieldPath } from "../path/parse-field-path";
import type { Rule } from "../plugin-kit/compiled-rule";

/**
 * One declaration whose template is RELATIVE to the subject being compiled:
 * the root for a top-level field, one array element inside an array node, the
 * branch subject inside a composite.
 *
 * `fieldPath` is the path the user actually declared and is carried only so a
 * build-time failure can name it. It is never re-parsed.
 */
export interface RelativeDeclaration {
  readonly template: readonly PathSegment[];
  readonly rules: readonly Rule[];
  readonly fieldPath: string;
  readonly defaultOf: ((root: unknown) => unknown) | null;
  readonly applyDefaultToNull: boolean;
  readonly normalize: ((value: unknown) => unknown) | null;
}

/** Every declaration that reaches through the same array, plus that array. */
export interface ArrayFieldGroup {
  /** The array's own template, relative to the enclosing subject. Empty when
   *  the subject IS the array, which is how `matrix[*][*]` reaches two levels. */
  readonly template: readonly PathSegment[];
  /** Templates relative to ONE ELEMENT. May still contain wildcards. */
  readonly members: readonly RelativeDeclaration[];
}

export interface GroupedFields {
  /** Declarations with no wildcard left: these compile to CompiledFields. */
  readonly direct: readonly RelativeDeclaration[];
  /** In first-declaration order, so the plan does not depend on Map internals. */
  readonly arrays: readonly ArrayFieldGroup[];
}

interface ArrayGroupDraft {
  readonly template: readonly PathSegment[];
  readonly members: RelativeDeclaration[];
}

const NO_GROUPS: readonly ArrayFieldGroup[] = Object.freeze([]);

/** -1 when the template addresses a single value. */
function findFirstWildcard(template: readonly PathSegment[]): number {
  return template.findIndex((segment) => segment.kind === "each");
}

/**
 * The array a declaration reaches through is its prefix up to the first `[*]`,
 * and the element template is everything after it. Two declarations belong to
 * the same array exactly when those prefixes render identically — which is why
 * the key is built by the ONE formatter and never by string surgery on the
 * declared path.
 */
export function groupArrayFields(
  declarations: readonly RelativeDeclaration[]
): GroupedFields {
  const direct: RelativeDeclaration[] = [];
  const drafts = new Map<string, ArrayGroupDraft>();
  const groupOrder: string[] = [];
  for (const declaration of declarations) {
    const wildcardAt = findFirstWildcard(declaration.template);
    if (wildcardAt < 0) {
      direct.push(declaration);
      continue;
    }
    const template = Object.freeze(declaration.template.slice(0, wildcardAt));
    const key = formatFieldPath(template);
    const draft = drafts.get(key);
    if (draft === undefined) {
      drafts.set(key, {
        template,
        members: [toElementMember(declaration, wildcardAt)],
      });
      groupOrder.push(key);
      continue;
    }
    draft.members.push(toElementMember(declaration, wildcardAt));
  }
  return Object.freeze({
    direct: Object.freeze(direct),
    arrays: freezeGroups(groupOrder, drafts),
  });
}

/** The same declaration, re-based on one element of the array it named. */
function toElementMember(
  declaration: RelativeDeclaration,
  wildcardAt: number
): RelativeDeclaration {
  return Object.freeze({
    ...declaration,
    template: Object.freeze(declaration.template.slice(wildcardAt + 1)),
  });
}

function freezeGroups(
  groupOrder: readonly string[],
  drafts: ReadonlyMap<string, ArrayGroupDraft>
): readonly ArrayFieldGroup[] {
  if (groupOrder.length === 0) return NO_GROUPS;
  const groups: ArrayFieldGroup[] = [];
  for (const key of groupOrder) {
    const draft = drafts.get(key);
    if (draft === undefined) continue;
    groups.push(
      Object.freeze({
        template: draft.template,
        members: Object.freeze(draft.members.slice()),
      })
    );
  }
  return Object.freeze(groups);
}
