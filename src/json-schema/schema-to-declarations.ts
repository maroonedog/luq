// ===========================================================================
// L8  src/json-schema/schema-to-declarations.ts — THE DISPATCHER.
//
// Two things live here and nothing else:
//   1. STRUCTURAL_EXPANSIONS, total over `StructuralKeyword`. A structural
//      keyword with no expansion does not compile, so "the table says it is
//      handled and nothing handles it" — the 1.x failure mode, and the failure
//      the step-24 review predicted would come back as a prose `note` — cannot
//      be written.
//   2. expandSchemaRules, which walks the schema's OWN KEYS and dispatches
//      every one of them. Nothing is reached by a hard-coded list of the
//      keywords somebody remembered, so a keyword present in the document is
//      either expanded, bound, ignored as an annotation, or thrown on.
// ===========================================================================
import type { Rule } from "../plugin-kit/compiled-rule";
import { isDefinitionContainer } from "./collect-definitions";
import { composeConditional } from "./compose-conditional";
import {
  composeAllOf,
  composeAnyOf,
  composeNot,
  composeOneOf,
} from "./compose-keyword";
import {
  declareAdditionalPropertiesSchema,
  declareDependencies,
  declareObjectRules,
  declarePatternProperties,
  declarePropertyNames,
  readPropertyChildren,
} from "./declare-object-keywords";
import { declareRequiredProperties } from "./declare-required-properties";
import {
  declareFormatRules,
  declareNumberRules,
  declareStringRules,
} from "./declare-scalar-keywords";
import {
  declareConstRules,
  declareEnumRules,
  declareIntegerRules,
  declareTypeRules,
} from "./declare-value-keywords";
import type { Draft07SchemaObject } from "./draft07.types";
import {
  composeContains,
  composeTupleItems,
  declareArrayRules,
  readItemChildren,
} from "./flatten-array-schema";
import { NON_DRAFT07_KEYWORDS, findKeywordHandling } from "./keyword-map";
import type {
  ChildSchema,
  StructuralContext,
  StructuralExpansionTable,
  StructuralKeyword,
} from "./structural-expansion.types";
import {
  readChildExpansion,
  readRuleExpansion,
} from "./structural-expansion.types";
import { UnsupportedKeywordError } from "./unsupported-keyword-error";

const CONSUMED_BY_IF = "inert without `if` (Draft-07 §6.6.2); composed there";

export const STRUCTURAL_EXPANSIONS: StructuralExpansionTable = {
  $ref: {
    expandsTo: "consumed",
    consumedBy: "resolve-ref",
    reason: "the node is replaced before any keyword is read",
  },
  definitions: {
    expandsTo: "consumed",
    consumedBy: "collect-definitions",
    reason: "a container of schemas, never a constraint",
  },
  type: {
    expandsTo: "rules",
    toRules: (schema, context) => [
      ...declareTypeRules(schema, context),
      ...declareIntegerRules(schema, context),
    ],
  },
  enum: { expandsTo: "rules", toRules: declareEnumRules },
  allOf: { expandsTo: "rules", toRules: composeAllOf },
  anyOf: { expandsTo: "rules", toRules: composeAnyOf },
  oneOf: { expandsTo: "rules", toRules: composeOneOf },
  not: { expandsTo: "rules", toRules: composeNot },
  if: { expandsTo: "rules", toRules: composeConditional },
  then: {
    expandsTo: "consumed",
    consumedBy: "compose-conditional",
    reason: CONSUMED_BY_IF,
  },
  else: {
    expandsTo: "consumed",
    consumedBy: "compose-conditional",
    reason: CONSUMED_BY_IF,
  },
  format: { expandsTo: "rules", toRules: declareFormatRules },
  items: {
    expandsTo: "rules-and-declarations",
    toRules: composeTupleItems,
    toChildren: readItemChildren,
  },
  additionalItems: {
    expandsTo: "consumed",
    consumedBy: "flatten-array-schema",
    reason: "the rest branch of the tuple form of `items`",
  },
  contains: { expandsTo: "rules", toRules: composeContains },
  properties: { expandsTo: "declarations", toChildren: readPropertyChildren },
  patternProperties: { expandsTo: "rules", toRules: declarePatternProperties },
  dependencies: { expandsTo: "rules", toRules: declareDependencies },
  propertyNames: { expandsTo: "rules", toRules: declarePropertyNames },
};

export function isStructuralKeyword(name: string): name is StructuralKeyword {
  return Object.prototype.hasOwnProperty.call(STRUCTURAL_EXPANSIONS, name);
}

/** Every child path a schema declares: `properties` keys and `items`' `[*]`. */
export function readChildSchemas(
  schema: Draft07SchemaObject
): readonly ChildSchema[] {
  const children: ChildSchema[] = [];
  for (const expansion of Object.values(STRUCTURAL_EXPANSIONS)) {
    const toChildren = readChildExpansion(expansion);
    if (toChildren === undefined) continue;
    children.push(...toChildren(schema));
  }
  return Object.freeze(children);
}

/**
 * A name the table does not know is an ANNOTATION and is ignored (Draft-07
 * §4.3.2). A name Luq recognises as belonging to another dialect is not: it
 * would change the meaning of the document, so it is refused by name.
 */
function assertKeywordIsConvertible(keyword: string): void {
  if (findKeywordHandling(keyword) !== undefined) return;
  if (isDefinitionContainer(keyword)) return;
  const note = NON_DRAFT07_KEYWORDS[keyword];
  if (note !== undefined) throw new UnsupportedKeywordError(keyword, note);
}

/** The rules a schema imposes ON ITS OWN SUBJECT, children excluded. */
export function expandSchemaRules(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const rules: Rule[] = [
    ...declareStringRules(schema, context),
    ...declareNumberRules(schema, context),
    ...declareArrayRules(schema, context),
    ...declareObjectRules(schema, context),
    ...declareConstRules(schema, context),
    ...declareAdditionalPropertiesSchema(schema, context),
    ...declareRequiredProperties(schema, context),
  ];
  for (const keyword of Object.keys(schema)) {
    assertKeywordIsConvertible(keyword);
  }
  // Driven by the TABLE, not by the keys somebody remembered to look at: every
  // expansion self-gates on its own keyword, so a structural keyword can never
  // be present in the document and unreached here.
  for (const expansion of Object.values(STRUCTURAL_EXPANSIONS)) {
    const toRules = readRuleExpansion(expansion);
    if (toRules === undefined) continue;
    rules.push(...toRules(schema, context));
  }
  return Object.freeze(rules);
}
