// ===========================================================================
// L8  src/json-schema/declare-additional-properties.ts
// Both forms of `additionalProperties`, and the `patternProperties` that
// decides what they apply to.
//
// These three close over each other: §6.5.4 defines the subject as the keys
// matched by neither `properties` nor `patternProperties`, so nothing else
// is needed to answer it and nothing else needs to know how.
// ===========================================================================
import type { Rule } from "../plugin-kit/compiled-rule";
import { assertAdditionalPropertiesIsSchema } from "./assert-object-keyword-values";
import { applyKeywordBinding } from "./apply-keyword-binding";
import type { ConverterChain } from "./apply-keyword-binding";
import type { Draft07SchemaObject } from "./draft07.types";
import { additionalPropertiesBinding } from "./keyword-map-object";
import type { StructuralContext } from "./structural-expansion.types";

const NO_RULES: readonly Rule[] = Object.freeze([]);

/**
 * The keys of `patternProperties`, which are regular expression strings.
 * additionalProperties needs them to pick out the keys that match none.
 */
export function patternPropertyKeys(
  schema: Draft07SchemaObject
): readonly string[] {
  const patterns = schema.patternProperties;
  if (patterns === undefined || patterns === null) return Object.freeze([]);
  return Object.freeze(Object.keys(patterns));
}

/**
 * The BOOLEAN form.
 *
 * A keyword binding can only carry its own value, so when patterns are present
 * the plugin is called directly. The binding stays either way: it is what
 * holds the keyword table and the compile-time check that the method exists.
 */
export function applyAdditionalPropertiesBoolean(
  chain: ConverterChain<"object">,
  schema: Draft07SchemaObject,
  allowed: boolean
): ConverterChain<"object"> {
  const patterns = patternPropertyKeys(schema);
  return patterns.length === 0
    ? applyKeywordBinding(chain, additionalPropertiesBinding, allowed)
    : chain.additionalProperties(allowed, undefined, patterns);
}

/**
 * The SCHEMA form: whatever matches neither a declaration nor a pattern
 * follows it.
 *
 * This is the ONE place a non-boolean `additionalProperties` is consumed — the
 * boolean form is taken by declareObjectRules before this runs — so it is
 * where the value is checked. A string or a number reaching the sub-schema
 * route is not a schema, expands to no rules, and turns
 * `{"additionalProperties":"false"}` into an object that accepts every extra
 * property; the check refuses it instead. Both well-formed forms are untouched.
 */
export function declareAdditionalPropertiesSchema(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const additional = schema.additionalProperties;
  assertAdditionalPropertiesIsSchema(additional);
  if (additional === undefined || typeof additional === "boolean") {
    return NO_RULES;
  }
  const plugin = context.bag.objectAdditionalPropertiesSchema;
  return Object.freeze([
    plugin.build(
      context.ruleContextFor(plugin.name, "additionalProperties"),
      context.collectSubSchemaRules(additional),
      undefined,
      patternPropertyKeys(schema)
    ),
  ]);
}
