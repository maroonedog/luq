// The `$id` index: which URI names which schema.
//
// Three things. That the `$id` establishing a base and the `$id` giving a
// name are not confused; that a nested `$id` resolves against the outer base;
// and that the URI a document was retrieved from outranks its own `$id`.
import { createSchemaRegistry } from "../../../../src/json-schema/schema-registry";
import type { Draft07SchemaObject } from "../../../../src/json-schema/draft07.types";

describe("createSchemaRegistry", () => {
  it("indexes a document by its own $id", () => {
    const root: Draft07SchemaObject = {
      $id: "http://x/a.json",
      type: "object",
    };
    const found = createSchemaRegistry(root).findIdentified("http://x/a.json");
    expect(found?.schema).toBe(root);
    expect(found?.baseUri).toBe("http://x/a.json");
  });

  it("resolves a nested $id against the base in force, not against nothing", () => {
    const inner: Draft07SchemaObject = { $id: "folder/", type: "array" };
    const root: Draft07SchemaObject = {
      $id: "http://x/schemas/",
      definitions: { inner },
    };
    const registry = createSchemaRegistry(root);
    expect(registry.findIdentified("http://x/schemas/folder/")?.schema).toBe(
      inner
    );
  });

  it("indexes an anchor $id WITHOUT moving the base", () => {
    // §8.2.3: `#name` is a name, not a base. Treated as a base, a relative
    // `$ref` written beside it quietly points somewhere else.
    const anchored: Draft07SchemaObject = { $id: "#inner", type: "string" };
    const root: Draft07SchemaObject = {
      $id: "http://x/a.json",
      definitions: { anchored },
    };
    const registry = createSchemaRegistry(root);
    const found = registry.findIdentified("http://x/a.json#inner");
    expect(found?.schema).toBe(anchored);
    expect(found?.baseUri).toBe("http://x/a.json");
  });

  it("keeps the enclosing document for an anchor, so a local pointer still resolves", () => {
    const anchored: Draft07SchemaObject = { $id: "#inner", type: "string" };
    const root: Draft07SchemaObject = {
      $id: "http://x/a.json",
      definitions: { anchored },
    };
    const found = createSchemaRegistry(root).findIdentified(
      "http://x/a.json#inner"
    );
    expect(found?.document).toBe(root);
  });

  it("makes a base-setting $id its own document", () => {
    const inner: Draft07SchemaObject = {
      $id: "b.json",
      definitions: { leaf: { type: "string" } },
    };
    const root: Draft07SchemaObject = {
      $id: "http://x/a.json",
      properties: { foo: inner },
    };
    const found = createSchemaRegistry(root).findIdentified("http://x/b.json");
    expect(found?.document).toBe(inner);
  });

  it("indexes a supplied document under the URI it was supplied as", () => {
    const remote: Draft07SchemaObject = { type: "integer" };
    const registry = createSchemaRegistry(
      {},
      { "http://host/integer.json": remote }
    );
    expect(registry.findIdentified("http://host/integer.json")?.schema).toBe(
      remote
    );
  });

  it("lets the RETRIEVAL uri win over the document's own $id", () => {
    // Where a document was retrieved from is its identity.
    const remote: Draft07SchemaObject = {
      $id: "http://elsewhere/other.json",
      type: "integer",
    };
    const registry = createSchemaRegistry(
      {},
      { "http://host/integer.json": remote }
    );
    expect(registry.findIdentified("http://host/integer.json")?.baseUri).toBe(
      "http://host/integer.json"
    );
  });

  it("normalises the URI, so two spellings are one entry", () => {
    const registry = createSchemaRegistry({ $id: "http://x/a/../b.json" });
    expect(registry.findIdentified("http://x/b.json")).toBeDefined();
  });

  it("returns undefined for a URI nobody declared or supplied", () => {
    expect(
      createSchemaRegistry({}).findIdentified("http://x/missing.json")
    ).toBeUndefined();
  });

  it("walks every schema-valued keyword, not only definitions", () => {
    const inNot: Draft07SchemaObject = {
      $id: "http://x/not.json",
      type: "string",
    };
    const inItems: Draft07SchemaObject = {
      $id: "http://x/item.json",
      type: "number",
    };
    const registry = createSchemaRegistry({
      not: inNot,
      items: [inItems],
    });
    expect(registry.findIdentified("http://x/not.json")?.schema).toBe(inNot);
    expect(registry.findIdentified("http://x/item.json")?.schema).toBe(inItems);
  });

  // `items` is the one keyword written either way, so the index tries it as
  // both. The single-schema spelling therefore reaches the list walker with an
  // object, and the list walker has to leave it alone rather than iterate it.
  it("indexes items in its single-schema spelling", () => {
    const inItems: Draft07SchemaObject = {
      $id: "http://x/item.json",
      type: "number",
    };
    const registry = createSchemaRegistry({ items: inItems });
    expect(registry.findIdentified("http://x/item.json")?.schema).toBe(inItems);
  });
});

// A schema is JSON somebody else wrote, so a keyword can hold a shape the
// draft does not allow. Indexing must survive it: losing every `$id` in the
// document because one member is the wrong type would turn a typo into a
// validator that silently checks less.
describe("schema-registry survives a keyword of the wrong shape", () => {
  it("keeps indexing when a map-valued keyword is not a map", () => {
    const document = JSON.parse(
      String.raw`{"$id": "http://x/a.json", "definitions": null,
        "not": {"$id": "http://x/n.json", "type": "string"}}`
    ) as Draft07SchemaObject;
    const registry = createSchemaRegistry(document);
    expect(registry.findIdentified("http://x/a.json")?.schema).toBe(document);
    expect(registry.findIdentified("http://x/n.json")?.baseUri).toBe(
      "http://x/n.json"
    );
  });

  it("keeps indexing when a list-valued keyword is not a list", () => {
    const document = JSON.parse(
      String.raw`{"$id": "http://x/a.json", "allOf": 7,
        "not": {"$id": "http://x/n.json", "type": "string"}}`
    ) as Draft07SchemaObject;
    const registry = createSchemaRegistry(document);
    expect(registry.findIdentified("http://x/n.json")?.schema).toEqual({
      $id: "http://x/n.json",
      type: "string",
    });
  });
});

describe("schema-registry indexes only what the caller supplied", () => {
  it("skips a supplied entry that is not a schema and keeps the rest", () => {
    // The unusable entry is FIRST: a registry that stopped at it would leave
    // the good document unreachable, and a `$ref` to it would then be refused.
    const usable: Draft07SchemaObject = { type: "integer" };
    const registry = createSchemaRegistry(
      {},
      {
        "http://host/broken.json": "<!doctype html>",
        "http://host/int.json": usable,
      }
    );
    expect(registry.findIdentified("http://host/broken.json")).toBeUndefined();
    expect(registry.findIdentified("http://host/int.json")?.schema).toBe(
      usable
    );
  });

  it("indexes a nested $id inside a supplied document", () => {
    const nested: Draft07SchemaObject = { $id: "inner.json", type: "boolean" };
    const registry = createSchemaRegistry(
      {},
      {
        "http://host/broken.json": "<!doctype html>",
        "http://host/outer.json": { definitions: { nested } },
      }
    );
    expect(registry.findIdentified("http://host/inner.json")?.schema).toBe(
      nested
    );
  });
});
