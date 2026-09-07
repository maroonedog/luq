// ===========================================================================
// L7  src/plugins/transform/transform.ts
// `out: TransformOut` is the whole declaration: RuleForOut then DEMANDS that
// build return a TransformRule, and the chain gives this method its own
// signature `<R>(map: (value: Present<TValue, TState>) => R) => ...`, so the
// output type becomes the chain's current type without a cast anywhere.
//
// Order is the engine's, not this plugin's (src/runtime/run-field.ts):
// default -> presence -> gates -> checks -> transforms, and transforms run in
// parse() only, and only when the field's checks all passed. That is 1.x's
// mainline order (docs/legacy-spec/plugin-catalog-relational.md), now the ONLY
// order — the plugin-registry fallback that ran transforms FIRST is gone.
// A throwing map propagates, exactly as 1.x's mainline did.
// ===========================================================================
import { transform } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { MessageContextExtra } from "../../types";
import type { SelfReader, TransformOut } from "../../plugin-kit/marker.types";

/** 1.x's allowedTypes for .transform(): tuple and any are not among them. */
const TRANSFORM_SLOTS = [
  "string",
  "number",
  "boolean",
  "date",
  "array",
  "object",
  "union",
] as const;

export const transformPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [map: SelfReader<unknown>];
  out: TransformOut;
  context: MessageContextExtra;
}>()({
  name: "transform",
  method: "transform",
  slots: TRANSFORM_SLOTS,
  build: (_ctx, map) => transform((value) => map(value)),
});
