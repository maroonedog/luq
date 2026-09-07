// ===========================================================================
// The public subpath `@maroonedog/luq/plugins/jsonSchema`. Re-exports only.
//
// 1.x published this subpath as "the jsonSchema barrel": the plugin plus the
// module's named helpers. The same shape is kept — the plugin, the conversion
// front door, and the errors a caller has to be able to catch by identity —
// with ONE deliberate omission: no plugin entry file is imported from here, so
// a consumer of this subpath pays only for the plugins they import themselves.
// ===========================================================================
export {
  SCHEMA_BRANCH_LABEL,
  collectDocumentRules,
  jsonSchemaPlugin,
} from "./json-schema";

export {
  NotASchemaError,
  UnsupportedKeywordError,
  RefResolutionError,
  buildFieldEntries,
  buildFromSchema,
  fromJsonSchema,
  isDraft07Schema,
  listBoundPluginNames,
  listDraft07Keywords,
  listFormatNames,
} from "../../index";

export type {
  Draft07Schema,
  Draft07SchemaObject,
  JsonSchemaBag,
} from "../../index";
