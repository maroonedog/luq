// ===========================================================================
// L7  src/plugins/string-url/string-url.ts
// `.url(options?)`, and the Draft-07 `uri` format's single home.
//
// Parsing is the platform `URL` constructor, never a regex, so there is no
// second URL grammar in src to drift from this one. `protocols` values carry
// their colon ("https:"), matching 1.x; omitting it accepts every scheme
// (mailto:, tel:, ws:, ftp: all pass), which is also 1.x.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";

export interface UrlFormatOptions {
  /** Accepted schemes, colon included: ["https:", "http:"]. */
  readonly protocols?: readonly string[];
  /** When true, a value with no "://" is parsed as if prefixed by https://. */
  readonly allowWithoutProtocol?: boolean;
}

function parseUrl(text: string): URL | undefined {
  try {
    return new URL(text);
  } catch {
    return undefined;
  }
}

export const stringUrlPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [options?: UrlFormatOptions];
  out: Unchanged;
  context: { readonly protocol: string };
}>()({
  name: "stringUrl",
  method: "url",
  slots: ["string"] as const,
  build: (ctx, options) => {
    const protocols = options?.protocols;
    const allowWithoutProtocol = options?.allowWithoutProtocol === true;
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) => {
        if (!isString(value)) return PASS;
        const text =
          allowWithoutProtocol && !value.includes("://")
            ? `https://${value}`
            : value;
        const parsed = parseUrl(text);
        if (parsed === undefined) return fail({ actual: value });
        if (protocols !== undefined && !protocols.includes(parsed.protocol)) {
          return fail({ expected: parsed.protocol, actual: value });
        }
        return PASS;
      },
      describe: () => "Invalid URL format",
      buildMessageContext: (detail) => ({
        protocol: isString(detail.expected) ? detail.expected : "",
      }),
    });
  },
});
