// ===========================================================================
// L7  src/plugins/string-content-media-type/string-content-media-type.ts
// `.contentMediaType(name)` — the runtime half of JSON Schema's
// contentMediaType keyword.
//
// Two 1.x behaviours are deliberately dropped:
//   - the `encoding: "base64"` option, which decoded the value here. base64
//     lives in string-content-encoding and nowhere else; compose the two.
//   - the "unknown media type passes everything" fallback. An unrecognisable
//     media type is a build-time error instead.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import { findMediaTypeCheck } from "./media-type-checks";

export const stringContentMediaTypePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [mediaType: string];
  out: Unchanged;
  context: { readonly mediaType: string };
}>()({
  name: "stringContentMediaType",
  method: "contentMediaType",
  slots: ["string"] as const,
  build: (ctx, mediaType) => {
    const isRecognised = isString(mediaType)
      ? findMediaTypeCheck(mediaType)
      : undefined;
    if (isRecognised === undefined) {
      throw new PluginArgumentError(ctx.pluginName, "mediaType", mediaType);
    }
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || isRecognised(value)
          ? PASS
          : fail({ expected: mediaType, actual: value }),
      describe: () => `Value must be valid ${mediaType} content`,
      buildMessageContext: () => ({ mediaType }),
    });
  },
});
