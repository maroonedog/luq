// ===========================================================================
// L8  src/json-schema/index.ts — re-exports only. Nothing is defined here.
//
// This is the surface step 26's two bundle plugins are written against, and
// the only json-schema surface anything outside src/json-schema/ may reach.
// ===========================================================================
export {
  NotASchemaError,
  buildFieldEntries,
  buildFromSchema,
  fromJsonSchema,
} from "./build-from-schema";

export {
  DEFINITION_CONTAINERS,
  collectDefinitionNames,
  isDefinitionContainer,
  readRefPointer,
  resolveSchemaNode,
  resolveSchemaNodeInScope,
  toSchemaObject,
} from "./collect-definitions";

export { flattenSchema, joinDeclaredPath } from "./flatten-schema";
export type {
  ReadChildSchemas,
  SchemaFieldDeclaration,
} from "./flatten-schema";

export {
  STRUCTURAL_EXPANSIONS,
  expandSchemaRules,
  isStructuralKeyword,
  readChildSchemas,
} from "./schema-to-declarations";
export {
  collectSubSchemaRules,
  toSchemaBranch,
} from "./collect-sub-schema-rules";
export { createStructuralContext } from "./create-structural-context";
export { declareRequiredProperties } from "./declare-required-properties";
export { declarePresenceRules } from "./declare-presence";
export type { PresenceDeclaration } from "./declare-presence";
export type { ConversionSeed } from "./create-structural-context";

export type {
  ChildSchema,
  StructuralConsumer,
  StructuralContext,
  StructuralExpansion,
  StructuralExpansionTable,
  StructuralKeyword,
} from "./structural-expansion.types";

export { RefResolutionError } from "./ref-resolution-error";
export { isResolvableRef, resolveRef, resolveRefInScope } from "./resolve-ref";
export type { RefScope } from "./ref-scope";
export { createDocumentScope, createLocalScope } from "./ref-scope";
export type { SchemaRegistry } from "./schema-registry";
export { createSchemaRegistry } from "./schema-registry";
export { UnsupportedKeywordError } from "./unsupported-keyword-error";
export { MalformedSchemaError } from "./malformed-schema-error";
export { isDraft07Schema, isSchemaObject } from "./draft07.types";
export type {
  Draft07Schema,
  Draft07SchemaObject,
  Draft07TypeKeyword,
} from "./draft07.types";
export {
  assertKeywordSupported,
  countKeywordHandlings,
  findKeywordHandling,
  isDraft07Keyword,
  listBoundPluginNames,
  listDraft07Keywords,
} from "./keyword-map";
export { findFormatHandling, listFormatNames } from "./format-map";
export type { JsonSchemaBag } from "./json-schema-bag.types";
