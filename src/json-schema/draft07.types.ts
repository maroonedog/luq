// ===========================================================================
// L8  src/json-schema/draft07.types.ts — the DOCUMENT shape.
//
// This is what a Draft-07 JSON document is allowed to say, keyword for
// keyword, straight from the draft-07 meta-schema's `properties` (46 keys).
// It is deliberately NOT the same thing as `Draft07KeywordValues`: this type
// is as wide as the specification, while the value types next door are as
// narrow as the handling can accept, so the converter is FORCED by the
// compiler to normalise (`uniqueItems: boolean` -> `true`, a `required` array
// -> a per-field flag) instead of quietly passing the wide form through.
//
// A schema may also be a bare boolean — Draft-07 §4.4 — and 1.x's converter
// could not represent that at all (it tested `typeof x === "object"` and
// dropped the rest), so it is in the union here from the start.
// ===========================================================================
import { isPlainObject } from "../types";

/** The seven values Draft-07 allows in `type`. `integer` is NOT a Luq slot. */
export type Draft07TypeKeyword =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object"
  | "null";

export type Draft07Schema = boolean | Draft07SchemaObject;

export interface Draft07SchemaObject {
  // -- document plumbing ----------------------------------------------------
  readonly $id?: string;
  readonly $schema?: string;
  readonly $ref?: string;
  readonly $comment?: string;
  readonly definitions?: Readonly<Record<string, Draft07Schema>>;
  /** 2019-09 spelling. Not a Draft-07 keyword; only the RESOLVER accepts it. */
  readonly $defs?: Readonly<Record<string, Draft07Schema>>;
  // -- annotations ----------------------------------------------------------
  readonly title?: string;
  readonly description?: string;
  readonly default?: unknown;
  readonly readOnly?: boolean;
  readonly writeOnly?: boolean;
  readonly examples?: readonly unknown[];
  // -- any instance ---------------------------------------------------------
  readonly type?: Draft07TypeKeyword | readonly Draft07TypeKeyword[];
  readonly enum?: readonly unknown[];
  readonly const?: unknown;
  readonly format?: string;
  // -- numbers --------------------------------------------------------------
  readonly multipleOf?: number;
  readonly maximum?: number;
  readonly exclusiveMaximum?: number;
  readonly minimum?: number;
  readonly exclusiveMinimum?: number;
  // -- strings --------------------------------------------------------------
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly pattern?: string;
  readonly contentMediaType?: string;
  readonly contentEncoding?: string;
  // -- arrays ---------------------------------------------------------------
  readonly items?: Draft07Schema | readonly Draft07Schema[];
  readonly additionalItems?: Draft07Schema;
  readonly maxItems?: number;
  readonly minItems?: number;
  readonly uniqueItems?: boolean;
  readonly contains?: Draft07Schema;
  // -- objects --------------------------------------------------------------
  readonly maxProperties?: number;
  readonly minProperties?: number;
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, Draft07Schema>>;
  readonly patternProperties?: Readonly<Record<string, Draft07Schema>>;
  readonly additionalProperties?: Draft07Schema;
  readonly dependencies?: Readonly<
    Record<string, Draft07Schema | readonly string[]>
  >;
  readonly propertyNames?: Draft07Schema;
  // -- applicators ----------------------------------------------------------
  readonly allOf?: readonly Draft07Schema[];
  readonly anyOf?: readonly Draft07Schema[];
  readonly oneOf?: readonly Draft07Schema[];
  readonly not?: Draft07Schema;
  readonly if?: Draft07Schema;
  readonly then?: Draft07Schema;
  readonly else?: Draft07Schema;
}

/** Narrows away the boolean form of §4.4 without an assertion. */
export function isSchemaObject(
  schema: Draft07Schema
): schema is Draft07SchemaObject {
  return typeof schema !== "boolean";
}

/** The one entry gate for untyped JSON. `null` is NOT a schema. */
export function isDraft07Schema(value: unknown): value is Draft07Schema {
  return typeof value === "boolean" || isPlainObject(value);
}
