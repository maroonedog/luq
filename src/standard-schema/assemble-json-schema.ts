// ===========================================================================
// L10 src/standard-schema/assemble-json-schema.ts
//
// パスの並びから、入れ子のオブジェクト／配列スキーマを組み立てる。
//
// `"owner.name"` は `properties.owner.properties.name` に、
// `"employees[*].name"` は `properties.employees.items.properties.name` に
// なる。パスの解釈は parseFieldPath が一度決めているものをそのまま使う
// (二つ目のパス文法を作らない)。
//
// `required` は**親が**持つ。JSON Schema の required は「この オブジェクトが
// この鍵を持たねばならない」であって、鍵の側の性質ではない。
// ===========================================================================
import { parseFieldPath } from "../path/parse-field-path";
import type { PathSegment } from "../path/path-segment.types";
import type { FieldDeclaredCalls } from "../builder/field-declared-calls.types";
import { emitFieldSchema } from "./emit-field-schema";
import { DeclarationsUnavailableError } from "./declarations-unavailable-error";
import type { UnrepresentablePolicy } from "./unrepresentable-rule-error";

/** 組み立て中の節。JSON にする直前に固める。 */
interface SchemaNode {
  readonly properties: Map<string, SchemaNode>;
  readonly required: Set<string>;
  /** 配列の要素側。`[*]` を一つ降りるごとに作られる。 */
  element: SchemaNode | null;
  /** 葉に着いたときに置かれる、そのフィールド自身のスキーマ。 */
  leaf: Record<string, unknown> | null;
}

const newNode = (): SchemaNode => ({
  properties: new Map(),
  required: new Set(),
  element: null,
  leaf: null,
});

/** `key` を降りる。無ければ作る。 */
function descend(node: SchemaNode, key: string): SchemaNode {
  const existing = node.properties.get(key);
  if (existing !== undefined) return existing;
  const created = newNode();
  node.properties.set(key, created);
  return created;
}

/** 一本のパスを木に置く。葉に着いたところで schema を据える。 */
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
 * 節を JSON Schema に固める。
 *
 * 葉のスキーマは、子を持つ節では**土台**として使う。`.object.required()` と
 * `"user.name"` の両方が宣言されていれば、前者の `type: "object"` の上に
 * 後者の `properties` が乗る。
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

/** 宣言の一覧から、根のスキーマを組み立てる。 */
export function assembleJsonSchema(
  fields: readonly FieldDeclaredCalls[],
  policy: UnrepresentablePolicy
): Record<string, unknown> {
  const root = newNode();
  for (const field of fields) {
    // 控えていないフィールドが一つでもあれば、方針に関わらず断る。
    // omit は「書けない宣言を落としてよい」という許しであって、
    // 「何が宣言されていたか知らないまま出してよい」ではない。
    if (field.calls === null)
      throw new DeclarationsUnavailableError(field.path);
    const emitted = emitFieldSchema(field.path, field.calls, policy);
    place(root, parseFieldPath(field.path), emitted.schema, emitted.isRequired);
  }
  const schema = freeze(root);
  // 宣言が一つも無い、あるいはすべて落とされたときでも、根がオブジェクトで
  // あることは builder が `.for<T extends object>()` を要求している時点で
  // 決まっている。
  schema["type"] ??= "object";
  return schema;
}
