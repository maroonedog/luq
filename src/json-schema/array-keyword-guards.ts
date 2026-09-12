// ===========================================================================
// L8  src/json-schema/array-keyword-guards.ts — the meta-schema checks for
// `items`, `additionalItems`, `contains` and `uniqueItems`, read by
// flatten-array-schema.ts.
//
// Every one of these keywords decides whether a rule EXISTS, and each had a
// route where a value the meta-schema forbids produced no rule at all rather
// than an error. `items: 5` is not a schema, but the sub-schema walker takes it
// anyway and iterates its keys; a number has none, so the walker yields zero
// rules and every element passes — the document asked for a constraint and the
// built validator carries an always-true one in its place. `additionalItems: 5`
// takes that same route for the rest branch, so every element past the tuple
// goes unchecked. `contains: 5` is the same bug wearing a disguise: an
// always-true element branch matches the FIRST element, so the existence
// requirement collapses into "the array is non-empty" — the empty array is
// still refused, and that lawful-looking verdict is what makes the loss of the
// real constraint easy to miss. `uniqueItems` is honoured only on a strict
// `=== true`, so `uniqueItems: "yes"`, the shape a form encoding or a loose
// YAML loader produces, drops to nothing the same way.
//
// A validator that quietly enforces LESS than its document says cannot be
// detected downstream: it answers "valid" for exactly the inputs the schema
// meant to refuse, and nothing in the result says a constraint went missing.
// Build time is therefore the only place a caller can still act, so these
// read the value and refuse it there.
//
// What must survive the refusal, because Draft-07 defines it: `items` has TWO
// legal forms — one schema for every element, or an ARRAY of schemas where
// position i constrains element i (§9.3.1) — `additionalItems` and `contains`
// take the boolean form of a schema as readily as the object form (§4.4), and
// `uniqueItems: false` is a lawful no-op (§6.4.3), so only a NON-boolean is
// refused.
// ===========================================================================
import { isArray } from "../types";
import { isDraft07Schema } from "./draft07.types";
import type { Draft07Schema, Draft07SchemaObject } from "./draft07.types";
import { MalformedSchemaError, SCHEMA_FORMS } from "./malformed-schema-error";

/** The two shapes §9.3.1 permits `items` to take. */
export type ItemsValue = Draft07Schema | readonly Draft07Schema[];

const ITEMS_REASON = "the value must be a schema or an array of schemas";

const UNIQUE_ITEMS_REASON = "the value must be a boolean";

/**
 * Reads `items` after checking it against the meta-schema: the keyword's own
 * value, or undefined when the keyword is absent, and a refusal when it is
 * neither of the two forms §9.3.1 defines.
 */
export function readCheckedItems(
  schema: Draft07SchemaObject
): ItemsValue | undefined {
  const items = schema.items;
  if (items === undefined) return undefined;
  if (isArray(items)) return checkTuplePositions(items);
  if (!isDraft07Schema(items)) {
    throw new MalformedSchemaError("items", ITEMS_REASON, items);
  }
  return items;
}

/**
 * Every position of the tuple form is a schema in its own right, so a bad one
 * names its index: with the whole array rendered instead, a caller holding a
 * long tuple is told only that something in it is wrong.
 */
function checkTuplePositions(
  positions: readonly Draft07Schema[]
): readonly Draft07Schema[] {
  for (let index = 0; index < positions.length; index += 1) {
    const position = positions[index];
    if (isDraft07Schema(position)) continue;
    throw new MalformedSchemaError(
      "items",
      `position ${String(index)} of the array form ${SCHEMA_FORMS}`,
      position
    );
  }
  return positions;
}

/**
 * Reads `additionalItems` after checking it is a single schema: the keyword's
 * own value, or undefined when the keyword is absent, and a refusal for
 * anything §4.4 does not call a schema.
 *
 * It is read only where §6.4.2 gives the keyword effect, which is beside the
 * tuple form of `items`; beside the single form the draft ignores it, no rest
 * branch is built and this reader is never reached.
 */
export function readCheckedAdditionalItems(
  schema: Draft07SchemaObject
): Draft07Schema | undefined {
  const additionalItems = schema.additionalItems;
  if (additionalItems === undefined) return undefined;
  if (!isDraft07Schema(additionalItems)) {
    throw new MalformedSchemaError(
      "additionalItems",
      `the value ${SCHEMA_FORMS}`,
      additionalItems
    );
  }
  return additionalItems;
}

/**
 * Reads `contains` after checking it is a single schema: the keyword's own
 * value, or undefined when the keyword is absent, and a refusal for anything
 * §4.4 does not call a schema. Unlike `items`, `contains` has no array form —
 * a tuple there is a malformed value, not a second reading.
 */
export function readCheckedContains(
  schema: Draft07SchemaObject
): Draft07Schema | undefined {
  const contains = schema.contains;
  if (contains === undefined) return undefined;
  if (!isDraft07Schema(contains)) {
    throw new MalformedSchemaError(
      "contains",
      `the value ${SCHEMA_FORMS}`,
      contains
    );
  }
  return contains;
}

/**
 * Reads `uniqueItems` after checking it is a boolean: the keyword's own value,
 * or undefined when the keyword is absent, and a refusal for anything else.
 */
export function readCheckedUniqueItems(
  schema: Draft07SchemaObject
): boolean | undefined {
  const uniqueItems = schema.uniqueItems;
  if (uniqueItems === undefined) return undefined;
  if (typeof uniqueItems !== "boolean") {
    throw new MalformedSchemaError(
      "uniqueItems",
      UNIQUE_ITEMS_REASON,
      uniqueItems
    );
  }
  return uniqueItems;
}
