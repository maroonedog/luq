// ===========================================================================
// openapi-ts-plugin/src/generate/resolve-required-path.ts
//
// Decides whether a nested `required` may be lowered to `.required()`.
//
// At run time `required` is a rule on the OBJECT, not presence on the child.
// A presence rule on the child would also fire when the PARENT is absent,
// and Draft-07 applies a subschema only to a value that exists.
//
//   { properties: { a: { properties: { b: {} }, required: ["b"] } } }
//   {} is VALID against it: a is absent, so a's subschema does not apply.
//   Writing .required() on "a.b" would reject {} and disagree with run time.
//
// It changes when **every ancestor object is itself required**. The parent is
// then guaranteed to exist, so an undefined child can only mean the parent is
// missing that key, and .required() is correct. The generator emits it in that
// case and no other.
//
// An array does not break the chain: if the array is absent it has no
// elements, so no element rule runs. Whether the array is required therefore
// does not affect the judgement for its elements.
// ===========================================================================
import type {
  Draft07Schema,
  Draft07SchemaObject,
} from "../../../src/json-schema/draft07.types";
import {
  isDraft07Schema,
  isSchemaObject,
} from "../../../src/json-schema/draft07.types";

/** "items[*].sku" -> ["items[*]", "sku"]; "[*]" stays attached to its key. */
export function splitDeclaredPath(path: string): readonly string[] {
  return path === "" ? [] : path.split(".");
}

function propertyOf(
  schema: Draft07SchemaObject,
  key: string
): Draft07SchemaObject | undefined {
  const properties = (schema as { properties?: unknown }).properties;
  if (properties === null || typeof properties !== "object") return undefined;
  const child = (properties as Record<string, unknown>)[key];
  if (!isDraft07Schema(child)) return undefined;
  return isSchemaObject(child) ? child : undefined;
}

function itemsOf(schema: Draft07SchemaObject): Draft07SchemaObject | undefined {
  const items = (schema as { items?: unknown }).items;
  if (!isDraft07Schema(items)) return undefined;
  return isSchemaObject(items) ? items : undefined;
}

function listsAsRequired(schema: Draft07SchemaObject, key: string): boolean {
  const required = (schema as { required?: unknown }).required;
  return Array.isArray(required) && required.includes(key);
}

/**
 * Whether `.required()` may be emitted for that path.
 *
 * False as soon as one ancestor object along the way is not itself required.
 * On false the caller emits `.optional()` instead and reports the omission.
 */
export function isSafelyRequired(root: Draft07Schema, path: string): boolean {
  if (!isSchemaObject(root)) return false;
  const steps = splitDeclaredPath(path);
  if (steps.length === 0) return false;

  let current: Draft07SchemaObject = root;
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index] ?? "";
    const wildcards = (step.match(/\[\*\]/g) ?? []).length;
    const key = step.slice(0, step.length - wildcards * 3);

    if (!listsAsRequired(current, key)) return false;

    const child = propertyOf(current, key);
    if (child === undefined) return index === steps.length - 1;

    let descended: Draft07SchemaObject = child;
    for (let level = 0; level < wildcards; level += 1) {
      const element = itemsOf(descended);
      // With no element schema there is nowhere further to walk. Every
      // ancestor so far was required, so the last segment may be required.
      if (element === undefined) return index === steps.length - 1;
      descended = element;
    }
    current = descended;
  }
  return true;
}

/**
 * Whether the immediate parent schema lists that key in its required set.
 *
 * When the path is not safely required, this separates "it was never written
 * as required" from "it was, but an ancestor makes it unlowerable". Only the
 * second is reported as skipped.
 */
export function isListedByParent(root: Draft07Schema, path: string): boolean {
  if (!isSchemaObject(root)) return false;
  const steps = splitDeclaredPath(path);
  if (steps.length === 0) return false;

  let current: Draft07SchemaObject = root;
  for (let index = 0; index < steps.length - 1; index += 1) {
    const step = steps[index] ?? "";
    const wildcards = (step.match(/\[\*\]/g) ?? []).length;
    const key = step.slice(0, step.length - wildcards * 3);
    const child = propertyOf(current, key);
    if (child === undefined) return false;
    let descended: Draft07SchemaObject = child;
    for (let level = 0; level < wildcards; level += 1) {
      const element = itemsOf(descended);
      if (element === undefined) return false;
      descended = element;
    }
    current = descended;
  }

  const last = steps[steps.length - 1] ?? "";
  const wildcards = (last.match(/\[\*\]/g) ?? []).length;
  return listsAsRequired(current, last.slice(0, last.length - wildcards * 3));
}
