import type { FieldPath } from "../../../src/path/field-path.types";
import type { ValueAtPath } from "../../../src/path/value-at-path.types";
import type { LeafPath } from "../../../src/path/leaf-path.types";
import type {
  ParsePath,
  IsWellFormedPath,
} from "../../../src/path/path-segment.types";
import type {
  Address,
  Equals,
  Expect,
  Item,
  TreeNode,
  User,
} from "../../support/model";

// ---- ValueAtPath resolves what the declaration says ------------------------
export type NameIsString = Expect<Equals<ValueAtPath<User, "name">, string>>;
export type NickKeepsUndefined = Expect<
  Equals<ValueAtPath<User, "nick">, string | undefined>
>;
export type TagElementIsString = Expect<
  Equals<ValueAtPath<User, "tags[*]">, string>
>;
export type NestedIsString = Expect<
  Equals<ValueAtPath<User, "user.address.street">, string>
>;
export type ItemNameIsString = Expect<
  Equals<ValueAtPath<User, "items[*].name">, string>
>;
export type MatrixCellIsNumber = Expect<
  Equals<ValueAtPath<User, "matrix[*][*]">, number>
>;
export type OptSurvivesLast = Expect<
  Equals<ValueAtPath<User, "opt">, Address | undefined>
>;
export type OptIntermediateIsTotal = Expect<
  Equals<ValueAtPath<User, "opt.street">, string>
>;
export type LooseSubtreeStaysUnknown = Expect<
  Equals<ValueAtPath<User, "loose.anything.deeper">, unknown>
>;

// ---- FieldPath refuses what the grammar forbids ----------------------------
export type DateIsOpaque = Expect<
  Equals<Extract<FieldPath<User>, `when.${string}`>, never>
>;
export type NoImplicitArrayDescent = Expect<
  Equals<Extract<FieldPath<User>, "tags.length">, never>
>;
export type NoArrayMemberDescent = Expect<
  Equals<Extract<FieldPath<User>, "items.name">, never>
>;
export type NoIndexedDescent = Expect<
  Equals<Extract<FieldPath<User>, "items[0].name">, never>
>;
export type NoArrayMethod = Expect<
  Equals<Extract<FieldPath<User>, "items.map">, never>
>;
export type WildcardIsOffered = Expect<
  Equals<Extract<FieldPath<User>, "items[*]">, "items[*]">
>;
export type WildcardMemberIsOffered = Expect<
  Equals<Extract<FieldPath<User>, "items[*].name">, "items[*].name">
>;

// ---- LeafPath: containers are not leaves ----------------------------------
export type ContainerIsNotALeaf = Expect<
  Equals<Extract<LeafPath<User>, "tags">, never>
>;
export type ElementIsALeaf = Expect<
  Equals<Extract<LeafPath<User>, "tags[*]">, "tags[*]">
>;
export type ObjectIsNotALeaf = Expect<
  Equals<Extract<LeafPath<User>, "user">, never>
>;
export type NestedLeaf = Expect<
  Equals<Extract<LeafPath<User>, "user.address.zip">, "user.address.zip">
>;
export type DateIsALeaf = Expect<
  Equals<Extract<LeafPath<User>, "when">, "when">
>;
// The README names these two cases when explaining .strict(). This keeps the
// types from moving while the prose stays behind.
export type OptionalIsALeaf = Expect<
  Equals<Extract<LeafPath<User>, "nick">, "nick">
>;
export type ItemFieldIsALeaf = Expect<
  Equals<Extract<LeafPath<User>, "items[*].name">, "items[*].name">
>;
/** A string-index-signature subtree imposes no .strict() obligation. */
export type LooseIsNotALeaf = Expect<
  Equals<Extract<LeafPath<User>, `loose${string}`>, never>
>;

// ---- the self-referential model terminates --------------------------------
export type TreeIsFinite = Expect<
  Equals<
    Extract<FieldPath<TreeNode>, "children[*].children[*].label">,
    "children[*].children[*].label"
  >
>;
export type TreeValue = Expect<
  Equals<ValueAtPath<TreeNode, "children[*].label">, string>
>;

// ---- the round trip: ParsePath agrees with the generator ------------------
export type ParsesWildcard = Expect<
  Equals<
    ParsePath<"items[*].name">,
    [
      { readonly key: "items" },
      { readonly each: true },
      { readonly key: "name" },
    ]
  >
>;
export type WellFormed = Expect<
  Equals<IsWellFormedPath<"items[*].name">, true>
>;
export type EmptyHeadIsRejected = Expect<
  Equals<IsWellFormedPath<"items..name">, false>
>;

/**
 * ROUND-TRIP PROPERTY: every literal FieldPath<T> generates must resolve to a
 * non-never type. Written as an exhaustive scan over the union.
 */
type UnresolvablePath<T> = {
  [P in FieldPath<T> & string]: [ValueAtPath<T, P>] extends [never] ? P : never;
}[FieldPath<T> & string];

export type UserPathsAllResolve = Expect<Equals<UnresolvablePath<User>, never>>;
export type ItemPathsAllResolve = Expect<Equals<UnresolvablePath<Item>, never>>;
export type TreePathsAllResolve = Expect<
  Equals<UnresolvablePath<TreeNode>, never>
>;

/** Same property for LeafPath, which .strict() consumes. */
type UnresolvableLeaf<T> = {
  [P in LeafPath<T> & string]: [ValueAtPath<T, P>] extends [never] ? P : never;
}[LeafPath<T> & string];
export type UserLeavesAllResolve = Expect<
  Equals<UnresolvableLeaf<User>, never>
>;

/** LeafPath must be a SUBSET of FieldPath, or .strict() can demand the unwritable. */
export type LeavesAreFieldPaths = Expect<
  Equals<Exclude<LeafPath<User>, FieldPath<User>>, never>
>;
export type TreeLeavesAreFieldPaths = Expect<
  Equals<Exclude<LeafPath<TreeNode>, FieldPath<TreeNode>>, never>
>;
