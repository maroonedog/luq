// ===========================================================================
// L8  src/json-schema/flatten-schema.ts — the document as a list of DECLARED
// PATHS.
//
// `properties` nests; Luq declares. `{properties:{user:{properties:{address:
// {properties:{street:{}}}}}}}` becomes the declaration `user.address.street`,
// and `items` becomes `tags[*]`, so an issue renders as `tags[2].name` with the
// real index rather than as a cause hanging off a parent object.
//
// THE ROOT IS A DECLARABLE PATH — as of the stage-27 gate, and it is why
// `{type:"object", properties:{…}, additionalProperties:false}` converts at all.
// parse-field-path still rejects "" (a CHILD path may not be empty), but
// compile-schema maps ROOT_PATH onto the EMPTY TEMPLATE — the shape a composite
// branch's own rules have always used — so a root keyword becomes a rule.
//
// 1.x dropped every root keyword in silence (skipping the `path === ""` entry
// and calling `.strict()`, which has no runtime effect); step 25 refused them
// loudly instead. Neither validated them. Now:
//   * `properties` still becomes one DECLARED PATH per key, so an issue reads
//     `user.age`, not "somewhere inside the root object";
//   * `required` still distributes to those children, so a missing property is
//     reported AT the property;
//   * `allOf` is still merged arm by arm, so its children are declared too;
//   * `type` is dropped: fromJsonSchema is object-rooted by construction;
//   * EVERY OTHER rule-bearing keyword becomes a rule on the root declaration.
// `properties` is kept in that residual node, and only there: it contributes no
// rule, but createStructuralContext reads `declaredSiblingKeys` from it, which
// is what a root-level `additionalProperties: false` needs to know.
// ===========================================================================
import { ROOT_PATH } from "../compile/declared-child-keys";
import { assertDeclarableKey } from "../path/reserved-segment";
import { resolveSchemaNode, readRefPointer } from "./collect-definitions";
import type { Draft07Schema, Draft07SchemaObject } from "./draft07.types";
import { EACH_STEP } from "./flatten-array-schema";
import type { ChildSchema } from "./structural-expansion.types";

/** Deep enough for any hand-written schema; a recursive one stops sooner. */
const MAX_NESTING_DEPTH = 32;

/**
 * Root keywords that produce NO rule on the root declaration: the ones the
 * flattener distributes itself (and would otherwise apply twice), plus the ones
 * that assert nothing anywhere. Every other keyword stays in the residual node
 * and reaches expandSchemaRules like any other field's schema.
 */
const ROOT_KEYWORDS_WITHOUT_A_ROOT_RULE: readonly string[] = Object.freeze([
  "$schema",
  "$id",
  "$ref",
  "$comment",
  "definitions",
  "$defs",
  "title",
  "description",
  "default",
  "examples",
  "readOnly",
  "writeOnly",
  "properties",
  "required",
  "allOf",
  "type",
]);

export interface SchemaFieldDeclaration {
  readonly path: string;
  readonly schema: Draft07SchemaObject;
  readonly isRequired: boolean;
}

export type ReadChildSchemas = (
  schema: Draft07SchemaObject
) => readonly ChildSchema[];

/** `[*]` trails its key; every other step is a `.`-joined property name. */
export function joinDeclaredPath(parent: string, step: string): string {
  if (step === EACH_STEP) return `${parent}${EACH_STEP}`;
  assertDeclarableKey(step, parent === "" ? step : `${parent}.${step}`);
  return parent === "" ? step : `${parent}.${step}`;
}

/** The root plus every arm of its `allOf`, transitively, all resolved. */
export function collectRootNodes(
  root: Draft07Schema
): readonly Draft07SchemaObject[] {
  const nodes: Draft07SchemaObject[] = [];
  const pending: Draft07Schema[] = [root];
  while (pending.length > 0 && nodes.length < MAX_NESTING_DEPTH) {
    const next = pending.shift();
    if (next === undefined) break;
    const node = resolveSchemaNode(next, root);
    nodes.push(node);
    for (const arm of node.allOf ?? []) pending.push(arm);
  }
  return Object.freeze(nodes);
}

