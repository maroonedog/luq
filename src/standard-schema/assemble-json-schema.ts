// ===========================================================================
// L10 src/standard-schema/assemble-json-schema.ts
//
// Builds the nested object and array schema from a list of paths.
//
// `"owner.name"` becomes `properties.owner.properties.name`, and
// `"employees[*].name"` becomes
// `properties.employees.items.properties.name`. Paths are read with the
// existing path parser rather than a second grammar written here.
//
// `required` belongs to the PARENT. In JSON Schema it says "this object must
// carry this key", which is a fact about the object, not about the key.
// ===========================================================================
import { parseFieldPath } from "../path/parse-field-path";
import type { PathSegment } from "../path/path-segment.types";
import type { FieldDeclaredCalls } from "../builder/field-declared-calls.types";
import { emitFieldSchema } from "./emit-field-schema";
import { DeclarationsUnavailableError } from "./declarations-unavailable-error";
import type { UnrepresentablePolicy } from "./unrepresentable-rule-error";

/** A node under construction, frozen just before it becomes JSON. */
interface SchemaNode {
  readonly properties: Map<string, SchemaNode>;
  readonly required: Set<string>;
  /** The element side of an array, made on each descent through `[*]`. */
  element: SchemaNode | null;
  /** The field's own schema, placed on arrival at a leaf. */
  leaf: Record<string, unknown> | null;
}

const newNode = (): SchemaNode => ({
  properties: new Map(),
  required: new Set(),
  element: null,
  leaf: null,
});

/** Descends through `key`, creating it when absent. */
function descend(node: SchemaNode, key: string): SchemaNode {
  const existing = node.properties.get(key);
  if (existing !== undefined) return existing;
  const created = newNode();
  node.properties.set(key, created);
  return created;
}

/** Places one path in the tree, setting the schema where the leaf lands. */
function place(
  root: SchemaNode,
  segments: readonly PathSegment[],
  schema: Record<string, unknown>,
  isRequired: boolean
): void {
  let node = root;
  let owner: SchemaNode | null = null;
  let ownerKey = "";
  for (const segment of segments) {
    if (segment.kind === "each") {
      node.element ??= newNode();
      node = node.element;
      owner = null;
      continue;
    }
    owner = node;
    ownerKey = segment.key;
    node = descend(node, segment.key);
  }
  node.leaf = schema;
  if (isRequired && owner !== null) owner.required.add(ownerKey);
}

/**
 * Freezes a node into a JSON Schema.
 *
 * On a node that has children, the leaf schema is the FOUNDATION. When both
 * `.object.required()` and `"user.name"` are declared, the properties from
 * the latter sit on top of the `type: "object"` from the former.
 */
function freeze(node: SchemaNode): Record<string, unknown> {
  const schema: Record<string, unknown> = { ...node.leaf };
  if (node.element !== null) {
    schema["type"] ??= "array";
    schema["items"] = freeze(node.element);
  }
  if (node.properties.size > 0) {
    schema["type"] ??= "object";
    const properties: Record<string, unknown> = {};
    for (const [key, child] of node.properties) {
      properties[key] = freeze(child);
    }
    schema["properties"] = properties;
  }
  if (node.required.size > 0) schema["required"] = [...node.required];
  return schema;
}

/** Assembles the root schema from the list of declarations. */
export function assembleJsonSchema(
  fields: readonly FieldDeclaredCalls[],
  policy: UnrepresentablePolicy
): Record<string, unknown> {
  const root = newNode();
  for (const field of fields) {
    // One field with no record is enough to refuse, whatever the policy says.
    if (field.calls === null)
      throw new DeclarationsUnavailableError(field.path);
    const emitted = emitFieldSchema(field.path, field.calls, policy);
    place(root, parseFieldPath(field.path), emitted.schema, emitted.isRequired);
  }
  const schema = freeze(root);
  // Even with nothing declared, or everything dropped, the root is an object:
  // the builder only accepts an object type in the first place.
  schema["type"] ??= "object";
  return schema;
}
