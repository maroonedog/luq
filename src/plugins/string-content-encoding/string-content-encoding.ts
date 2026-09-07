// ===========================================================================
// L7  src/plugins/string-content-encoding/string-content-encoding.ts
// `.contentEncoding(name)` — the runtime half of JSON Schema's
// contentEncoding keyword, and the ONE place in src that knows what a base64
// payload looks like.
//
// The accepted set is a closed union, and an unknown name is a BUILD-TIME
// error rather than a validator that silently passes everything: a rule that
// accepts every input is worse than a configuration that refuses to load.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import {
  findContentEncodingCheck,
  type ContentEncodingName,
} from "./content-encoding-checks";

export type { ContentEncodingName };

export const stringContentEncodingPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [encoding: ContentEncodingName];
  out: Unchanged;
  context: { readonly encoding: string };
}>()({
  name: "stringContentEncoding",
  method: "contentEncoding",
  slots: ["string"] as const,
  build: (ctx, encoding) => {
    const isEncoded = isString(encoding)
      ? findContentEncodingCheck(encoding)
      : undefined;
    if (isEncoded === undefined) {
      throw new PluginArgumentError(ctx.pluginName, "encoding", encoding);
    }
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || isEncoded(value)
          ? PASS
          : fail({ expected: encoding, actual: value }),
      describe: () => `Value must be valid ${encoding} encoded content`,
      buildMessageContext: () => ({ encoding }),
    });
  },
});