/** True when the node says anything the root declaration has to carry. */
function hasRootRuleKeyword(node: Draft07SchemaObject): boolean {
  return Object.keys(node).some(
    (keyword) => !ROOT_KEYWORDS_WITHOUT_A_ROOT_RULE.includes(keyword)
  );
}

/** The root node MINUS the three keywords the flattener applies itself. A rest
 *  destructuring, so the compiler and not a comment keeps the result a schema. */
function dropDistributedKeywords(
  node: Draft07SchemaObject
): Draft07SchemaObject {
  const { type: _type, required: _required, allOf: _allOf, ...residual } = node;
  return residual;
}

/** Children of the root, merged across the `allOf` arms, first arm winning. */
function readRootChildren(
  nodes: readonly Draft07SchemaObject[],
  readChildren: ReadChildSchemas
): readonly ChildSchema[] {
  const merged = new Map<string, ChildSchema>();
  for (const node of nodes) {
    // Requiredness is read from the ROOT nodes themselves: readChildSchemas
    // reports every child as not-required, because everywhere else a
    // `required` array becomes a rule on the object that owns it. The root has
    // no such object, so this is the one place it becomes child presence.
    const required = node.required ?? [];
    for (const child of readChildren(node)) {
      const isRequired = required.includes(child.step);
      const seen = merged.get(child.step);
      if (seen === undefined) {
        merged.set(child.step, { ...child, isRequired });
        continue;
      }
      if (isRequired && !seen.isRequired) {
        merged.set(child.step, { ...seen, isRequired: true });
      }
    }
  }
  return Object.freeze([...merged.values()]);
}

interface WalkState {
  readonly root: Draft07Schema;
  readonly readChildren: ReadChildSchemas;
  readonly into: SchemaFieldDeclaration[];
}

/**
 * A `$ref` already on this branch is a RECURSIVE definition. Its declared paths
 * are infinite and Luq declares finite ones, so the node's own rules are kept
 * and its children are not expanded. objectRecursively is the plugin for that
 * shape and it is not in the JSON Schema bag.
 */
function walkChild(
  parentPath: string,
  child: ChildSchema,
  visitedRefs: readonly string[],
  depth: number,
  state: WalkState
): void {
  const path = joinDeclaredPath(parentPath, child.step);
  const pointer = readRefPointer(child.schema);
  const node = resolveSchemaNode(child.schema, state.root);
  state.into.push({ path, schema: node, isRequired: child.isRequired });
  const isRepeat = pointer !== undefined && visitedRefs.includes(pointer);
  if (isRepeat || depth >= MAX_NESTING_DEPTH) return;
  const seen = pointer === undefined ? visitedRefs : [...visitedRefs, pointer];
  for (const grandChild of state.readChildren(node)) {
    walkChild(path, grandChild, seen, depth + 1, state);
  }
}

/**
 * The root declarations come FIRST, one per `allOf` arm that carries a rule of
 * its own, so two arms cannot silently overwrite each other's `minProperties`.
 * `isRequired` is false: the root is always present (create-validator refuses a
 * missing root before the plan runs), and a presence rule there would only add
 * a second answer to a question already settled.
 */
export function flattenSchema(
  root: Draft07Schema,
  readChildren: ReadChildSchemas
): readonly SchemaFieldDeclaration[] {
  const nodes = collectRootNodes(root);
  const state: WalkState = { root, readChildren, into: [] };
  for (const node of nodes) {
    if (!hasRootRuleKeyword(node)) continue;
    state.into.push({
      path: ROOT_PATH,
      schema: dropDistributedKeywords(node),
      isRequired: false,
    });
  }
  for (const child of readRootChildren(nodes, readChildren)) {
    walkChild("", child, Object.freeze([]), 0, state);
  }
  return Object.freeze(state.into);
}
