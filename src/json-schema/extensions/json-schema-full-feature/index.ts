// ===========================================================================
// The public subpath `@maroonedog/luq/plugins/jsonSchemaFullFeature`.
// Re-exports only.
//
// 1.x published exactly one symbol here, `jsonSchemaFullFeaturePlugin`, and the
// README's only JSON Schema example imports it from this specifier. That symbol
// and that specifier are unchanged. `fromJsonSchema` and `jsonSchemaBag` are
// added because the rewritten core has no builder-extension mechanism, so the
// bundled bag has to be reachable as a value for the conversion function to be
// callable in one import.
// ===========================================================================
export {
  fromJsonSchema,
  jsonSchemaFullFeaturePlugin,
} from "./json-schema-full-feature";

export { jsonSchemaBag } from "./bundled-plugins";

export {
  UNBOUND_BUNDLED_PLUGIN_NAMES,
  findStaleUnboundDeclarations,
  findUnbundledBoundPlugins,
  findUnexplainedBundledPlugins,
  listBundledPluginNames,
} from "./bundle-coverage";

export type { JsonSchemaOptions } from "../json-schema";

// Every error `fromJsonSchema` can throw, so a caller can tell them apart by
// class rather than by reading the message.
//
// This subpath is the one-import route and the one the documentation points at,
// which made it the worst place to be missing them: a document that is not
// Draft-07 at all, one the meta-schema forbids, one carrying a keyword Luq
// cannot honour and one that is not a schema are four different things to do
// about it, and a caller who can only match on message text has to re-derive
// that distinction from prose that is free to change.
export {
  DRAFT07_DIALECT_URI,
  UnsupportedDialectError,
} from "../../unsupported-dialect-error";

export {
  MalformedSchemaError,
  NotASchemaError,
  RefResolutionError,
  UnsupportedKeywordError,
} from "../../index";

export type { DialectOptions, JsonSchemaBag } from "../../index";
