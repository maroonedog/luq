// ===========================================================================
// luq-codegen/src/generate/slot-for-schema.ts
//
// A schema's type to the slot name that follows `b.`.
//
// The library states that type selects the slot but holds no table as a value,
// because at run time the chain is already determined by the types. A
// generator writes source, so it needs the table.
// ===========================================================================
import type { Draft07SchemaObject } from "@maroonedog/luq/schema-tooling";

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
 * slot, so it falls to "any".
 *
 * That narrows what can be written on it. A plugin serves the slots it
 * declares, and the ones declaring "any" are the type-agnostic rules —
 * presence and the value comparisons. A rule that belongs to one type does
 * not appear: `oneOf` serves string, number and boolean, so a schema whose
 * type could not be decided gets no `oneOf` call and the keyword is reported
 * skipped rather than emitted onto a slot that would not compile.
 */
export function slotForSchema(schema: Draft07SchemaObject): string {
  const type = (schema as { type?: unknown }).type;
  if (typeof type !== "string") return "any";
  return SLOT_BY_TYPE[type] ?? "any";
}
