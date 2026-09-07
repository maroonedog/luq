// ===========================================================================
// L7  src/plugins/string-uri-template/string-uri-template.ts
// `.uriTemplate()` and the Draft-07 `uri-template` format.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import type { MessageContextExtra } from "../../types";
import { isUriTemplate } from "./uri-template";

export const stringUriTemplatePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "stringUriTemplate",
  method: "uriTemplate",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || isUriTemplate(value)
          ? PASS
          : fail({ actual: value }),
      describe: () => "Value must be a valid URI Template (RFC 6570)",
      buildMessageContext: () => ({}),
    }),
});
