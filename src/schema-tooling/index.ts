// ===========================================================================
// src/schema-tooling/index.ts — re-exports only. Nothing is defined here.
//
// The surface published as `@maroonedog/luq/schema-tooling`, for a tool that
// reads a JSON Schema document at build time instead of validating one at run
// time — a code generator, above all.
//
// It is listed by hand and kept short on purpose. Everything named here is
// public API from the moment it ships, so the file answers one question only:
// what does a generator need in order to decide the same field paths the
// run-time conversion decides? Anything a generator does not need stays
// internal, and re-exporting the whole layer would have frozen all of it.
// ===========================================================================
export { flattenSchema } from "../json-schema";
export type { ReadChildSchemas, SchemaFieldDeclaration } from "../json-schema";
export { readChildSchemas } from "../json-schema";
export { isDraft07Schema, isSchemaObject } from "../json-schema";
/** The vocabulary itself: what a tool must have a decision for. */
export { listDraft07Keywords } from "../json-schema";
export type {
  ChildSchema,
  Draft07Schema,
  Draft07SchemaObject,
} from "../json-schema";
