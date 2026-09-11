// ===========================================================================
// test/support/rule-build-context.ts
// The RuleBuildContext a plugin's build() needs when the test calls it itself
// instead of going through a chain.
//
// Two things a chain cannot hand a rule, so they can only be asked for here:
// a value outside the slot's type, because the slot's own type check leads the
// chain and ends the field first, and an IssueDetail the rule did not create,
// because a chain only ever gives a rule back its own.
// ===========================================================================
import type { MessageContextExtra, MessageFactory } from "../../src/types";
import type { RuleBuildContext } from "../../src/plugin-kit/rule-build-context";
import { DEFAULT_GLOBAL_CONFIG } from "../../src/types/global-config";

export interface RuleBuildContextOptions<C extends MessageContextExtra> {
  /** Doubles as the issue code, as it does for a plugin declaring neither. */
  readonly pluginName: string;
  readonly messageFactory?: MessageFactory<C>;
  readonly fieldPath?: string;
  readonly declaredSiblingKeys?: readonly string[];
}

export function createRuleBuildContext<C extends MessageContextExtra>(
  options: RuleBuildContextOptions<C>
): RuleBuildContext<C> {
  return {
    pluginName: options.pluginName,
    code: options.pluginName,
    messageFactory: options.messageFactory,
    severity: DEFAULT_GLOBAL_CONFIG.defaultSeverity,
    config: DEFAULT_GLOBAL_CONFIG,
    fieldPath: options.fieldPath ?? "subject",
    declaredSiblingKeys: options.declaredSiblingKeys ?? [],
  };
}

/** Everything a check or a composite reads off its RuleContext. */
export const RULE_CONTEXT = Object.freeze({ root: {}, path: "subject" });

/** The values a slot would have rejected before any rule saw them. */
export const NOT_A_PLAIN_OBJECT: readonly unknown[] = Object.freeze([
  null,
  [],
  "x",
  1,
  true,
]);
