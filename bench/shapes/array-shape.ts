// ===========================================================================
// bench/shapes/array-shape.ts
//
// One array of 50 elements with three rules per element, plus a length rule on
// the array itself. This is the shape the "loop interchange" decision in
// src/compile/group-array-fields.ts exists for: the element fields are grouped
// so the runtime walks the array ONCE and applies all three rules per element,
// instead of walking it once per declared element field.
//
// Element count is fixed at 50 and stated in the recorded conditions, because
// ops/sec on an array shape is meaningless without it — halving the element
// count roughly doubles the figure.
//
// Three of the four rejected values fail on the LAST element on purpose. A
// rejection that fires on element 0 would measure almost none of the traversal
// this shape exists to measure; failing at the end walks all 50 first.
// ===========================================================================
import { Builder } from "../../src/index";
import { requiredPlugin } from "../../src/plugins/required";
import { stringMinPlugin } from "../../src/plugins/string-min";
import { stringPatternPlugin } from "../../src/plugins/string-pattern";
import { numberMinPlugin } from "../../src/plugins/number-min";
import { numberIntegerPlugin } from "../../src/plugins/number-integer";
import { arrayMinLengthPlugin } from "../../src/plugins/array-min-length";
import { arrayMaxLengthPlugin } from "../../src/plugins/array-max-length";
import type { ValuePool } from "../rotate-over-values";
import type { BenchShape } from "./bench-shape.types";

export const ARRAY_ELEMENT_COUNT = 50;

export interface ArrayLine {
  readonly sku: string;
  readonly label: string;
  readonly quantity: number;
}

export interface ArraySubject {
  readonly lines: readonly ArrayLine[];
}

function arrayValue(offset: number): ArraySubject {
  return {
    lines: Array.from({ length: ARRAY_ELEMENT_COUNT }, (_unused, index) => ({
      sku: `SKU-${offset + index}`,
      label: `line item ${offset + index}`,
      quantity: offset + index + 1,
    })),
  };
}

export const ARRAY_VALUES: readonly [
  ArraySubject,
  ArraySubject,
  ArraySubject,
  ArraySubject,
] = [arrayValue(0), arrayValue(100), arrayValue(200), arrayValue(300)];

export const ARRAY_VALUE: ArraySubject = ARRAY_VALUES[0];

function withLastLineReplaced(
  source: ArraySubject,
  replacement: Record<string, unknown>
): unknown {
  const lines: unknown[] = [...source.lines];
  lines[lines.length - 1] = replacement;
  return { lines };
}

export const ARRAY_REJECTED: ValuePool = [
  withLastLineReplaced(ARRAY_VALUES[0], {
    sku: "SKU-x",
    label: "line item 49",
    quantity: 50,
  }),
  withLastLineReplaced(ARRAY_VALUES[1], {
    sku: "SKU-149",
    label: "ab",
    quantity: 150,
  }),
  withLastLineReplaced(ARRAY_VALUES[2], {
    sku: "SKU-249",
    label: "line item 249",
    quantity: 0,
  }),
  { lines: [] },
];

export const arrayShape: BenchShape = {
  name: "array",
  declares: `array of ${ARRAY_ELEMENT_COUNT} elements, 3 rules per element plus 2 length rules`,
  buildValidator: () =>
    Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(stringPatternPlugin)
      .use(numberMinPlugin)
      .use(numberIntegerPlugin)
      .use(arrayMinLengthPlugin)
      .use(arrayMaxLengthPlugin)
      .for<ArraySubject>()
      .v("lines", (field) => field.array.required().minLength(1).maxLength(500))
      .v("lines[*].sku", (field) =>
        field.string.required().pattern(/^SKU-\d+$/)
      )
      .v("lines[*].label", (field) => field.string.required().min(3))
      .v("lines[*].quantity", (field) =>
        field.number.required().integer().min(1)
      )
      .build(),
  acceptedValue: ARRAY_VALUE,
  acceptedValues: ARRAY_VALUES,
  rejectedValues: ARRAY_REJECTED,
};
