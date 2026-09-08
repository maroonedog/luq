// ===========================================================================
// L8  src/json-schema/schema-registry.ts — どの URI がどのスキーマを指すか。
//
// Draft-07 §8.2 では `$id` が二つの働きをする: 場所を示す URI はベースを
// 立て直し、`#name` の形は**位置に依らない名前**を付ける。どちらも
// 「この URI はこのノード」という索引で、それがこのファイルの責務である。
// ポインタ (`#/definitions/x`) を辿るのは場所の話なので resolve-ref.ts が持つ。
//
// 外部文書は**呼び出し側が渡したものだけ**である。Luq は取りに行かない:
// 関数ではなく地図 (`externalDocuments`) を受けるのは、そうすれば
//   * スキーマに書かれた URI でプロセスがソケットを開くことがない (SSRF)、
//   * 変換が同期のままで、CSP でも動く、
//   * 何が読まれうるかが呼び出し側のコードに全部書いてある、
// の三つが同時に成り立つからで、非同期ローダーではどれも失われる。
// ===========================================================================
import { isDraft07Schema, isSchemaObject } from "./draft07.types";
import type { Draft07Schema, Draft07SchemaObject } from "./draft07.types";
import { isArray, isPlainObject } from "../types";
import { nextBaseUri, normalizeUri, readAnchor } from "./uri-reference";

/**
 * A node the index names, with the base URI in force inside it and the
 * DOCUMENT that base belongs to.
 *
 * The document is not always the node. `$id: "#name"` names a sub-schema
 * without starting a new resource, so a `#/definitions/x` written next to it
 * still has to resolve against the enclosing document — resolving it against
 * the anchored sub-schema instead is how a chain of refs silently stops
 * finding anything after the first hop.
 */
export interface RegisteredTarget {
  readonly schema: Draft07Schema;
  readonly baseUri: string;
  readonly document: Draft07Schema;
}

export interface SchemaRegistry {
  /** The node this absolute URI NAMES — a document `$id`, or an anchor. */
  findIdentified(uri: string): RegisteredTarget | undefined;
}

/** Keywords whose value is ONE schema. */
const SCHEMA_VALUED: readonly string[] = Object.freeze([
  "additionalProperties",
  "additionalItems",
  "contains",
  "propertyNames",
  "not",
  "if",
  "then",
  "else",
]);

/** Keywords whose value is an ARRAY of schemas. `items` is in both lists. */
const SCHEMA_LIST_VALUED: readonly string[] = Object.freeze([
  "allOf",
  "anyOf",
  "oneOf",
]);

/** Keywords whose value is a MAP of name to schema. */
const SCHEMA_MAP_VALUED: readonly string[] = Object.freeze([
  "properties",
  "patternProperties",
  "definitions",
  "$defs",
  "dependencies",
]);

type Register = (uri: string, target: RegisteredTarget) => void;

function walkSchema(
  schema: Draft07Schema,
  base: string,
  document: Draft07Schema,
  register: Register
): void {
  if (!isSchemaObject(schema)) return;
  const id = typeof schema.$id === "string" ? schema.$id : undefined;
  const here = nextBaseUri(base, id);
  // A base-setting `$id` starts a new resource, so the node becomes the
  // document every relative pointer under it resolves against.
  const startsResource = id !== undefined && here !== base;
  const inner = startsResource ? schema : document;
  if (startsResource) {
    register(normalizeUri(here), { schema, baseUri: here, document: schema });
  }
  const anchor = readAnchor(id);
  if (anchor !== undefined) {
    register(normalizeUri(`${here}#${anchor}`), {
      schema,
      baseUri: here,
      document: inner,
    });
  }
  walkMembers(schema, here, inner, register);
}

/**
 * Read by ENTRY rather than by indexing the typed node: Draft07SchemaObject
 * declares its keywords and carries no index signature, and reaching a keyword
 * by name would need an assertion — src/core/type-erasure.ts is the only place
 * permitted to write one, and this is not it.
 */
function walkMembers(
  schema: Draft07SchemaObject,
  base: string,
  document: Draft07Schema,
  register: Register
): void {
  for (const [keyword, value] of Object.entries(schema)) {
    if (keyword === "items") {
      // The one keyword with both shapes, so it is walked as both.
      walkIfSchema(value, base, document, register);
      walkList(value, base, document, register);
      continue;
    }
    if (SCHEMA_VALUED.includes(keyword)) {
      walkIfSchema(value, base, document, register);
    } else if (SCHEMA_LIST_VALUED.includes(keyword)) {
      walkList(value, base, document, register);
    } else if (SCHEMA_MAP_VALUED.includes(keyword)) {
      walkMap(value, base, document, register);
    }
  }
}

function walkIfSchema(
  value: unknown,
  base: string,
  document: Draft07Schema,
  register: Register
): void {
  if (!isDraft07Schema(value)) return;
  walkSchema(value, base, document, register);
}

function walkList(
  value: unknown,
  base: string,
  document: Draft07Schema,
  register: Register
): void {
  if (!isArray(value)) return;
  for (const member of value) walkIfSchema(member, base, document, register);
}

function walkMap(
  value: unknown,
  base: string,
  document: Draft07Schema,
  register: Register
): void {
  if (!isPlainObject(value)) return;
  for (const member of Object.values(value)) {
    walkIfSchema(member, base, document, register);
  }
}

/**
 * Every `$id` in `root` and in each supplied external document.
 *
 * The external map's KEY is a URI in its own right: the suite (and real
 * callers) fetch `http://host/a.json` into a document that does not repeat its
 * own `$id`, so the key is what a `$ref` will name. A document that DOES carry
 * `$id` registers that too, and the `$id` wins where they disagree — it is the
 * document's own statement about its identity.
 */
export function createSchemaRegistry(
  root: Draft07Schema,
  externalDocuments: Readonly<Record<string, unknown>> = {}
): SchemaRegistry {
  const byUri = new Map<string, RegisteredTarget>();
  const register: Register = (uri, target) => {
    if (!byUri.has(uri)) byUri.set(uri, target);
  };
  for (const [uri, document] of Object.entries(externalDocuments)) {
    if (!isDraft07Schema(document)) continue;
    const key = normalizeUri(uri);
    register(key, { schema: document, baseUri: key, document });
  }
  for (const [uri, document] of Object.entries(externalDocuments)) {
    if (!isDraft07Schema(document)) continue;
    walkSchema(document, normalizeUri(uri), document, register);
  }
  walkSchema(root, "", root, register);
  return {
    findIdentified: (uri) => byUri.get(normalizeUri(uri)),
  };
}
