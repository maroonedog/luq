// ===========================================================================
// L7  src/plugins/object-property-names/object-property-names.ts
// A PROPERTY-KEY sub-chain. The subject is the key, a string. It is not
// reachable from TValue by any route -- not through ElementOf, not through
// Present, not through PropertyValueOf -- which is why the registry needed a
// second new marker rather than a reuse of the first.
// ===========================================================================
import { PASS, fail, isPlainObject, isStringArray } from "../../types";
import { branch, composite } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type {
  PropertyKeyChain,
  Unchanged,
} from "../../plugin-kit/marker.types";

export interface PropertyNamesExtra {
  readonly invalidPropertyNames: readonly string[];
}

/**
 * WHICH argument positions carry a sub-chain cannot be recovered from a
 * plugin's type at run time — a NarrowedChain and a RootPredicate are both
 * plain functions once erased — so src/chain/collect-branch-rules.ts reads it
 * from this declared field. definePlugin's spec does not carry it yet (see
 * needsFromOthers), which is why it is spread on rather than passed in.
 */
export const objectPropertyNamesPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [define: PropertyKeyChain];
  out: Unchanged;
  context: PropertyNamesExtra;
}>()({
  name: "objectPropertyNames",
  method: "propertyNames",
  slots: ["object"] as const,
  build: (ctx, define) =>
    composite<PropertyNamesExtra>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches: [branch("propertyName", define)],
      combine: (runners) => {
        const runner = runners[0];
        if (runner === undefined) return () => PASS;
        return (value, runCtx) => {
          if (!isPlainObject(value)) return PASS;
          const invalid = Object.keys(value).filter(
            (key) => !runner.run(key, runCtx).ok
          );
          return invalid.length === 0 ? PASS : fail({ actual: invalid });
        };
      },
      describe: (detail) => `Invalid property names: ${String(detail.actual)}`,
      buildMessageContext: (detail) => ({
        invalidPropertyNames: isStringArray(detail.actual) ? detail.actual : [],
      }),
    }),
  subChainArguments: [0],
});
