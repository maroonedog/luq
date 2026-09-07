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
// ===========================================================================
import { PASS, fail, isArray, type MessageContextExtra } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import {
  definePlugin,
  PluginArgumentError,
} from "../../plugin-kit/plugin-definition";
import type { SelfValue, Unchanged } from "../../plugin-kit/marker.types";

/** Above this many members a Set beats a linear scan. Legacy used the same. */
const SET_MEMBERSHIP_THRESHOLD = 7;

function describeAllowed(allowed: readonly unknown[]): string {
  return allowed.map((member) => JSON.stringify(member)).join(", ");
}

/** One membership test, decided ONCE at build time and never re-decided. */
function createMembershipTest(
  allowed: readonly unknown[]
): (value: unknown) => boolean {
  if (allowed.length > SET_MEMBERSHIP_THRESHOLD) {
    const members = new Set<unknown>(allowed);
    return (value) => members.has(value);
  }
  return (value) => allowed.includes(value);
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
