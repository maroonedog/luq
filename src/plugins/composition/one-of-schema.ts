// ===========================================================================
// L7  src/plugins/composition/one-of-schema.ts
// The JSON Schema COMPOSITION keyword. Distinct from the legacy value-enum
// `oneOf` (see l7-one-of.ts): legacy-spec/plugin-catalog-core.md records
// oneOfPlugin as taking allowed VALUES, and json-schema-mapping.md records the
// composition keyword being routed through `custom()` because no plugin owned
// it. Both are kept; only this one carries sub-chains.
// ===========================================================================
import { PASS, fail } from "../../types";
import { branch, composite } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { NarrowedChain, Unchanged } from "../../plugin-kit/marker.types";

export interface OneOfSchemaExtra {
  readonly matchedBranches: number;
}

export const oneOfSchemaPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [alternatives: readonly NarrowedChain[]];
  out: Unchanged;
  context: OneOfSchemaExtra;
}>()({
  name: "oneOfSchema",
  method: "oneOfSchema",
  slots: [
    "string",
    "number",
    "boolean",
    "date",
    "array",
    "tuple",
    "object",
    "union",
  ] as const,
  build: (ctx, alternatives) =>
    composite<OneOfSchemaExtra>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches: alternatives.map((rules, index) =>
        branch(`#${String(index)}`, rules)
      ),
      combine: (runners) => (value, runCtx) => {
        let matched = 0;
        for (const runner of runners)
          if (runner.run(value, runCtx).ok) matched += 1;
        return matched === 1 ? PASS : fail({ expected: 1, actual: matched });
      },
      describe: (detail) =>
        `Exactly one alternative must match, ${String(detail.actual)} did`,
      buildMessageContext: (detail) => ({
        matchedBranches: typeof detail.actual === "number" ? detail.actual : -1,
      }),
    }),
});
