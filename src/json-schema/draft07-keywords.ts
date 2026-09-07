// ===========================================================================
// L8  src/json-schema/draft07-keywords.ts — the WHOLE Draft-07 vocabulary,
// with one explicit decision per keyword. There is no fall-through: a keyword
// the converter meets is bound, structural, or unsupported-in-writing. The
// legacy converter stored eleven keywords it never read again (enum, contains,
// not, if/then/else, patternProperties, ...), which is the failure mode this
// exhaustive table exists to make impossible.
//
// `structural` = the CONVERTER handles it (it recurses, or it picks the slot).
// Those keywords take sub-schemas, and a sub-schema becomes a sub-CHAIN, which
// is a marker argument — so they can never be keyword bindings. That is not an
// omission; bindKeyword rejects them, and the type test proves it.
// ===========================================================================
import { structural, unsupported } from "./bind-keyword";
import type {
  KeywordHandlingFor,
  StructuralKeyword,
  UnsupportedKeyword,
} from "./keyword-binding.types";
import {
  additionalPropertiesBinding,
  constBinding,
  maxItemsBinding,
  maxLengthBinding,
  maximumBinding,
  minItemsBinding,
  minLengthBinding,
  minimumBinding,
  patternBinding,
  requiredBinding,
  uniqueItemsBinding,
} from "./draft07-bindings";

export interface Draft07Keywords {
  // --- document plumbing --------------------------------------------------
  readonly $schema: UnsupportedKeyword;
  readonly $id: UnsupportedKeyword;
  readonly $comment: UnsupportedKeyword;
  readonly $ref: StructuralKeyword;
  readonly definitions: StructuralKeyword;
  // --- annotations ---------------------------------------------------------
  readonly title: UnsupportedKeyword;
  readonly description: UnsupportedKeyword;
  readonly default: UnsupportedKeyword;
  readonly examples: UnsupportedKeyword;
  readonly readOnly: UnsupportedKeyword;
  readonly writeOnly: UnsupportedKeyword;
  // --- any instance --------------------------------------------------------
  readonly type: StructuralKeyword;
  readonly enum: StructuralKeyword;
  readonly const: KeywordHandlingFor<unknown>;
  // --- numbers -------------------------------------------------------------
  readonly minimum: KeywordHandlingFor<number>;
  readonly maximum: KeywordHandlingFor<number>;
  readonly exclusiveMinimum: UnsupportedKeyword;
  readonly exclusiveMaximum: UnsupportedKeyword;
  readonly multipleOf: UnsupportedKeyword;
  // --- strings -------------------------------------------------------------
  readonly minLength: KeywordHandlingFor<number>;
  readonly maxLength: KeywordHandlingFor<number>;
  readonly pattern: KeywordHandlingFor<string>;
  readonly format: KeywordHandlingFor<string>;
  readonly contentEncoding: UnsupportedKeyword;
  readonly contentMediaType: UnsupportedKeyword;
  // --- arrays --------------------------------------------------------------
  readonly items: StructuralKeyword;
  readonly additionalItems: StructuralKeyword;
  readonly minItems: KeywordHandlingFor<number>;
  readonly maxItems: KeywordHandlingFor<number>;
  readonly uniqueItems: KeywordHandlingFor<true>;
  readonly contains: StructuralKeyword;
  // --- objects -------------------------------------------------------------
  readonly properties: StructuralKeyword;
  readonly patternProperties: StructuralKeyword;
  readonly additionalProperties: KeywordHandlingFor<boolean>;
  readonly propertyNames: StructuralKeyword;
  readonly required: KeywordHandlingFor<true>;
  readonly dependencies: StructuralKeyword;
  readonly minProperties: UnsupportedKeyword;
  readonly maxProperties: UnsupportedKeyword;
  // --- applicators ---------------------------------------------------------
  readonly allOf: StructuralKeyword;
  readonly anyOf: StructuralKeyword;
  readonly oneOf: StructuralKeyword;
  readonly not: StructuralKeyword;
  readonly if: StructuralKeyword;
  readonly then: StructuralKeyword;
  readonly else: StructuralKeyword;
}

