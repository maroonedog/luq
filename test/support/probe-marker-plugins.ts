// ===========================================================================
// test/support/probe-marker-plugins.ts — two plugins that exist ONLY to keep a
// marker under test from a real call site.
//
// Neither is part of the published catalog, and that is the point: a plugin in
// src/plugins/ is a public subpath, so a fixture that merely demonstrates a
// marker must not live there. Step 21 moved conditional-schema-as-designed out
// for the same reason; these two followed at the catalog-integration gate.
//
//   compareToRoot  — the RootReader marker. No shipped plugin takes a
//                    `(root) => T` reader, so without this probe the marker
//                    would only be exercised by a type declaration.
//   oneOfSchema    — the NarrowedChain marker in ARRAY position. The JSON
//                    Schema `oneOf` keyword is `structural`: step 25 builds
//                    that composite from create-rule directly, so shipping a
//                    plugin for it would be a second front door onto one rule.
// ===========================================================================
import { PASS, fail } from "../../src/types";
import type { MessageContextExtra } from "../../src/types";
import { branch, check, composite } from "../../src/plugin-kit/create-rule";
import { definePlugin } from "../../src/plugin-kit/plugin-definition";
import type {
  NarrowedChain,
  RootReader,
  Unchanged,
} from "../../src/plugin-kit/marker.types";

/** RootReader marker: the plugin sees `(root: unknown) => number`. */
export const compareToRootPlugin = definePlugin<{
  args: readonly [read: RootReader<number>];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "compareToRoot",
  method: "compareToRoot",
  slots: ["number"] as const,
  build: (ctx, read) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value, ruleContext) =>
        value === read(ruleContext.root) ? PASS : fail({ actual: value }),
      describe: () => "Value must equal the value read from the root",
      buildMessageContext: () => ({}),
    }),
});

export interface OneOfSchemaExtra {
  readonly matchedBranches: number;
}

/** NarrowedChain marker inside an array argument. */
export const oneOfSchemaPlugin = definePlugin<{
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
