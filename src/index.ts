// ===========================================================================
// src/index.ts — THE ROOT SUBPATH. Re-exports only; nothing is defined here.
//
// Deliberately absent: every plugin. A plugin reaches a consumer through its
// own subpath (`@maroonedog/luq/plugins/<name>`), because a barrel that names
// all of them makes every one of them statically reachable and ends
// per-plugin tree-shaking. What lives here is the entry point, the vocabulary
// a caller reads results with, and the surface a PLUGIN AUTHOR writes against.
// ===========================================================================
export {
  Builder,
  NamelessPluginError,
  createBuilder,
  getGlobalConfig,
  resetGlobalConfig,
  setGlobalConfig,
} from "./builder/index";
export type {
  DefaultFactory,
  FieldBuilder,
  FieldOptions,
  FieldValidator,
  MissingFieldsError,
  SubsetValidator,
  UncoveredOf,
  Validator,
} from "./builder/index";

// ---- L0 vocabulary --------------------------------------------------------
export {
  PASS,
  fail,
  isArray,
  isNumber,
  isPlainObject,
  isString,
  isStringArray,
} from "./types";
export type {
  ArrayItemContext,
  CheckOutcome,
  IssueDetail,
  IssueSeverity,
  MessageContext,
  MessageContextExtra,
  MessageFactory,
  Present,
  PresenceState,
  RuleContext,
  RuleOptions,
  TypeName,
  ValidationIssue,
} from "./types";
export type {
  ValidateOptions,
  ValidationRejection,
  ValidationResult,
  ValidationSuccess,
} from "./types/validation-result.types";
export {
  DEFAULT_GLOBAL_CONFIG,
  resolveGlobalConfig,
} from "./types/global-config";
export type {
  GlobalConfig,
  NumberFormat,
  ResolvedGlobalConfig,
  ValueTransform,
} from "./types/global-config";

// ---- L1 path vocabulary ---------------------------------------------------
export type {
  FieldPath,
  LeafPath,
  MissingLeafPaths,
  PickPaths,
  ValueAtPath,
} from "./path/index";

// ---- L2 the plugin-author surface -----------------------------------------
export {
  PluginArgumentError,
  definePlugin,
} from "./plugin-kit/plugin-definition";
export type {
  AnyPlugin,
  PluginArgs,
  PluginDefinition,
  PluginOut,
  PluginSignature,
  PluginSpec,
} from "./plugin-kit/plugin-definition";
export {
  branch,
  check,
  composite,
  fieldsBranch,
  gate,
  presence,
  recursive,
  transform,
} from "./plugin-kit/create-rule";
export { renderMessage } from "./plugin-kit/rule-build-context";
export type { RuleBuildContext } from "./plugin-kit/rule-build-context";
export { readExternalContext } from "./plugin-kit/external-context";
