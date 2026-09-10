// ===========================================================================
// L7  src/plugins/object/object.ts
//
// DEPRECATED, and inert.
//
// This plugin's whole job was "the value is a plain object". Entering
// `b.object` now seeds the chain with that check under the code `objectType`,
// so the decision is made before this rule is ever consulted.
//
// It answers PASS for everything rather than agreeing. Agreeing would put TWO
// issues on one bad value for any caller collecting them all — a form, or
// anything reading the Standard Schema face — and "one invalid value, one
// issue" is the reason the whole catalog delegates type to the slot in the
// first place. Deprecated means inert, not second opinion.
//
// It is kept rather than deleted because removing a published export is a
// major's business. It costs nothing to leave: a caller who does not import it
// does not carry it.
//
// The verdict a caller sees does not change. An array, a primitive and `null`
// are rejected exactly as before; only the code and the wording move to the
// slot. Absence was never this rule's to decide — required / optional /
// nullable own it, and a check never sees `undefined`.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";

export interface ObjectTypeContext {
  readonly actual: string;
}

/**
 * @deprecated Entering `b.object` already checks this, under the code
 * `objectType`. Drop the `.use(objectPlugin)` and the `.object()` call: the
 * field goes on rejecting arrays, `null` and primitives, and only the issue's
 * code and message change.
 */
export const objectPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: ObjectTypeContext;
}>()({
  name: "object",
  method: "object",
  slots: ["object"] as const,
  build: (ctx) =>
    check<ObjectTypeContext>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: () => PASS,
      // Unreachable while run() never fails, and kept so the shape of the rule
      // stays a rule rather than becoming a special case for the engine.
      describe: (detail) =>
        `Value must be an object, but got ${String(detail.actual)}`,
      buildMessageContext: (detail) => ({ actual: String(detail.actual) }),
    }),
});
