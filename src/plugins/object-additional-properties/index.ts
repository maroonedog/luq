// Two plugins, one subpath: the BOOLEAN form (marker-free, bindable from a
// JSON document) and the SCHEMA form (a PropertyValueChain, which no JSON
// document can produce). docs/legacy-public-surface.md freezes a single
// ./plugins/objectAdditionalProperties subpath, so the pair ships together.
export { objectAdditionalPropertiesPlugin } from "./object-additional-properties";
export type { UnexpectedPropertiesExtra } from "./object-additional-properties";
export { objectAdditionalPropertiesSchemaPlugin } from "./object-additional-properties-schema";
