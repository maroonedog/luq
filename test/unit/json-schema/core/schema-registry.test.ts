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
});
