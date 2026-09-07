// ===========================================================================
// L7  src/plugins/object/object.ts
//
// Legacy semantics (docs/legacy-spec/plugin-catalog-structural.md#objectPlugin):
// the value must be a plain object — an array is not one, and neither is null.
//
// Two legacy defects are NOT carried over:
//   * the code was "type_mismatch", the only snake_case code in the catalog.
//     It is now the plugin name, like every other plugin's;
//   * the message was "Not an object", naming neither the path nor the value.
//     The path is carried by the issue itself, so the message only has to say
//     what was expected and what arrived.
// null / undefined never reach a check (src/runtime/run-field.ts decides
// absence first), so the legacy asymmetry where `.object()` alone rejected
// undefined is gone: required/optional/nullable own that decision.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isArray, isPlainObject } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";

export interface ObjectTypeContext {
  readonly actual: string;
}

/** "array" is worth naming: it is the mistake this plugin exists to catch. */
function describeType(value: unknown): string {
  if (isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

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
      run: (value) =>
        isPlainObject(value)
          ? PASS
          : fail({ expected: "object", actual: describeType(value) }),
      describe: (detail) =>
        `Value must be an object, but got ${String(detail.actual)}`,
      buildMessageContext: (detail) => ({ actual: String(detail.actual) }),
    }),
});
