// ===========================================================================
// L7  src/plugins/write-only/write-only.ts
// JSON Schema's writeOnly as an access check: on a READ, a write-only field
// (a password, a secret) may not carry a value.
//
// The peer of src/plugins/read-only/. 1.x kept both in one file and published
// only readOnly; two directories, two symbols and two subpaths is the fix
// recorded in docs/legacy-spec/public-api-surface.md. The two do not share a
// module on purpose: a plugin may import only plugin-kit, types, path and its
// OWN directory, and that isolation is checked in CI.
// ===========================================================================
import { PASS, fail, isPlainObject } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import { readExternalContext } from "../../plugin-kit/external-context";
import type { MessageContextExtra } from "../../types";
import type { Unchanged } from "../../plugin-kit/marker.types";

const ACCESS_SLOTS = [
  "string",
  "number",
  "boolean",
  "date",
  "array",
  "object",
] as const;

/** 1.x's default when the context says nothing is "write", so read is opt-in. */
function isReadOperation(context: Readonly<Record<string, unknown>>): boolean {
  return context["operation"] === "read";
}

export const writeOnlyPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "writeOnly",
  method: "writeOnly",
  slots: ACCESS_SLOTS,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value, runCtx) => {
        const external = readExternalContext(runCtx, isPlainObject);
        if (external === undefined || !isReadOperation(external)) return PASS;
        return value === undefined ? PASS : fail({ actual: value });
      },
      describe: (_detail, msgCtx) =>
        `${msgCtx.path} is write-only and cannot be read`,
      buildMessageContext: () => ({}),
    }),
});
