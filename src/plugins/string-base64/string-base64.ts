// ===========================================================================
// L7  src/plugins/string-base64/string-base64.ts
// `.base64(options?)`. Recognition only — nothing here decodes, so there is no
// Buffer/atob dependency and no environment-specific answer. The one place
// that owns base64 as an ENCODING is string-content-encoding.
//
// 1.x semantics kept verbatim: the empty string is valid, the length must be a
// multiple of 4, and padding is required in urlSafe mode too.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";

const STANDARD = /^[A-Za-z0-9+/]*={0,2}$/;
const URL_SAFE = /^[A-Za-z0-9\-_]*={0,2}$/;

export interface Base64FormatOptions {
  /** Selects the "-_" alphabet in place of "+/". */
  readonly urlSafe?: boolean;
}

export const stringBase64Plugin = /*#__PURE__*/ definePlugin<{
  args: readonly [options?: Base64FormatOptions];
  out: Unchanged;
  context: { readonly urlSafe: boolean };
}>()({
  name: "stringBase64",
  method: "base64",
  slots: ["string"] as const,
  build: (ctx, options) => {
    const urlSafe = options?.urlSafe === true;
    const pattern = urlSafe ? URL_SAFE : STANDARD;
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) => {
        if (!isString(value) || value.length === 0) return PASS;
        return value.length % 4 === 0 && pattern.test(value)
          ? PASS
          : fail({ actual: value });
      },
      describe: () => "Value must be a valid base64 encoded string",
      buildMessageContext: () => ({ urlSafe }),
    });
  },
});
