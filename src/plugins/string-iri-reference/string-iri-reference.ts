// ===========================================================================
// L7  src/plugins/string-iri-reference/string-iri-reference.ts
// `.iriReference()` and the Draft-07 `iri-reference` format.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import type { MessageContextExtra } from "../../types";
import { isIriReference } from "./iri-reference";

export const stringIriReferencePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "stringIriReference",
  method: "iriReference",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || isIriReference(value)
          ? PASS
          : fail({ actual: value }),
      describe: () => "Value must be a valid IRI-reference (RFC 3987)",
      buildMessageContext: () => ({}),
    }),
});
