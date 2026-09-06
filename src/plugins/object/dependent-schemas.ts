// ===========================================================================
// L7  src/plugins/object/dependent-schemas.ts
// A KEYED set of SAME-VALUE sub-chains: each schema constrains the trigger's
// own object, so the subject is Present<TValue, TState> and the marker is
// NarrowedChain -- keyed, which is the container the array recursion missed.
// ===========================================================================
import { PASS, fail, isPlainObject, isString } from "../../types";
import { branch, composite } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { NarrowedChain, Unchanged } from "../../plugin-kit/marker.types";

export interface DependentSchemasExtra {
  readonly trigger: string;
}

export const objectDependentSchemasPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [schemas: Readonly<Record<string, NarrowedChain>>];
  out: Unchanged;
  context: DependentSchemasExtra;
}>()({
  name: "objectDependentSchemas",
  method: "dependentSchemas",
  slots: ["object"] as const,
  build: (ctx, schemas) =>
    composite<DependentSchemasExtra>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches: Object.entries(schemas).map(([trigger, rules]) =>
        branch(trigger, rules)
      ),
      combine: (runners) => (value, runCtx) => {
        if (!isPlainObject(value)) return PASS;
        for (const runner of runners) {
          if (value[runner.label] === undefined) continue;
          const outcome = runner.run(value, runCtx);
          if (!outcome.ok)
            return fail({ ...outcome.detail, branch: runner.label });
        }
        return PASS;
      },
      describe: (detail) =>
        `The schema required by "${String(detail.branch)}" did not match`,
      buildMessageContext: (detail) => ({
        trigger: isString(detail.branch) ? detail.branch : "",
      }),
    }),
});
