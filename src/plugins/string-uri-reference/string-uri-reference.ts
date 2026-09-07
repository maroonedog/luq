// ===========================================================================
// L7  src/plugins/string-uri-reference/string-uri-reference.ts
// `.uriReference()` and the Draft-07 `uri-reference` format. Before this
// plugin existed the format map declared the name UNSUPPORTED, so a schema
// carrying it threw at build time and produced no validator at all.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import type { MessageContextExtra } from "../../types";
import { isUriReference } from "./uri-reference";

export const stringUriReferencePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "stringUriReference",
  method: "uriReference",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || isUriReference(value)
          ? PASS
          : fail({ actual: value }),
      describe: () => "Value must be a valid URI-reference (RFC 3986)",
      buildMessageContext: () => ({}),
    }),
});
