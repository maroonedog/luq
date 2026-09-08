// ===========================================================================
// L8  src/json-schema/ref-scope.ts — `$ref` がどこから読まれているか。
//
// `$ref` の意味は書かれた場所で変わる。`$id` がベース URI を動かすので、
// 同じ `"b.json"` でも隣にどの `$id` があるかで別の文書を指す。したがって
// 解決に必要なのはルート文書ではなく **場所** であり、それがこの型である。
//
// これが無かったので `$id` は unsupported だった: resolveRef はルートしか
// 受け取らず、ルートには「今どのベースの中にいるか」を書く場所が無い。
// ===========================================================================
import type { Draft07Schema } from "./draft07.types";
import { isSchemaObject } from "./draft07.types";
import type { SchemaRegistry } from "./schema-registry";
import { createSchemaRegistry } from "./schema-registry";
import { nextBaseUri } from "./uri-reference";

/**
 * A document's own `$id` is where its base URI starts. Beginning at "" and
 * ignoring it is how `{"$id":"http://host/a","properties":{"x":{"$ref":"b.json"}}}`
 * ends up looking for a document literally named "b.json".
 */
function baseUriOf(root: Draft07Schema): string {
  if (!isSchemaObject(root) || typeof root.$id !== "string") return "";
  return nextBaseUri("", root.$id);
}

export interface RefScope {
  /** The resource a fragment-only reference (`#/definitions/x`) resolves in. */
  readonly document: Draft07Schema;
  /** The base URI in force here, "" for a document that declares no `$id`. */
  readonly baseUri: string;
  /** Everything a URI can name: `$id` bases, anchors, supplied documents. */
  readonly registry: SchemaRegistry;
}

/**
 * The scope of a document that declares no `$id` and reaches nothing else.
 * Used by callers that hold a root and nothing more, and by every test that
 * is about pointers rather than about identity.
 */
export function createLocalScope(root: Draft07Schema): RefScope {
  return {
    document: root,
    baseUri: baseUriOf(root),
    registry: createSchemaRegistry(root),
  };
}

/** A scope over a root plus the documents the caller already loaded. */
export function createDocumentScope(
  root: Draft07Schema,
  externalDocuments: Readonly<Record<string, unknown>>
): RefScope {
  return {
    document: root,
    baseUri: baseUriOf(root),
    registry: createSchemaRegistry(root, externalDocuments),
  };
}
