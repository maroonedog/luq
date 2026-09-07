// ===========================================================================
// L7  src/plugins/one-of/one-of.ts — the legacy VALUE enum.
//
// `readonly SelfValue[]` types the list against the field: at the call site it
// is `readonly string[]` on a string chain and `readonly unknown[]` inside
// build(). That also makes it correctly NON-bindable by bindKeyword, whose
// PluginArgs is the DECLARED tuple — binding it as if declared == runtime
// would hand JSON Schema a list of markers.
//
// Distinct from the COMPOSITION keyword `oneOf` (src/plugins/composition/),
// which takes sub-schemas rather than values.
//
// MEMBERSHIP IS STRUCTURAL. `allowed.includes` compares by reference, so a list
// holding `{"a":1}` or `[1,2]` could never match a parsed document — measured
// on the official Draft-07 suite, that cost 17 of 929 cases through the `enum`
// keyword, which is this plugin's other front door. The one definition lives in
// src/plugin-kit/is-json-value-equal.ts and `unique` and `includes` use it too.
// The Set fast path is kept for the case it was written for and can still be
// taken: a list whose members are ALL primitives, where SameValueZero and
// structural equality are the same answer.
// ===========================================================================
import { PASS, fail, isArray, type MessageContextExtra } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import {
  definePlugin,
  PluginArgumentError,
} from "../../plugin-kit/plugin-definition";
import { isJsonValueEqual } from "../../plugin-kit/is-json-value-equal";
import type { SelfValue, Unchanged } from "../../plugin-kit/marker.types";

/** Above this many members a Set beats a linear scan. Legacy used the same. */
const SET_MEMBERSHIP_THRESHOLD = 7;

function describeAllowed(allowed: readonly unknown[]): string {
  return allowed.map((member) => JSON.stringify(member)).join(", ");
}

/** A Set answers with SameValueZero, which is only the whole answer here when
 *  no member has a structure to compare. `null` is a primitive for this. */
function areAllMembersPrimitive(allowed: readonly unknown[]): boolean {
  return allowed.every(
    (member) => member === null || typeof member !== "object"
  );
}

/** One membership test, decided ONCE at build time and never re-decided. */
function createMembershipTest(
  allowed: readonly unknown[]
): (value: unknown) => boolean {
  if (
    allowed.length > SET_MEMBERSHIP_THRESHOLD &&
    areAllMembersPrimitive(allowed)
  ) {
    const members = new Set<unknown>(allowed);
    return (value) => members.has(value);
  }
  return (value) => allowed.some((member) => isJsonValueEqual(member, value));
}

export const oneOfPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [allowed: readonly SelfValue[]];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "oneOf",
  method: "oneOf",
  slots: ["string", "number", "boolean"] as const,
  build: (ctx, allowed) => {
    if (!isArray(allowed) || allowed.length === 0) {
      throw new PluginArgumentError(ctx.pluginName, "allowed", allowed);
    }
    const isMember = createMembershipTest(allowed);
    const rendered = describeAllowed(allowed);
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        isMember(value) ? PASS : fail({ expected: allowed, actual: value }),
      describe: () => `Value must be one of: ${rendered}`,
      buildMessageContext: () => ({}),
    });
  },
});
