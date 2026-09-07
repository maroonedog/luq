// ===========================================================================
// bench/legacy/legacy-shapes.ts
//
// The same five shapes, declared against the 1.x sources. Every field path,
// every bound and every pattern is copied from bench/shapes/**; if the two
// ever drift the comparison stops being a comparison, so they are written side
// by side and reviewed together — and the values themselves are IMPORTED from
// the rewrite's shape modules rather than retyped, so at least the inputs
// cannot drift.
//
// Two 1.x facts established by running the code rather than by reading the
// migration notes:
//  - `lines[*].sku` IS accepted by 1.x (`lines.sku` is accepted too, but then
//    validates the ARRAY as a string and reports "Expected string"). The
//    wildcard form is therefore the honest legacy equivalent, and the
//    migration note "items.name -> items[*].name" describes a TYPE-level
//    change, not a runtime one.
//  - 1.x reaches JSON Schema through a builder EXTENSION,
//    `Builder().use(jsonSchemaFullFeaturePlugin).fromJsonSchema(doc).build()`,
//    which the rewritten core deliberately dropped in favour of a function.
// ===========================================================================
import { MULTI_FIELD_VALUE, SINGLE_FIELD_VALUE } from "../shapes/flat-shapes";
import { NESTED_VALUE } from "../shapes/nested-shape";
import { ARRAY_VALUE } from "../shapes/array-shape";
import { JSON_SCHEMA_VALUE, ORDER_SCHEMA } from "../shapes/json-schema-shape";
import type { BenchShapeName } from "../shapes/bench-shape.types";
import type { LegacyEntryLoaded } from "./load-legacy-entry";
import type { LegacyBuilder, LegacyValidator } from "./legacy-build.types";

export interface LegacyShape {
  readonly name: BenchShapeName;
  buildValidator(legacy: LegacyEntryLoaded): LegacyValidator;
  readonly acceptedValue: unknown;
}

function readPlugin(
  legacy: LegacyEntryLoaded,
  fileName: string,
  exportName: string
): unknown {
  const loaded = legacy.loadPlugin(fileName)[exportName];
  if (loaded === undefined) {
    throw new Error(`1.x plugin ${fileName} has no export ${exportName}`);
  }
  return loaded;
}

function withPlugins(
  legacy: LegacyEntryLoaded,
  names: readonly string[]
): LegacyBuilder {
  let builder = legacy.entry.Builder();
  for (const name of names) {
    builder = builder.use(readPlugin(legacy, name, `${name}Plugin`));
  }
  return builder;
}

export const legacySingleFieldShape: LegacyShape = {
  name: "singleField",
  buildValidator: (legacy) =>
    withPlugins(legacy, ["required", "stringMin"])
      .for()
      .v("name", (field) => field.string.required().min(3))
      .build(),
  acceptedValue: SINGLE_FIELD_VALUE,
};

export const legacyMultiFieldShape: LegacyShape = {
  name: "multiField",
  buildValidator: (legacy) =>
    withPlugins(legacy, [
      "required",
      "stringMin",
      "stringMax",
      "stringEmail",
      "numberMin",
      "numberMax",
    ])
      .for()
      .v("name", (field) => field.string.required().min(3).max(50))
      .v("email", (field) => field.string.required().email())
      .v("age", (field) => field.number.required().min(18).max(120))
      .build(),
  acceptedValue: MULTI_FIELD_VALUE,
};

export const legacyNestedShape: LegacyShape = {
  name: "nested",
  buildValidator: (legacy) =>
    withPlugins(legacy, ["required", "stringMin", "stringMax", "stringPattern"])
      .for()
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

export const legacyArrayShape: LegacyShape = {
  name: "array",
  buildValidator: (legacy) =>
    withPlugins(legacy, [
      "required",
      "stringMin",
      "stringPattern",
      "numberMin",
      "numberInteger",
      "arrayMinLength",
      "arrayMaxLength",
    ])
      .for()
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

export const legacyJsonSchemaShape: LegacyShape = {
  name: "jsonSchema",
  buildValidator: (legacy) => {
    const builder = withPlugins(legacy, ["jsonSchemaFullFeature"]);
    if (typeof builder.fromJsonSchema !== "function") {
      throw new Error("the 1.x entry has no Builder().fromJsonSchema");
    }
    return builder.fromJsonSchema(ORDER_SCHEMA).build();
  },
  acceptedValue: JSON_SCHEMA_VALUE,
};

export const LEGACY_SHAPES: readonly LegacyShape[] = Object.freeze([
  legacySingleFieldShape,
  legacyMultiFieldShape,
  legacyNestedShape,
  legacyArrayShape,
  legacyJsonSchemaShape,
]);
