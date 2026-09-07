// ===========================================================================
// L1  src/path/index.ts — re-exports only. The single path vocabulary, shared
// by the type direction (FieldPath / ValueAtPath) and the runtime direction
// (parseFieldPath / the readers). Nothing is defined here.
// ===========================================================================
export type {
  EachSegment,
  IsWellFormedPath,
  KeySegment,
  ParsePath,
  PathSegment,
  Segment,
} from "./path-segment.types";
export type { PathDepthBudget, PreviousDepth } from "./path-depth.types";
export type { IsOpaqueObject, OpaqueObject } from "./opaque-object.types";
export type { ElementOf } from "./element-of.types";
export type { PropertyValueOf } from "./property-value-of.types";
export type { FieldPath } from "./field-path.types";
export type { LeafPath, MissingLeafPaths } from "./leaf-path.types";
export type { PickPaths, ValueAtPath } from "./value-at-path.types";

export {
  PathSyntaxError,
  RESERVED_SEGMENTS,
  assertDeclarableKey,
  isReservedSegment,
} from "./reserved-segment";
export {
  formatFieldPath,
  leafKeyOf,
  parentFieldPath,
  parseFieldPath,
} from "./parse-field-path";
export type { ValueReader } from "./create-value-reader";
export {
  collectKeySegments,
  createValueReader,
  isIndexableObject,
  readOwnProperty,
} from "./create-value-reader";
export type { ArrayReader } from "./create-array-reader";
export { createArrayReader } from "./create-array-reader";
export type { ValueWriter } from "./create-value-writer";
export { createValueWriter } from "./create-value-writer";
export { formatIssuePath } from "./format-issue-path";
export { matchPathPattern } from "./match-path-pattern";
