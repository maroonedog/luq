// ===========================================================================
// src/field-rule/index.ts — re-exports only. Nothing is defined in this file.
// ===========================================================================
export { createFieldRule, FIELD_RULE_SUBJECT_KEY } from "./create-field-rule";
export { createPluginRegistry } from "./create-plugin-registry";
export { useField } from "./use-field";
export type {
  ExtractFieldRuleValue,
  FieldRule,
  FieldRuleDefine,
  FieldRuleOptions,
  FieldRuleSubject,
} from "./field-rule.types";
export type { PluginRegistry } from "./plugin-registry.types";
