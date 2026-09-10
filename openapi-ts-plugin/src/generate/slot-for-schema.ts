// ===========================================================================
// openapi-ts-plugin/src/generate/slot-for-schema.ts
//
// A schema's type to the slot name that follows `b.`.
//
// The library states that type selects the slot but holds no table as a value,
// because at run time the chain is already determined by the types. A
// generator writes source, so it needs the table.
// ===========================================================================
import type { Draft07SchemaObject } from "../../../src/json-schema/draft07.types";

const SLOT_BY_TYPE: Readonly<Record<string, string>> = {
  string: "string",
  number: "number",
  integer: "number",
  boolean: "boolean",
  array: "array",
  object: "object",
};

/**
 * A schema with no type, with several types, or with null alone belongs to no
 * slot, so it falls to "any". The any slot accepts every plugin, so the rules
 * that appear there (required, literal, oneOf) can still be written.
 */
export function slotForSchema(schema: Draft07SchemaObject): string {
  const type = (schema as { type?: unknown }).type;
  if (typeof type !== "string") return "any";
  return SLOT_BY_TYPE[type] ?? "any";
}
