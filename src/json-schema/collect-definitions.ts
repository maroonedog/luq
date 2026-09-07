// ===========================================================================
// L8  src/json-schema/collect-definitions.ts — the SCHEMA NODE normaliser.
//
// Everything downstream reads a `Draft07SchemaObject`. Two Draft-07 shapes are
// not one:
//   * §4.4 lets a schema be a bare BOOLEAN. 1.x tested `typeof x === "object"`
//     and dropped the rest, so `additionalProperties: false` inside a
//     sub-schema position simply vanished. `true` is the empty schema and
//     `false` is `{ not: {} }` — "must not match the schema that matches
//     everything" — so the boolean form costs no second rule kind.
//   * `$ref` replaces the node. resolve-ref follows the whole chain and throws
//     on a cycle, so this module never loops.
//
// `definitions` (and its 2019-09 spelling `$defs`) are CONTAINERS: they hold
// schemas that are only reachable through a pointer, so walking into them
// would declare paths like `definitions.address.street` that no document has.
// They are read here, by resolve-ref, and nowhere else.
// ===========================================================================
import type { Draft07Schema, Draft07SchemaObject } from "./draft07.types";
import { isSchemaObject } from "./draft07.types";
import { resolveRef } from "./resolve-ref";

/** `true`: matches every instance. */
const ALWAYS_SCHEMA: Draft07SchemaObject = Object.freeze({});

/** `false`: matches nothing. `not` of the empty schema, so no new rule kind. */
const NEVER_SCHEMA: Draft07SchemaObject = Object.freeze({
  not: ALWAYS_SCHEMA,
});

/** The two container spellings, in the order a pointer would try them. */
export const DEFINITION_CONTAINERS: readonly string[] = Object.freeze([
  "definitions",
  "$defs",
]);

export function isDefinitionContainer(keyword: string): boolean {
  return DEFINITION_CONTAINERS.includes(keyword);
}

/** §4.4: the boolean form as an object, without inventing a rule kind. */
export function toSchemaObject(schema: Draft07Schema): Draft07SchemaObject {
  if (schema === true) return ALWAYS_SCHEMA;
  if (schema === false) return NEVER_SCHEMA;
  return schema;
}

/**
 * The node a path really carries: `$ref` followed to its target, the boolean
 * form normalised. A `$ref` sibling is DROPPED, which is Draft-07 §8.3: in
 * this draft `$ref` replaces the object it appears in.
 */
export function resolveSchemaNode(
  schema: Draft07Schema,
  root: Draft07Schema
): Draft07SchemaObject {
  const node = toSchemaObject(schema);
  if (node.$ref === undefined) return node;
  return toSchemaObject(resolveRef(node.$ref, root));
}

/**
 * The pointer a node forwards to, or undefined. Used by the flattener to spot
 * a recursive definition BEFORE it walks into it: `#/definitions/node` inside
 * its own `properties` is a legitimate schema whose declared paths are
 * infinite, and Luq declares finite paths.
 */
export function readRefPointer(schema: Draft07Schema): string | undefined {
  if (!isSchemaObject(schema)) return undefined;
  return schema.$ref;
}

/** Every definition name the document declares, under either spelling. */
export function collectDefinitionNames(root: Draft07Schema): readonly string[] {
  if (!isSchemaObject(root)) return Object.freeze([]);
  const names = new Set<string>();
  for (const container of [root.definitions, root.$defs]) {
    if (container === undefined) continue;
    for (const name of Object.keys(container)) names.add(name);
  }
  return Object.freeze([...names]);
}
