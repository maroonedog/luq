import { PluginValidationResult } from "../builder/plugins/plugin-interfaces";

export const VALID = Object.freeze({
  valid: true,
}) as PluginValidationResult;
export const INVALID = Object.freeze({
  valid: false,
}) as PluginValidationResult;
