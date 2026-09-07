// ===========================================================================
// test/type/json-schema/keyword-vocabulary.type-test.ts
//
// The gates that keep the vocabulary honest. Every negative directive below is
// a MUTATION SITE: delete the directive and the build must fail with the
// quoted reason. TS2578 (unused directive) is a CI failure, so a gate that
// stops working is reported as loudly as a broken one.
// ===========================================================================
import type {
  Draft07ArrayKeyword,
  Draft07Keyword,
  Draft07KeywordValues,
  Draft07NumberKeyword,
} from "../../../src/json-schema/draft07-keyword-value.types";
import type {
  KeywordHandlingFor,
  KeywordTable,
} from "../../../src/json-schema/keyword-binding.types";
import type { ConverterChain } from "../../../src/json-schema/apply-keyword-binding";
import type { AnyChain } from "../../../src/chain/field-chain.types";
import type { Draft07Format } from "../../../src/json-schema/format-map";
import { structural, unsupported } from "../../../src/json-schema/bind-keyword";
import {
  maxItemsBinding,
  minItemsBinding,
  uniqueItemsBinding,
} from "../../../src/json-schema/keyword-map-array";
import { draft07KeywordMap } from "../../../src/json-schema/keyword-map";
import { draft07FormatMap } from "../../../src/json-schema/format-map";

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Assert<T extends true> = T;

// ------------------ 1. a keyword cannot lose its value type ----------------
// The union and the record are written separately, on purpose: one of them is
// the vocabulary, the other is what each keyword's handling receives. If they
// stop agreeing, this line stops compiling.
export type ValuesCoverTheVocabulary = Assert<
  Equals<keyof Draft07KeywordValues, Draft07Keyword>
>;

// The categories partition the vocabulary; none of them may overlap or leak.
export type ArrayKeywordsAreKeywords = Assert<
  Equals<Exclude<Draft07ArrayKeyword, Draft07Keyword>, never>
>;
export type NumberKeywordsAreKeywords = Assert<
  Equals<Exclude<Draft07NumberKeyword, Draft07Keyword>, never>
>;
export type CategoriesDoNotOverlap = Assert<
  Equals<Extract<Draft07ArrayKeyword, Draft07NumberKeyword>, never>
>;

// The normalisations are part of the contract, so they are asserted, not
// merely commented: the WIDE Draft-07 form cannot reach a handling.
export type UniqueItemsIsNarrowedToTrue = Assert<
  Equals<Draft07KeywordValues["uniqueItems"], true>
>;
export type RequiredIsNarrowedToAFlag = Assert<
  Equals<Draft07KeywordValues["required"], true>
>;
export type AdditionalPropertiesIsNarrowedToBoolean = Assert<
  Equals<Draft07KeywordValues["additionalProperties"], boolean>
>;

// --------------- 2. a category table is total and closed -------------------
// A keyword left out is TS2739; a keyword that is not in the vocabulary is an
// excess property. Both are compile errors, which is the only reason writing
// the vocabulary down is worth anything.
export const completeArrayTable: KeywordTable<Draft07ArrayKeyword> = {
  items: structural("a sub-chain"),
  additionalItems: structural("a sub-chain"),
  maxItems: maxItemsBinding,
  minItems: minItemsBinding,
  uniqueItems: uniqueItemsBinding,
  contains: structural("a sub-chain"),
};

// @ts-expect-error `contains` is missing from the table
export const tableMissingAKeyword: KeywordTable<Draft07ArrayKeyword> = {
  items: structural("a sub-chain"),
  additionalItems: structural("a sub-chain"),
  maxItems: maxItemsBinding,
  minItems: minItemsBinding,
  uniqueItems: uniqueItemsBinding,
};

export const tableWithAnInventedKeyword: KeywordTable<Draft07ArrayKeyword> = {
  items: structural("a sub-chain"),
  additionalItems: structural("a sub-chain"),
  maxItems: maxItemsBinding,
  minItems: minItemsBinding,
  uniqueItems: uniqueItemsBinding,
  contains: structural("a sub-chain"),
  // @ts-expect-error "prefixItems" is 2020-12, not a Draft-07 keyword
  prefixItems: structural("a sub-chain"),
};

export const tableWithAKeywordFromAnotherCategory: KeywordTable<Draft07ArrayKeyword> =
  {
    items: structural("a sub-chain"),
    additionalItems: structural("a sub-chain"),
    maxItems: maxItemsBinding,
    minItems: minItemsBinding,
    uniqueItems: uniqueItemsBinding,
    contains: structural("a sub-chain"),
    // @ts-expect-error `minimum` is a NUMBER keyword; it belongs to another table
    minimum: unsupported("wrong category"),
  };

// A binding for the wrong keyword's value type cannot be filed either.
export const arrayTableWithAMismatchedBinding: KeywordTable<Draft07ArrayKeyword> =
  {
    items: structural("a sub-chain"),
    additionalItems: structural("a sub-chain"),
    // @ts-expect-error minItems carries a number; uniqueItemsBinding takes `true`
    maxItems: uniqueItemsBinding,
    minItems: minItemsBinding,
    uniqueItems: uniqueItemsBinding,
    contains: structural("a sub-chain"),
  };

// --------------- 3. the shipped tables really are those types --------------
export type ShippedMapIsTotal = Assert<
  Equals<keyof typeof draft07KeywordMap, Draft07Keyword>
>;
export type FormatMapIsTotal = Assert<
  Equals<keyof typeof draft07FormatMap, Draft07Format>
>;
/** `format` carries a string in the document; the table entry agrees. */
export type FormatKeywordCarriesAString = Assert<
  Equals<Draft07KeywordValues["format"], string>
>;
declare const someHandling: KeywordHandlingFor<number>;
export type HandlingIsAClosedUnion = Assert<
  Equals<
    typeof someHandling.handling extends "bind" | "structural" | "unsupported"
      ? true
      : false,
    true
  >
>;

// --------------- 4. the converter's slice is a real chain ------------------
// Without this, whatever the converter hands back from `.v(path, b => ...)`
// has to be asserted onto the builder, and an assertion is exactly the hole
// this layer exists to close.
export type ConverterChainIsAChain = Assert<
  [ConverterChain<"array">] extends [AnyChain] ? true : false
>;
