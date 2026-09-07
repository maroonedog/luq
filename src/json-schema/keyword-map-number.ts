// ===========================================================================
// L8  src/json-schema/keyword-map-number.ts — the five numeric keywords.
//
// All five bind. Draft-07 spells the strict bounds as SEPARATE numeric
// keywords (`exclusiveMinimum: 5`), while numberMin/numberMax spell them as
// the same method with a second argument (`.min(5, true)`). That is the whole
// difference, and it is written once, here, rather than being re-decided at
// each call site the way 1.x re-decided it in three places.
// ===========================================================================
import { bindKeyword } from "./bind-keyword";
import type { KeywordTable } from "./keyword-binding.types";
import type { Draft07NumberKeyword } from "./draft07-keyword-value.types";
import { numberMinPlugin } from "../plugins/number-min";
import { numberMaxPlugin } from "../plugins/number-max";
import { numberMultipleOfPlugin } from "../plugins/number-multiple-of";

export const minimumBinding = bindKeyword(
  "number",
  "min",
  numberMinPlugin,
  (v: number) => [v] as const
);

export const maximumBinding = bindKeyword(
  "number",
  "max",
  numberMaxPlugin,
  (v: number) => [v] as const
);

/** Draft-07 §6.2.5: the bound itself is excluded. Hence the trailing `true`. */
export const exclusiveMinimumBinding = bindKeyword(
  "number",
  "min",
  numberMinPlugin,
  (v: number) => [v, true] as const
);

export const exclusiveMaximumBinding = bindKeyword(
  "number",
  "max",
  numberMaxPlugin,
  (v: number) => [v, true] as const
);

/**
 * numberMultipleOf compares scaled integers, so `multipleOf: 0.1` accepts 0.3
 * — the float-modulo answer 1.x gave here was wrong and is not reproduced.
 */
export const multipleOfBinding = bindKeyword(
  "number",
  "multipleOf",
  numberMultipleOfPlugin,
  (v: number) => [v] as const
);

export const numberKeywordMap: KeywordTable<Draft07NumberKeyword> = {
  multipleOf: multipleOfBinding,
  maximum: maximumBinding,
  exclusiveMaximum: exclusiveMaximumBinding,
  minimum: minimumBinding,
  exclusiveMinimum: exclusiveMinimumBinding,
};
