// ===========================================================================
// L8  src/json-schema/keyword-map-object.ts — the eight object keywords.
//
// Two entries carry a normalisation the compiler enforces:
//
//   required               Draft-07 puts a string ARRAY on the PARENT. A
//                          binding applies to one field, so the converter
//                          resolves the array into one `true` per named child
//                          before it can reach this binding. The value type is
//                          `true`, so the unresolved array cannot be passed.
//   additionalProperties   Draft-07 allows a schema OR a boolean. The schema
//                          form is a sub-CHAIN (.additionalPropertiesSchema())
//                          and no binding can take one; the boolean form binds
//                          here. The value type is `boolean`, so the schema
//                          form cannot reach this entry by accident.
// ===========================================================================
import { bindKeyword, structural } from "./bind-keyword";
import type { KeywordTable } from "./keyword-binding.types";
import type { Draft07ObjectKeyword } from "./draft07-keyword-value.types";
import { requiredPlugin } from "../plugins/required";
import { objectMinPropertiesPlugin } from "../plugins/object-min-properties";
import { objectMaxPropertiesPlugin } from "../plugins/object-max-properties";
import { objectAdditionalPropertiesPlugin } from "../plugins/object-additional-properties";

export const minPropertiesBinding = bindKeyword(
  "object",
  "minProperties",
  objectMinPropertiesPlugin,
  (v: number) => [v] as const
);

export const maxPropertiesBinding = bindKeyword(
  "object",
  "maxProperties",
  objectMaxPropertiesPlugin,
  (v: number) => [v] as const
);

/**
 * Slot "any": requiredPlugin's `slots` is the whole TypeName list, so
 * `.required()` is reachable on every field chain, which is exactly what a
 * presence flag needs — the parent does not know the child's slot.
 */
export const requiredBinding = bindKeyword(
  "any",
  "required",
  requiredPlugin,
  (_v: true) => [] as const
);

/**
 * The boolean form only. objectAdditionalProperties defaults its allowed set
 * to the declared sibling keys, so `additionalProperties: false` no longer
 * rejects every property the way 1.x's empty `allowedProperties` default did.
 */
export const additionalPropertiesBinding = bindKeyword(
  "object",
  "additionalProperties",
  objectAdditionalPropertiesPlugin,
  (v: boolean) => [v] as const
);

export const objectKeywordMap: KeywordTable<Draft07ObjectKeyword> = {
  maxProperties: maxPropertiesBinding,
  minProperties: minPropertiesBinding,
  required: requiredBinding,
  properties: structural("expanded into one .v() per declared path"),
  patternProperties: structural(
    "one sub-chain per key pattern; EVERY matching pattern applies, which the " +
      "break-after-first of 1.x did not do"
  ),
  additionalProperties: additionalPropertiesBinding,
  dependencies: structural(
    "both Draft-07 forms: a key list drives .dependentRequired(), a sub-schema " +
      "drives .dependentSchemas(). One keyword, two chain methods, so the " +
      "converter must branch and no single binding can express it"
  ),
  propertyNames: structural("a sub-chain over property NAMES, not values"),
};
