// ===========================================================================
// L7  src/plugins/object/pattern-properties.ts
// A KEYED set of PROPERTY-VALUE sub-chains. Draft-07 semantics: every matching
// pattern applies (legacy broke after the first match, which
// plugin-catalog-structural.md lists as deliberately not carried over).
// ===========================================================================
import { PASS, fail, isPlainObject, isStringArray } from "../../types";
import { branch, composite } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type {
  PropertyValueChain,
  Unchanged,
} from "../../plugin-kit/marker.types";

export interface PatternPropertiesExtra {
  readonly violatingProperties: readonly string[];
}

export const objectPatternPropertiesPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [patterns: Readonly<Record<string, PropertyValueChain>>];
  out: Unchanged;
  context: PatternPropertiesExtra;
}>()({
  name: "objectPatternProperties",
  method: "patternProperties",
  slots: ["object"] as const,
  build: (ctx, patterns) => {
    const entries = Object.entries(patterns);
    const matchers = entries.map(([pattern]) => new RegExp(pattern));
    return composite<PatternPropertiesExtra>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches: entries.map(([pattern, rules]) => branch(pattern, rules)),
      combine: (runners) => (value, runCtx) => {
        if (!isPlainObject(value)) return PASS;
        const violating: string[] = [];
        for (const key of Object.keys(value)) {
          for (let index = 0; index < runners.length; index += 1) {
            const matcher = matchers[index];
            const runner = runners[index];
            if (
              matcher === undefined ||
              runner === undefined ||
              !matcher.test(key)
            )
              continue;
            if (!runner.run(value[key], runCtx).ok) violating.push(key);
          }
        }
        return violating.length === 0 ? PASS : fail({ actual: violating });
      },
      describe: (detail) =>
        `Properties failing their pattern schema: ${String(detail.actual)}`,
      buildMessageContext: (detail) => ({
        violatingProperties: isStringArray(detail.actual) ? detail.actual : [],
      }),
    });
  },
});
