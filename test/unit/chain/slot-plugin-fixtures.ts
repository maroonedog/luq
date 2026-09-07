// Fixtures shared by the chain runtime tests. The plugins are the REAL ones
// from src/plugins/**; the only thing added here is `subChainArguments`, the
// declaration a plugin makes about which of its argument positions carry a
// sub-chain. definePlugin does not yet carry that field through (see
// needsFromOthers), so the fixtures spread it on. Spreading keeps the original
// `build` FUNCTION OBJECT, and therefore its `.length`, which is what the chain
// uses to separate the trailing RuleOptions from a declared optional argument.
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
import { requiredPlugin } from "../../../src/plugins/presence-plugins";
import {
  stringMinPlugin,
  numberMinPlugin,
  compareFieldPlugin,
  transformPlugin,
} from "../../../src/plugins/check-plugins";
import { validateIfPlugin } from "../../../src/plugins/gate-plugins";
import {
  arrayContainsPlugin,
  unionGuardPlugin,
} from "../../../src/plugins/composite-plugins";
import { tupleBuilderPlugin } from "../../../src/plugins/tuple-builder";
import { objectPatternPropertiesPlugin } from "../../../src/plugins/object/pattern-properties";

export const containsPlugin = {
  ...arrayContainsPlugin,
  subChainArguments: [0],
};
export const guardPlugin = { ...unionGuardPlugin, subChainArguments: [1] };
export const builderPlugin = {
  ...tupleBuilderPlugin,
  subChainArguments: [0, 1],
};
export const patternPropertiesPlugin = {
  ...objectPatternPropertiesPlugin,
  subChainArguments: [0],
};

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

export function ruleCodes(rules: readonly Rule[]): readonly string[] {
  return rules.map((rule) =>
    rule.kind === "transform" ? "transform" : rule.code
  );
}
