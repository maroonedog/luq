// ===========================================================================
// L6  src/builder/index.ts — re-exports only. Nothing is defined in this file.
// `Builder` names both the entry point and its type; the two are one merged
// declaration in ./field-builder.types.ts, so one export line carries both.
// ===========================================================================
export { Builder } from "./field-builder.types";
export type {
  FieldBuilder,
  MissingFieldsError,
  UncoveredOf,
} from "./field-builder.types";
export { NamelessPluginError, createBuilder } from "./create-builder";
export {
  getGlobalConfig,
  resetGlobalConfig,
  setGlobalConfig,
} from "./global-config-store";

export type { DefaultFactory, FieldOptions } from "./field-options.types";
export type {
  FieldValidator,
  SubsetValidator,
  Validator,
} from "./validator.types";
