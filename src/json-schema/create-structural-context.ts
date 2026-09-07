// ===========================================================================
// L8  src/json-schema/create-structural-context.ts — what an expansion may
// reach, and the knot that lets the conversion recurse without a cycle.
//
// ONE CONTEXT PER SCHEMA NODE, not one per field. `declaredSiblingKeys` is that
// node's own `properties` keys, because objectAdditionalProperties reads its
// allowed set from there: a sub-schema inside a branch must not inherit the
// outer field's declared children, or `additionalProperties: false` would judge
// the wrong key set.
//
// `collectSubSchemaRules` and `toBranch` are handed in rather than imported by
// the expansions, so compose-keyword can convert its own arms while
// schema-to-declarations can dispatch to compose-keyword: the two would import
// each other otherwise. This module is the single supplier of both.
//
// `visitedRefs` is the recursion guard. A `$ref` that comes round a second time
// on the same branch is a RECURSIVE definition; its expansion does not
// terminate, so the sub-schema converter stops there and the node keeps only
// the rules it already has. objectRecursively is the plugin for that shape and
// it is not in the JSON Schema bag.
// ===========================================================================
import type { ChainBuildContext } from "../chain/create-chain-node";
import type { Rule } from "../plugin-kit/compiled-rule";
import type { RuleBuildContext } from "../plugin-kit/rule-build-context";
import type { MessageContextExtra } from "../types";
import { readRefPointer, resolveSchemaNode } from "./collect-definitions";
import {
  collectSubSchemaRules,
  toSchemaBranch,
} from "./collect-sub-schema-rules";
import type { Draft07Schema, Draft07SchemaObject } from "./draft07.types";
import type { JsonSchemaBag } from "./json-schema-bag.types";
import type { StructuralContext } from "./structural-expansion.types";

const NO_RULES: readonly Rule[] = Object.freeze([]);

export interface ConversionSeed {
  readonly bag: JsonSchemaBag;
  readonly root: Draft07Schema;
  readonly chain: ChainBuildContext;
}

function propertyKeysOf(schema: Draft07SchemaObject): readonly string[] {
  return Object.freeze(Object.keys(schema.properties ?? {}));
}

export function createStructuralContext(
  seed: ConversionSeed,
  node: Draft07SchemaObject,
  visitedRefs: readonly string[]
): StructuralContext {
  const build: ChainBuildContext = {
    fieldPath: seed.chain.fieldPath,
    declaredSiblingKeys: propertyKeysOf(node),
    config: seed.chain.config,
  };
  const descend = (schema: Draft07Schema): StructuralContext | undefined => {
    const pointer = readRefPointer(schema);
    if (pointer !== undefined && visitedRefs.includes(pointer)) {
      return undefined;
    }
    const seen =
      pointer === undefined ? visitedRefs : [...visitedRefs, pointer];
    return createStructuralContext(
      seed,
      resolveSchemaNode(schema, seed.root),
      seen
    );
  };
  const ruleContextFor = <C extends MessageContextExtra>(
    pluginName: string,
    code: string
  ): RuleBuildContext<C> => ({
    pluginName,
    code,
    severity: build.config.defaultSeverity,
    config: build.config,
    fieldPath: build.fieldPath,
    declaredSiblingKeys: build.declaredSiblingKeys,
  });
  return {
    bag: seed.bag,
    build,
    root: seed.root,
    visitedRefs,
    collectSubSchemaRules: (schema) => {
      const child = descend(schema);
      return child === undefined
        ? NO_RULES
        : collectSubSchemaRules(schema, child);
    },
    toBranch: (label, schema) => {
      const child = descend(schema);
      return child === undefined
        ? { label, rules: NO_RULES, fields: [] }
        : toSchemaBranch(label, schema, child);
    },
    ruleContextFor,
  };
}
