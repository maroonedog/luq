// ===========================================================================
// L7  src/plugins/array-includes/array-includes.ts
//
// Legacy semantics (docs/legacy-spec/plugin-catalog-structural.md#arrayIncludesPlugin):
// a non-array PASSES, an array must contain `element` under SameValueZero
// (Array.prototype.includes: NaN is found, objects compare by identity), the
// default message is `Array must include <json>` and the message context is
// {element}.
//
// The element stays `unknown` rather than a marker: the marker registry is
// closed and has no "one element of the subject" ARGUMENT marker — ElementChain
// resolves to a sub-chain, and SelfValue resolves to the array itself, which
// would type `includes` as taking a whole array. Legacy typed it `TElement =
// any`, so nothing is lost, and `unknown` is honest about it.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isArray } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import { isSameValueZero } from "../../plugin-kit/is-json-value-equal";

export interface ArrayIncludesContext {
  readonly element: unknown;
}

export const arrayIncludesPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [element: unknown];
  out: Unchanged;
  context: ArrayIncludesContext;
}>()({
  name: "arrayIncludes",
  method: "includes",
  slots: ["array", "tuple"] as const,
  build: (ctx, element) =>
    check<ArrayIncludesContext>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) => {
        if (!isArray(value)) return PASS;
        return value.some((candidate) => isSameValueZero(candidate, element))
          ? PASS
          : fail({ expected: element, actual: value });
      },
      describe: () => `Array must include ${String(JSON.stringify(element))}`,
      buildMessageContext: () => ({ element }),
    }),
});