const NO_FORMAT_MAP_YET =
  "each Draft-07 format binds to its OWN plugin (stringEmail, stringIpv4, ...) " +
  "through the format map, which is authored one step later. There is " +
  "deliberately no caller-supplied format table: three disagreeing format " +
  "tables is what the legacy implementation shipped.";

const NO_PLUGIN_IN_FIXTURE_BAG =
  "no plugin for it in THIS fixture's bag; the shipped bag must bind it or say so here. " +
  "Nothing is dropped silently: an unsupported keyword is a written decision.";

export const draft07Keywords: Draft07Keywords = {
  $schema: unsupported("read and discarded; Luq targets Draft-07 only"),
  $id: unsupported("no base-URI resolution; local $ref only"),
  $comment: unsupported("annotation with no validation effect"),
  $ref: structural("resolved by the $ref resolver before any keyword is read"),
  definitions: structural("a container of schemas, never a constraint itself"),

  title: unsupported("annotation"),
  description: unsupported("annotation"),
  default: unsupported(
    "Luq never mutates input, so a default has nowhere to land"
  ),
  examples: unsupported("annotation"),
  readOnly: unsupported("annotation; the readOnly plugin is chain-only"),
  writeOnly: unsupported("annotation; the writeOnly plugin is chain-only"),

  type: structural(
    "chooses the slot (b.string / b.number / ...), not a method on one"
  ),
  enum: structural(
    "the allowed-value list is typed against the FIELD (the .oneOf() method " +
      "takes readonly SelfValue[]), so it carries a marker and cannot be a " +
      "binding; the converter resolves the list and calls .oneOf() itself"
  ),
  const: constBinding,

  minimum: minimumBinding,
  maximum: maximumBinding,
  exclusiveMinimum: unsupported(NO_PLUGIN_IN_FIXTURE_BAG),
  exclusiveMaximum: unsupported(NO_PLUGIN_IN_FIXTURE_BAG),
  multipleOf: unsupported(NO_PLUGIN_IN_FIXTURE_BAG),

  minLength: minLengthBinding,
  maxLength: maxLengthBinding,
  pattern: patternBinding,
  format: unsupported(NO_FORMAT_MAP_YET),
  contentEncoding: unsupported(NO_PLUGIN_IN_FIXTURE_BAG),
  contentMediaType: unsupported(NO_PLUGIN_IN_FIXTURE_BAG),

  items: structural(
    "one sub-chain per element via .each(); a tuple form drives .builder()"
  ),
  additionalItems: structural("the rest sub-chain of .builder()"),
  minItems: minItemsBinding,
  maxItems: maxItemsBinding,
  uniqueItems: uniqueItemsBinding,
  contains: structural(
    "a sub-chain applied existentially; arrayContains takes an ElementChain"
  ),

  properties: structural("expanded into one .v() per declared path"),
  patternProperties: structural(
    "a key-pattern sub-chain, not a value constraint"
  ),
  additionalProperties: additionalPropertiesBinding,
  propertyNames: structural("a sub-chain over property NAMES"),
  required: requiredBinding,
  dependencies: structural("both Draft-07 forms: a key list, or a sub-schema"),
  minProperties: unsupported(NO_PLUGIN_IN_FIXTURE_BAG),
  maxProperties: unsupported(NO_PLUGIN_IN_FIXTURE_BAG),

  allOf: structural("every sub-schema becomes a sub-chain the composite runs"),
  anyOf: structural("sub-chains combined existentially"),
  oneOf: structural(
    "sub-chains counted; exactly one must pass. NB: the `enum` keyword binds to the .oneOf() METHOD, which is a different thing"
  ),
  not: structural("one negated sub-chain"),
  if: structural("the condition sub-chain of conditionalSchema"),
  then: structural("the then sub-chain of conditionalSchema"),
  else: structural("the else sub-chain of conditionalSchema"),
};
