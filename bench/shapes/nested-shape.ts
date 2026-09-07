// ===========================================================================
// bench/shapes/nested-shape.ts
//
// Four fields reached through dotted paths, three levels deep. This is the
// shape that answers "does a nested path cost a parse per call?" — the whole
// point of compiling the plan at build() time is that `customer.address.zip`
// is turned into a reader ONCE, so this shape should not be dramatically
// slower per FIELD than the flat one. If it is, the pre-computation claim is
// not true and the number here says so.
// ===========================================================================
import { Builder } from "../../src/index";
import { requiredPlugin } from "../../src/plugins/required";
import { stringMinPlugin } from "../../src/plugins/string-min";
import { stringMaxPlugin } from "../../src/plugins/string-max";
import { stringPatternPlugin } from "../../src/plugins/string-pattern";
import type { BenchShape } from "./bench-shape.types";

export interface NestedSubject {
  readonly customer: {
    readonly name: string;
    readonly address: {
      readonly country: string;
      readonly zip: string;
      readonly city: string;
    };
  };
}

export const NESTED_VALUE: NestedSubject = {
  customer: {
    name: "Alexandra",
    address: { country: "JP", zip: "150-0001", city: "Shibuya" },
  },
};

export const nestedShape: BenchShape = {
  name: "nested",
  declares: "4 fields at depth 2-3 (customer.name, customer.address.*)",
  buildValidator: () =>
    Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(stringMaxPlugin)
      .use(stringPatternPlugin)
      .for<NestedSubject>()
      .v("customer.name", (field) => field.string.required().min(2).max(80))
      .v("customer.address.country", (field) =>
        field.string.required().pattern(/^[A-Z]{2}$/)
      )
      .v("customer.address.zip", (field) =>
        field.string.required().min(3).max(10)
      )
      .v("customer.address.city", (field) => field.string.required().min(1))
      .build(),
  acceptedValue: NESTED_VALUE,
};
