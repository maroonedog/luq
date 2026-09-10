// Fixtures shared by the chain runtime tests. Every plugin here is the REAL
// one from src/plugins/**, re-exported under the name the tests use and
// nothing else. `subChainArguments` used to be spread on here because
// definePlugin dropped it; it is a declared member of PluginSpec now, so the
// composites carry their own and the fixtures add nothing.
import type {
  CheckRule,
  CompositeRule,
  GateRule,
  PresenceRule,
  Rule,
  TransformRule,
} from "../../../src/plugin-kit/compiled-rule";
import type { RuleContext } from "../../../src/types";
import { DEFAULT_GLOBAL_CONFIG } from "../../../src/types/global-config";
import type { ChainBuildContext } from "../../../src/chain/create-chain-node";
import { requiredPlugin } from "../../../src/plugins/required";
import { compareFieldPlugin } from "../../../src/plugins/compare-field";
import { numberMinPlugin } from "../../../src/plugins/number-min";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { transformPlugin } from "../../../src/plugins/transform";
import { validateIfPlugin } from "../../../src/plugins/validate-if";
import { arrayContainsPlugin } from "../../../src/plugins/array-contains";
import { unionGuardPlugin } from "../../../src/plugins/union-guard";
import { tupleBuilderPlugin } from "../../../src/plugins/tuple-builder";
import { objectPatternPropertiesPlugin } from "../../../src/plugins/object-pattern-properties";

export const containsPlugin = arrayContainsPlugin;
export const guardPlugin = unionGuardPlugin;
export const builderPlugin = tupleBuilderPlugin;
export const patternPropertiesPlugin = objectPatternPropertiesPlugin;

export {
  requiredPlugin,
  stringMinPlugin,
  numberMinPlugin,
  compareFieldPlugin,
  transformPlugin,
  validateIfPlugin,
};

export const chainContext: ChainBuildContext = {
  fieldPath: "profile.name",
  declaredSiblingKeys: Object.freeze(["name", "age"]),
  config: DEFAULT_GLOBAL_CONFIG,
};

export const ruleContext: RuleContext = { root: {}, path: "profile.name" };

export function expectCheck(rule: Rule | undefined): CheckRule {
  if (rule === undefined || rule.kind !== "check")
    throw new Error(`expected a check rule, received ${String(rule?.kind)}`);
  return rule;
}

export function expectComposite(rule: Rule | undefined): CompositeRule {
  if (rule === undefined || rule.kind !== "composite")
    throw new Error(
      `expected a composite rule, received ${String(rule?.kind)}`
    );
  return rule;
}

export function expectGate(rule: Rule | undefined): GateRule {
  if (rule === undefined || rule.kind !== "gate")
    throw new Error(`expected a gate rule, received ${String(rule?.kind)}`);
  return rule;
}

export function expectTransform(rule: Rule | undefined): TransformRule {
  if (rule === undefined || rule.kind !== "transform")
    throw new Error(
      `expected a transform rule, received ${String(rule?.kind)}`
    );
  return rule;
}

export function expectPresence(rule: Rule | undefined): PresenceRule {
  if (rule === undefined || rule.kind !== "presence")
    throw new Error(`expected a presence rule, received ${String(rule?.kind)}`);
  return rule;
}

/**
 * The codes of the rules a chain BUILT — the type check its slot seeds is
 * dropped first, by `declaredRules` below.
 *
 * Every caller of this asks "what did calling these methods append", and
 * entering a slot already puts one rule in the list. Carrying it into every
 * expectation would say nothing and hide the ordering the tests are about.
 * The seed itself is asserted in slot-type-guard.test.ts, which reads issues
 * rather than rules and so cannot be fooled by this.
 */
export function ruleCodes(rules: readonly Rule[]): readonly string[] {
  return declaredRules(rules).map((rule) =>
    rule.kind === "transform" ? "transform" : rule.code
  );
}

/** The codes a slot seeds its chain with, before any method is called. */
const SLOT_GUARD_CODES: ReadonlySet<string> = new Set([
  "stringType",
  "numberType",
  "booleanType",
  "dateType",
  "arrayType",
  "objectType",
]);

/**
 * The rules a chain BUILT, without the type check its slot seeds.
 *
 * These tests are about what calling a method appends, and entering a slot
 * already puts one rule in the list (see src/chain/slot-type-guard.ts). Its
 * presence is asserted by slot-type-guard.test.ts; here it is noise, and
 * leaving it in would make every expectation carry a rule no test is about.
 */
export function declaredRules(rules: readonly Rule[]): readonly Rule[] {
  const first = rules[0];
  return first !== undefined &&
    first.kind === "check" &&
    SLOT_GUARD_CODES.has(first.code)
    ? rules.slice(1)
    : rules;
}
