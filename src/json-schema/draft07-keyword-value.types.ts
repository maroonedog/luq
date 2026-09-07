// ===========================================================================
// L8  src/json-schema/draft07-keyword-value.types.ts
//
// The Draft-07 vocabulary as five category unions, and the NORMALISED value
// each keyword's handling receives. Two separate jobs, on purpose:
//
//   * `Draft07Schema` (draft07.types.ts) is as wide as the specification.
//   * `Draft07KeywordValues` is as narrow as the handling can accept.
//
// Where they differ, the difference is the converter's obligation, enforced by
// the compiler rather than by a comment:
//   uniqueItems  boolean -> true            `false` is defined to be a no-op,
//                                           so applying the binding for it
//                                           would ADD a constraint the schema
//                                           does not state. The converter
//                                           cannot reach the binding without
//                                           narrowing first.
//   required     string[] -> true           the parent's array is resolved to
//                                           one flag per child field.
//   contentEncoding string -> a known name  an unrecognised encoding must be
//                                           refused, not silently accepted.
//   additionalProperties Draft07Schema -> boolean
//                                           the sub-schema form is a sub-CHAIN
//                                           and is expanded structurally; only
//                                           the boolean form binds.
//
// `Draft07Keyword` is written out by hand and `keyof Draft07KeywordValues` is
// asserted equal to it in the type test, so a keyword can never lose its value
// type by being added to only one of the two.
// ===========================================================================
import type { ContentEncodingName } from "../plugins/string-content-encoding";
import type { Draft07Schema, Draft07TypeKeyword } from "./draft07.types";

export type Draft07CoreKeyword =
  | "$schema"
  | "$id"
  | "$ref"
  | "$comment"
  | "definitions"
  | "title"
  | "description"
  | "default"
  | "examples"
  | "readOnly"
  | "writeOnly"
  | "type"
  | "enum"
  | "const"
  | "allOf"
  | "anyOf"
  | "oneOf"
  | "not"
  | "if"
  | "then"
  | "else";

export type Draft07NumberKeyword =
  | "multipleOf"
  | "maximum"
  | "exclusiveMaximum"
  | "minimum"
  | "exclusiveMinimum";

export type Draft07StringKeyword =
  | "maxLength"
  | "minLength"
  | "pattern"
  | "format"
  | "contentEncoding"
  | "contentMediaType";

export type Draft07ArrayKeyword =
  | "items"
  | "additionalItems"
  | "maxItems"
  | "minItems"
  | "uniqueItems"
  | "contains";

export type Draft07ObjectKeyword =
  | "maxProperties"
  | "minProperties"
  | "required"
  | "properties"
  | "patternProperties"
  | "additionalProperties"
  | "dependencies"
  | "propertyNames";

/** All 46 Draft-07 keywords. Written by hand; checked against the record. */
export type Draft07Keyword =
  | Draft07CoreKeyword
  | Draft07NumberKeyword
  | Draft07StringKeyword
  | Draft07ArrayKeyword
  | Draft07ObjectKeyword;

export interface Draft07KeywordValues {
  readonly $schema: string;
  readonly $id: string;
  readonly $ref: string;
  readonly $comment: string;
  readonly definitions: Readonly<Record<string, Draft07Schema>>;
  readonly title: string;
  readonly description: string;
  readonly default: unknown;
  readonly examples: readonly unknown[];
  readonly readOnly: boolean;
  readonly writeOnly: boolean;
  readonly type: Draft07TypeKeyword | readonly Draft07TypeKeyword[];
  readonly enum: readonly unknown[];
  readonly const: unknown;
  readonly allOf: readonly Draft07Schema[];
  readonly anyOf: readonly Draft07Schema[];
  readonly oneOf: readonly Draft07Schema[];
  readonly not: Draft07Schema;
  readonly if: Draft07Schema;
  readonly then: Draft07Schema;
  readonly else: Draft07Schema;

  readonly multipleOf: number;
  readonly maximum: number;
  readonly exclusiveMaximum: number;
  readonly minimum: number;
  readonly exclusiveMinimum: number;

  readonly maxLength: number;
  readonly minLength: number;
  readonly pattern: string;
  readonly format: string;
  /** Normalised: an unknown encoding name never reaches the binding. */
  readonly contentEncoding: ContentEncodingName;
  readonly contentMediaType: string;

  readonly items: Draft07Schema | readonly Draft07Schema[];
  readonly additionalItems: Draft07Schema;
  readonly maxItems: number;
  readonly minItems: number;
  /** Normalised: `uniqueItems: false` is a no-op and is dropped first. */
  readonly uniqueItems: true;
  readonly contains: Draft07Schema;

  readonly maxProperties: number;
  readonly minProperties: number;
  /** Normalised: the parent's array, resolved to one flag per child. */
  readonly required: true;
  readonly properties: Readonly<Record<string, Draft07Schema>>;
  readonly patternProperties: Readonly<Record<string, Draft07Schema>>;
  /** Normalised: only the boolean form binds; the schema form is structural. */
  readonly additionalProperties: boolean;
  readonly dependencies: Readonly<
    Record<string, Draft07Schema | readonly string[]>
  >;
  readonly propertyNames: Draft07Schema;
}
