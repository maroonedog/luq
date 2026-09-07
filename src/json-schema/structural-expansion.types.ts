// ===========================================================================
// L8  src/json-schema/structural-expansion.types.ts
//
// THE DEFECT THIS FILE EXISTS TO KILL: step 24 recorded "structural" as
// `{ handling: "structural"; note: string }`. A note is prose. Nothing made the
// converter READ it, so forgetting to recurse into `not` would have been as
// silent as 1.x's `chain.minItems` — the table would still say the keyword was
// handled while no rule was ever produced.
//
// A structural keyword is therefore a TYPED HANDLE here. `StructuralExpansion`
// is a discriminated union in which every member carries the FUNCTION that
// performs the expansion, and `StructuralExpansionTable` is total over
// `StructuralKeyword`, so:
//   * a structural keyword with no expansion is TS2739 (missing property);
//   * an expansion for something that is not a structural keyword is TS2353;
//   * an entry that claims `expandsTo: "rules"` and supplies no `toRules` does
//     not type-check, because the union member requires the member.
// The one escape — `expandsTo: "consumed"` — must name WHICH module consumes
// the keyword, from a closed union of module names, so "somebody else does it"
// cannot be written without saying who.
// ===========================================================================
import type { ChainBuildContext } from "../chain/create-chain-node";
import type { CompositeBranch, Rule } from "../plugin-kit/compiled-rule";
import type { RuleBuildContext } from "../plugin-kit/rule-build-context";
import type { MessageContextExtra } from "../types";
import type { Draft07Schema, Draft07SchemaObject } from "./draft07.types";
import type { JsonSchemaBag } from "./json-schema-bag.types";

/**
 * The nineteen keywords `draft07KeywordMap` marks `structural`. Written out by
 * hand so the table below can be total over it; a runtime test in
 * test/unit/json-schema/convert/ asserts this union has EXACTLY the members the
 * keyword map marks structural, in both directions, so the two cannot drift.
 */
export type StructuralKeyword =
  | "$ref"
  | "definitions"
  | "type"
  | "enum"
  | "allOf"
  | "anyOf"
  | "oneOf"
  | "not"
  | "if"
  | "then"
  | "else"
  | "format"
  | "items"
  | "additionalItems"
  | "contains"
  | "properties"
  | "patternProperties"
  | "dependencies"
  | "propertyNames";

/**
 * One step down from a schema to a sub-schema that gets its OWN declared path.
 * `step` is already in the L1 path grammar: `.name` for a property, `[*]` for
 * an array element, so joining is concatenation and never string surgery.
 */
export interface ChildSchema {
  readonly step: string;
  readonly schema: Draft07Schema;
  readonly isRequired: boolean;
}

/**
 * What an expansion may reach. `collectSubSchemaRules` and `toBranch` are
 * INJECTED rather than imported: compose-keyword needs to convert its own
 * sub-schemas, and schema-to-declarations needs compose-keyword, so importing
 * either way round would close a cycle. schema-to-declarations is the single
 * supplier of both.
 */
export interface StructuralContext {
  readonly bag: JsonSchemaBag;
  readonly build: ChainBuildContext;
  readonly root: Draft07Schema;
  /**
   * The `$ref` pointers already entered on this branch of the conversion. A
   * repeat is a RECURSIVE definition, whose expansion does not terminate, so
   * the sub-schema converter stops there instead of building forever.
   */
  readonly visitedRefs: readonly string[];
  /** Rules a SUB-schema imposes on the SAME subject (allOf arms, if/then). */
  collectSubSchemaRules(schema: Draft07Schema): readonly Rule[];
  /** A sub-schema as one composite branch: own rules plus relative fields. */
  toBranch(label: string, schema: Draft07Schema): CompositeBranch;
  /**
   * What a bag plugin's `build()` needs. Written once here so no expansion
   * assembles a RuleBuildContext of its own and drifts on severity or code.
   */
  ruleContextFor<C extends MessageContextExtra>(
    pluginName: string,
    code: string
  ): RuleBuildContext<C>;
}

export type ExpandToRules = (
  schema: Draft07SchemaObject,
  context: StructuralContext
) => readonly Rule[];

export type ExpandToChildren = (
  schema: Draft07SchemaObject
) => readonly ChildSchema[];

/** The modules allowed to consume a keyword on another keyword's behalf. */
export type StructuralConsumer =
  | "resolve-ref"
  | "collect-definitions"
  | "compose-conditional"
  | "flatten-array-schema";

interface RulesExpansion {
  readonly expandsTo: "rules";
  readonly toRules: ExpandToRules;
}

interface ChildrenExpansion {
  readonly expandsTo: "declarations";
  readonly toChildren: ExpandToChildren;
}

interface RulesAndChildrenExpansion {
  readonly expandsTo: "rules-and-declarations";
  readonly toRules: ExpandToRules;
  readonly toChildren: ExpandToChildren;
}

/** The only entry with no function, and it must name its consumer. */
interface ConsumedExpansion {
  readonly expandsTo: "consumed";
  readonly consumedBy: StructuralConsumer;
  readonly reason: string;
}

export type StructuralExpansion =
  | RulesExpansion
  | ChildrenExpansion
  | RulesAndChildrenExpansion
  | ConsumedExpansion;

/** Total over the vocabulary: a forgotten recursion is a compile error. */
export type StructuralExpansionTable = {
  readonly [Keyword in StructuralKeyword]: StructuralExpansion;
};

/** Narrows an expansion to the ones that contribute rules at this path. */
export function readRuleExpansion(
  expansion: StructuralExpansion
): ExpandToRules | undefined {
  if (expansion.expandsTo === "rules") return expansion.toRules;
  if (expansion.expandsTo === "rules-and-declarations") {
    return expansion.toRules;
  }
  return undefined;
}

/** Narrows an expansion to the ones that contribute child declarations. */
export function readChildExpansion(
  expansion: StructuralExpansion
): ExpandToChildren | undefined {
  if (expansion.expandsTo === "declarations") return expansion.toChildren;
  if (expansion.expandsTo === "rules-and-declarations") {
    return expansion.toChildren;
  }
  return undefined;
}
