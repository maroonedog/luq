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
// ===========================================================================
import { Builder } from "../../src/index";
import { requiredPlugin } from "../../src/plugins/required";
import { stringMinPlugin } from "../../src/plugins/string-min";
import { stringPatternPlugin } from "../../src/plugins/string-pattern";
import { numberMinPlugin } from "../../src/plugins/number-min";
import { numberIntegerPlugin } from "../../src/plugins/number-integer";
import { arrayMinLengthPlugin } from "../../src/plugins/array-min-length";
import { arrayMaxLengthPlugin } from "../../src/plugins/array-max-length";
import type { BenchShape } from "./bench-shape.types";

export const ARRAY_ELEMENT_COUNT = 50;

export interface ArraySubject {
  readonly lines: readonly {
    readonly sku: string;
    readonly label: string;
    readonly quantity: number;
  }[];
}

export const ARRAY_VALUE: ArraySubject = {
  lines: Array.from({ length: ARRAY_ELEMENT_COUNT }, (_unused, index) => ({
    sku: `SKU-${index}`,
    label: `line item ${index}`,
    quantity: index + 1,
  })),
};

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
};
