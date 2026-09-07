// Re-exports only. One hand-written reference per benchmarked shape, keyed by
// the same BenchShapeName the Luq side uses, so the ratio harness cannot pair
// a Luq validator with the reference for a different shape.
import { checkMultiField, checkSingleField } from "./flat-checks";
import { checkNested } from "./nested-checks";
import { checkArray } from "./array-checks";
import { checkOrder } from "./order-checks";
import type { BenchShapeName } from "../shapes/bench-shape.types";

export { isRecord, checkMultiField, checkSingleField } from "./flat-checks";
export { checkNested } from "./nested-checks";
export { checkArray } from "./array-checks";
export { checkOrder } from "./order-checks";

export type HandWrittenCheck = (value: unknown) => boolean;

export const HAND_WRITTEN_CHECKS: Readonly<
  Record<BenchShapeName, HandWrittenCheck>
> = Object.freeze({
  singleField: checkSingleField,
  multiField: checkMultiField,
  nested: checkNested,
  array: checkArray,
  jsonSchema: checkOrder,
});
