// ===========================================================================
// L7  src/plugins/value-plugins.ts — value equality. Marker-free, so the
// Draft-07 keyword table can bind `const` to it.
//
// NOTE (composition decision, see the judgment): the marker-free `oneOf` that
// once lived here has been REMOVED. There is exactly one `oneOf` plugin now,
// src/plugins/value/one-of.ts, and it types its allowed-value list against the
// field through the SelfValue marker. That makes it correctly non-bindable, so
// the Draft-07 `enum` keyword is `structural` rather than a binding.
// ===========================================================================
import { PASS, fail } from "../types";
import { definePlugin } from "../plugin-kit/plugin-definition";
import { check } from "../plugin-kit/create-rule";
import type { Unchanged } from "../plugin-kit/marker.types";

/** JSON Schema `const` lands here. */
export const literalPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [expected: unknown];
  out: Unchanged;
  context: { expected: unknown };
}>()({
  name: "literal",
  method: "literal",
  slots: [
    "string",
    "number",
    "boolean",
    "date",
    "array",
    "tuple",
    "object",
    "union",
    "any",
  ] as const,
  build: (ctx, expected) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        value === expected ? PASS : fail({ expected, actual: value }),
      describe: () => "Value does not equal the required constant",
      buildMessageContext: () => ({ expected }),
    }),
});
