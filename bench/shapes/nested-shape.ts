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
import type { ValuePool } from "../rotate-over-values";
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

function nestedValue(
  name: string,
  country: string,
  zip: string,
  city: string
): NestedSubject {
  return { customer: { name, address: { country, zip, city } } };
}

export const NESTED_VALUES: readonly [
  NestedSubject,
  NestedSubject,
  NestedSubject,
  NestedSubject,
] = [
  nestedValue("Alexandra", "JP", "150-0001", "Shibuya"),
  nestedValue("Benedict", "GB", "SW1A1AA", "London"),
  nestedValue("Chiyoko", "US", "94103", "San Francisco"),
  nestedValue("Dimitrios", "GR", "10431", "Athens"),
];

export const NESTED_VALUE: NestedSubject = NESTED_VALUES[0];

/**
 * One failure per level: the leaf pattern, the leaf length bound, an absent
 * leaf, and an absent intermediate object. The last one is the only member
 * that fails before the plan reaches depth 3.
 */
export const NESTED_REJECTED: ValuePool = [
  nestedValue("Alexandra", "jp", "150-0001", "Shibuya"),
  nestedValue("Alexandra", "JP", "15", "Shibuya"),
  { customer: { name: "Alexandra", address: { country: "JP", zip: "150" } } },
  { customer: { name: "Alexandra" } },
];

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
  acceptedValues: NESTED_VALUES,
  rejectedValues: NESTED_REJECTED,
};
