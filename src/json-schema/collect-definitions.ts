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
import type { RefScope } from "./ref-scope";
import { createLocalScope } from "./ref-scope";
import { resolveRefInScope } from "./resolve-ref";
import { nextBaseUri } from "./uri-reference";

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
  return resolveSchemaNodeInScope(schema, createLocalScope(root)).node;
}

/** What a node resolved to, and the scope that is in force INSIDE it. */
export interface ResolvedNode {
  readonly node: Draft07SchemaObject;
  readonly scope: RefScope;
}

/**
 * The scope-aware form, and the one the converter uses.
 *
 * The returned scope is not the one passed in: following a `$ref` can cross
 * into another document, and a `$ref` written inside THAT document resolves
 * against ITS base. Returning only the node — which is what the root-taking
 * form above can do — loses that, and is why a two-document schema resolved
 * its second hop against the first document.
 */
export function resolveSchemaNodeInScope(
  schema: Draft07Schema,
  scope: RefScope
): ResolvedNode {
  const node = toSchemaObject(schema);
  if (node.$ref === undefined) {
    // A node's own `$id` moves the base for everything inside it (§8.2).
    return { node, scope: advanceBase(scope, node) };
  }
  // Following a `$ref` lands in whatever base the TARGET lives in, and
  // resolve-ref already knows it — for a document fetched by URI that is the
  // retrieval URI, which the draft says wins over the document's own `$id`.
  const resolved = resolveRefInScope(node.$ref, scope);
  return { node: toSchemaObject(resolved.schema), scope: resolved.scope };
}

/**
 * The ONE place a base URI advances. It was also being done by the caller,
 * and doing it in both meant a relative `$id` was applied twice: a `$ref`
 * of "nested/foo.json" under `$id: "nested/"` went looking for
 * ".../nested/nested/foo.json".
 *
 * A base-setting `$id` starts a new RESOURCE, so the node also becomes the
 * document that `#/definitions/x` written under it resolves against. Moving
 * the base without moving the document is why
 * `{"$id":"a.json","properties":{"foo":{"$id":"b.json","definitions":{...},
 * "allOf":[{"$ref":"#/definitions/inner"}]}}}` looked for `inner` in the
 * OUTER document, where it does not exist.
 */
export function advanceBase(
  scope: RefScope,
  node: Draft07SchemaObject
): RefScope {
  const id = node.$id;
  if (typeof id !== "string" || id === "") return scope;
  const baseUri = nextBaseUri(scope.baseUri, id);
  if (baseUri === scope.baseUri) return scope;
  return { ...scope, baseUri, document: node };
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
