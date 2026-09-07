// ===========================================================================
// L7  src/plugins/read-only/read-only.ts
// JSON Schema's readOnly as an access check: on a WRITE that updates an
// existing record, a read-only field may not carry a value.
//
// 1.x defined this and writeOnly in ONE file and exported only the first, so
// `.writeOnly()` was unreachable even though the two keywords are peers
// (docs/legacy-spec/public-api-surface.md). They are two directories now.
//
// The operation arrives on the same channel every other contextual plugin
// reads, RuleContext.external, instead of 1.x's third `context` argument that
// no execution path ever supplied.
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

/** 1.x's default when the context says nothing is "write". */
function isWriteOperation(context: Readonly<Record<string, unknown>>): boolean {
  return context["operation"] !== "read";
}

export const readOnlyPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "readOnly",
  method: "readOnly",
  slots: ACCESS_SLOTS,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value, runCtx) => {
        const external = readExternalContext(runCtx, isPlainObject);
        if (external === undefined || !isWriteOperation(external)) return PASS;
        if (external["isUpdate"] !== true || value === undefined) return PASS;
        return fail({ actual: value });
      },
      describe: (_detail, msgCtx) =>
        `${msgCtx.path} is read-only and cannot be modified`,
      buildMessageContext: () => ({}),
    }),
});
