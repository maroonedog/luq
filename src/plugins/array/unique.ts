// ===========================================================================
// L7  src/plugins/array/unique.ts
// Marker-free by design: every argument is plain data, so IsMarkerFree<args>
// is true and the Draft-07 keyword table can bind to it. The method name is
// the legacy public surface (docs/legacy-public-surface.md): arrayMinLength's
// method really is `minLength`, NOT `minItems`. The keyword table is where
// `minItems -> minLength` is written down, and that binding is type-checked,
// so the legacy silent duck-typing cannot come back.
// ===========================================================================
import type { MessageContextExtra } from "../../types";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isArray } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";

export const arrayUniquePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "arrayUnique",
  method: "unique",
  slots: ["array", "tuple"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) => {
        if (!isArray(value)) return PASS;
        const seen = new Set<string>();
        for (const element of value) {
          const key = JSON.stringify(element) ?? "undefined";
          if (seen.has(key)) return fail({ actual: element });
          seen.add(key);
        }
        return PASS;
      },
      describe: () => "Array items must be unique",
      buildMessageContext: () => ({}),
    }),
});
