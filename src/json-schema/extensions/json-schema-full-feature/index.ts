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

export {
  DRAFT07_DIALECT_URI,
  UnsupportedDialectError,
} from "../../unsupported-dialect-error";

export type { DialectOptions, JsonSchemaBag } from "../../index";
