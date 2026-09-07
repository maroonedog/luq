// Re-exports only. The ordered list every bench entry point iterates.
import { multiFieldShape, singleFieldShape } from "./flat-shapes";
import { nestedShape } from "./nested-shape";
import { arrayShape } from "./array-shape";
import { jsonSchemaShape } from "./json-schema-shape";
import type { BenchShape } from "./bench-shape.types";

export type {
  BenchShape,
  BenchShapeName,
  BenchValidator,
} from "./bench-shape.types";
export { ARRAY_ELEMENT_COUNT } from "./array-shape";
export { multiFieldShape, singleFieldShape } from "./flat-shapes";
export { nestedShape } from "./nested-shape";
export { arrayShape } from "./array-shape";
export { jsonSchemaShape } from "./json-schema-shape";

export const BENCH_SHAPES: readonly BenchShape[] = Object.freeze([
  singleFieldShape,
  multiFieldShape,
  nestedShape,
  arrayShape,
  jsonSchemaShape,
]);
