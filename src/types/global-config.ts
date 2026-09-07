// ===========================================================================
// L0  src/types/global-config.ts
// RESIDUAL 4 / item 4 — user decision 8 keeps GlobalConfig. Every legacy member
// of src/core/global-config.ts is carried over; nothing is dropped.
//
// The one thing that changes is WHERE it takes effect. Legacy read the mutable
// module singleton from inside running rules, which is module-level mutable
// state on the hot path. Here the config is RESOLVED ONCE at build() time
// (user decision 1: pre-compute at build, run assembled functions) and handed
// to every plugin through RuleBuildContext.config. A rule therefore never
// reads a global at validation time, and two builders built under different
// settings keep their own settings forever.
// ===========================================================================
import type { IssueSeverity } from "./index";

export type ValueTransform = (value: unknown) => unknown;

export interface NumberFormat {
  readonly decimalSeparator: string;
  readonly thousandSeparator: string;
}

/** Every member optional: this is what a caller supplies. */
export interface GlobalConfig {
  readonly messageKeyPrefix?: string;
  readonly toBooleanTruthyValues?: readonly string[];
  readonly numberFormat?: Partial<NumberFormat>;
  readonly dateFormat?: string;
  readonly trimStrings?: boolean;
  readonly caseSensitive?: boolean;
  readonly customTransforms?: Readonly<Record<string, ValueTransform>>;
  /** Severity a rule emits when neither the rule nor the call names one. */
  readonly defaultSeverity?: IssueSeverity;
}

/** Every member present: this is what a plugin reads. */
export interface ResolvedGlobalConfig {
  readonly messageKeyPrefix: string;
  readonly toBooleanTruthyValues: readonly string[];
  readonly numberFormat: NumberFormat;
  readonly dateFormat: string;
  readonly trimStrings: boolean;
  readonly caseSensitive: boolean;
  readonly customTransforms: Readonly<Record<string, ValueTransform>>;
  readonly defaultSeverity: IssueSeverity;
}

export const DEFAULT_GLOBAL_CONFIG: ResolvedGlobalConfig = Object.freeze({
  messageKeyPrefix: "",
  toBooleanTruthyValues: Object.freeze(["true", "1", "yes", "on"]),
  numberFormat: Object.freeze({
    decimalSeparator: ".",
    thousandSeparator: ",",
  }),
  dateFormat: "YYYY-MM-DD",
  trimStrings: false,
  caseSensitive: true,
  customTransforms: Object.freeze({}),
  defaultSeverity: "error",
});

export function resolveGlobalConfig(
  overrides: GlobalConfig | undefined,
  base: ResolvedGlobalConfig = DEFAULT_GLOBAL_CONFIG
): ResolvedGlobalConfig {
  if (overrides === undefined) return base;
  return Object.freeze({
    messageKeyPrefix: overrides.messageKeyPrefix ?? base.messageKeyPrefix,
    toBooleanTruthyValues:
      overrides.toBooleanTruthyValues ?? base.toBooleanTruthyValues,
    numberFormat: Object.freeze({
      decimalSeparator:
        overrides.numberFormat?.decimalSeparator ??
        base.numberFormat.decimalSeparator,
      thousandSeparator:
        overrides.numberFormat?.thousandSeparator ??
        base.numberFormat.thousandSeparator,
    }),
    dateFormat: overrides.dateFormat ?? base.dateFormat,
    trimStrings: overrides.trimStrings ?? base.trimStrings,
    caseSensitive: overrides.caseSensitive ?? base.caseSensitive,
    customTransforms: overrides.customTransforms ?? base.customTransforms,
    defaultSeverity: overrides.defaultSeverity ?? base.defaultSeverity,
  });
}
