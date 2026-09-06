// ===========================================================================
// RESIDUAL 4 / items 4 and 5 — GlobalConfig and ValidationIssue.severity, with
// the readers that make them more than a declaration.
// ===========================================================================
import {
  accountBuilder,
  type Assert,
  type Equals,
  type Extends,
} from "../../support/config-model";
import {
  DEFAULT_GLOBAL_CONFIG,
  resolveGlobalConfig,
  type GlobalConfig,
  type ResolvedGlobalConfig,
} from "../../../src/types/global-config";
import {
  getGlobalConfig,
  resetGlobalConfig,
  setGlobalConfig,
} from "../../../src/builder/global-config-store";
import { stringTruthyPlugin } from "../../../src/plugins/config-plugins";
import type { RuleBuildContext } from "../../../src/plugin-kit/rule-build-context";
import type { IssueSeverity, ValidationIssue } from "../../../src/types";
import type { CheckRule, Rule } from "../../../src/plugin-kit/compiled-rule";

// ---- every 1.x GlobalConfig member survives --------------------------------
export const legacyShapedConfig: GlobalConfig = {
  messageKeyPrefix: "luq.",
  toBooleanTruthyValues: ["true", "1"],
  numberFormat: { decimalSeparator: ",", thousandSeparator: "." },
  dateFormat: "DD/MM/YYYY",
  trimStrings: true,
  caseSensitive: false,
  customTransforms: { upper: (value) => String(value).toUpperCase() },
  defaultSeverity: "warning",
};

// @ts-expect-error the config vocabulary is closed; a typo is not a new option
export const typoConfig: GlobalConfig = { trimStrngs: true };
export const looseTransform: GlobalConfig = {
  // @ts-expect-error customTransforms takes (value: unknown) => unknown, never `any`
  customTransforms: { bad: (value: string) => value },
};

export const resolved: ResolvedGlobalConfig =
  resolveGlobalConfig(legacyShapedConfig);
export type ResolvedHasNoOptionals = Assert<
  Equals<ResolvedGlobalConfig["numberFormat"]["decimalSeparator"], string>
>;
export type DefaultIsResolved = Assert<
  Equals<typeof DEFAULT_GLOBAL_CONFIG, ResolvedGlobalConfig>
>;

// ---- the process-wide accessors 1.x exported, kept -------------------------
export function useProcessConfig(): boolean {
  setGlobalConfig({ trimStrings: true });
  const current = getGlobalConfig();
  resetGlobalConfig();
  return current.trimStrings;
}

// ---- .withConfig() is on the builder, keeps the bag, and is typed ----------
export const configured = accountBuilder;
export const builtAfterConfig = accountBuilder
  .v("name", (b) => b.string.required())
  .build()
  .validate({}, { abortEarly: true, external: { emailTaken: false } });
accountBuilder
  .v("name", (b) => b.string.required())
  .build()
  // @ts-expect-error ValidateOptions is closed; `nope` is not one of its members
  .validate({}, { nope: 1 });

// ---- a plugin really reads ctx.config --------------------------------------
declare const buildCtx: RuleBuildContext;
export const truthyRule: Rule = stringTruthyPlugin.build(buildCtx);

/** severity is on every issue-producing rule kind, and only on those. */
export function readRuleSeverity(rule: Rule): IssueSeverity | undefined {
  return rule.kind === "gate" || rule.kind === "transform"
    ? undefined
    : rule.severity;
}
export type BuildContextCarriesConfig = Assert<
  Equals<RuleBuildContext["config"], ResolvedGlobalConfig>
>;

/** A RuleBuildContext without config no longer type-checks — that is the wiring. */
// @ts-expect-error `config` and `severity` are required members now
export const contextMissingConfig: RuleBuildContext = {
  pluginName: "stringTruthy",
  code: "stringTruthy",
  fieldPath: "name",
  declaredSiblingKeys: [],
};

// ---- severity ---------------------------------------------------------------
export type SeverityIsThreeLevel = Assert<
  Equals<IssueSeverity, "error" | "warning" | "info">
>;
export type IssueSeverityIsRequired = Assert<
  Equals<Extends<{ path: ""; code: ""; message: "" }, ValidationIssue>, false>
>;
export type RuleCarriesSeverity = Assert<
  Equals<CheckRule["severity"], IssueSeverity>
>;

// A per-call override, through the ordinary RuleOptions argument.
accountBuilder.v("name", (b) =>
  b.string.required().min(1, { severity: "warning" })
);
accountBuilder.v("name", (b) =>
  b.string.required().min(1, { code: "tooShort", severity: "info" })
);
accountBuilder.v("name", (b) =>
  // @ts-expect-error "fatal" is not in the severity vocabulary
  b.string.required().min(1, { severity: "fatal" })
);

export function readIssueSeverity(issue: ValidationIssue): IssueSeverity {
  // No `?? "error"` fallback anywhere: the field is always populated.
  return issue.severity;
}
