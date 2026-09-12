// ===========================================================================
// L8  src/json-schema/declare-object-keywords.ts — the object keywords: the
// three that bind, and the four object shapes that expand.
//
// THE NORMALISATIONS THE COMPILER FORCES (draft07-keyword-value.types.ts):
//   additionalProperties  a schema is a sub-CHAIN and only the boolean form
//                         binds. `declaredSiblingKeys` on the chain context is
//                         set by schema-to-declarations to THIS schema's own
//                         `properties` keys, so the plugin's allowed set is the
//                         draft's — 1.x defaulted it to the empty list and
//                         `additionalProperties: false` rejected every property.
//   dependencies          one keyword, two chain methods: a key list drives
//                         .dependentRequired(), a sub-schema .dependentSchemas().
// ===========================================================================
import { readChainRules } from "../chain/create-chain-node";
import { createFieldSlots } from "../chain/create-field-slots";
import type { Rule } from "../plugin-kit/compiled-rule";
import { isStringArray } from "../types";
import {
  assertDependenciesIsSchemaOrNameListMap,
  assertPatternPropertiesIsSchemaMap,
  assertPropertiesIsSchemaMap,
  assertPropertyNamesIsSchema,
  assertRequiredIsNameList,
} from "./assert-object-keyword-values";
import { applyAdditionalPropertiesBoolean } from "./declare-additional-properties";
import { applyKeywordBinding } from "./apply-keyword-binding";
import type { ConverterChain } from "./apply-keyword-binding";
import { toSchemaObject } from "./collect-definitions";
import type { Draft07Schema, Draft07SchemaObject } from "./draft07.types";
import type { JsonSchemaBag } from "./json-schema-bag.types";
import {
  maxPropertiesBinding,
  minPropertiesBinding,
} from "./keyword-map-object";
import type { StructuralContext } from "./structural-expansion.types";

const NO_RULES: readonly Rule[] = Object.freeze([]);

export function declareObjectRules(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  let chain: ConverterChain<"object"> = createFieldSlots<
    unknown,
    JsonSchemaBag,
    unknown
  >(context.bag, context.build).object;
  if (schema.minProperties !== undefined) {
    chain = applyKeywordBinding(
      chain,
      minPropertiesBinding,
      schema.minProperties
    );
  }
  if (schema.maxProperties !== undefined) {
    chain = applyKeywordBinding(
      chain,
      maxPropertiesBinding,
      schema.maxProperties
    );
  }
  const additional = schema.additionalProperties;
  if (typeof additional === "boolean") {
    // §6.5.4 applies to the keys matched by neither properties nor
    // patternProperties. A keyword binding can only carry its own value, so
    // when patterns are present the plugin is called directly. The binding
    // stays: it holds the keyword table and the check that the method exists.
    chain = applyAdditionalPropertiesBoolean(chain, schema, additional);
  }
  return readChainRules(chain) ?? NO_RULES;
}

/** EVERY matching pattern applies; 1.x broke after the first match. */
export function declarePatternProperties(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const patterns = schema.patternProperties;
  assertPatternPropertiesIsSchemaMap(patterns);
  if (patterns === undefined) return NO_RULES;
  const byPattern: Record<string, readonly Rule[]> = {};
  for (const [pattern, member] of Object.entries(patterns)) {
    byPattern[pattern] = context.collectSubSchemaRules(member);
  }
  const plugin = context.bag.objectPatternProperties;
  return Object.freeze([
    plugin.build(
      context.ruleContextFor(plugin.name, "patternProperties"),
      Object.freeze(byPattern)
    ),
  ]);
}

/** A sub-chain over the property NAMES, which are always strings. */
export function declarePropertyNames(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const names = schema.propertyNames;
  assertPropertyNamesIsSchema(names);
  if (names === undefined) return NO_RULES;
  const plugin = context.bag.objectPropertyNames;
  return Object.freeze([
    plugin.build(
      context.ruleContextFor(plugin.name, "propertyNames"),
      context.collectSubSchemaRules(names)
    ),
  ]);
}

function splitDependencies(
  dependencies: Readonly<Record<string, Draft07Schema | readonly string[]>>
): {
  readonly required: Record<string, readonly string[]>;
  readonly schemas: Record<string, Draft07Schema>;
} {
  const required: Record<string, readonly string[]> = {};
  const schemas: Record<string, Draft07Schema> = {};
  for (const [key, dependency] of Object.entries(dependencies)) {
    if (isStringArray(dependency)) {
      required[key] = dependency;
      continue;
    }
    schemas[key] = toSchemaObject(dependency);
  }
  return { required, schemas };
}

export function declareDependencies(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const dependencies = schema.dependencies;
  assertDependenciesIsSchemaOrNameListMap(dependencies);
  if (dependencies === undefined) return NO_RULES;
  const split = splitDependencies(dependencies);
  const rules: Rule[] = [];
  if (Object.keys(split.required).length > 0) {
    const plugin = context.bag.objectDependentRequired;
    rules.push(
      plugin.build(
        context.ruleContextFor(plugin.name, "dependencies"),
        Object.freeze(split.required)
      )
    );
  }
  const schemaKeys = Object.keys(split.schemas);
  if (schemaKeys.length > 0) {
    const byKey: Record<string, readonly Rule[]> = {};
    for (const key of schemaKeys) {
      const member = split.schemas[key];
      if (member === undefined) continue;
      byKey[key] = context.collectSubSchemaRules(member);
    }
    const plugin = context.bag.objectDependentSchemas;
    rules.push(
      plugin.build(
        context.ruleContextFor(plugin.name, "dependencies"),
        Object.freeze(byKey)
      )
    );
  }
  return Object.freeze(rules);
}

/**
 * `properties` becomes one declared path per key; see flatten-schema.ts.
 *
 * Every child is declared NOT required here: requiredness belongs to the object
 * (declareRequiredProperties). A name in `required` with no `properties` entry
 * still gets a path on the empty schema, because §6.5.3 makes the two keywords
 * independent and the root distribution needs the path to exist.
 *
 * Both keywords are first READ here, for the root and for every nested node
 * alike, so this is where both are checked. Unchecked, a string `required` is
 * iterated character by character and every character becomes a declared path.
 */
export function readPropertyChildren(
  schema: Draft07SchemaObject
): readonly { step: string; schema: Draft07Schema; isRequired: boolean }[] {
  assertPropertiesIsSchemaMap(schema.properties);
  assertRequiredIsNameList(schema.required);
  const properties = schema.properties ?? {};
  const required = schema.required ?? [];
  const children = Object.entries(properties).map(([key, member]) => ({
    step: key,
    schema: member,
    isRequired: false,
  }));
  for (const key of required) {
    if (Object.prototype.hasOwnProperty.call(properties, key)) continue;
    children.push({ step: key, schema: true, isRequired: false });
  }
  return Object.freeze(children);
}
