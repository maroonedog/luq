// ===========================================================================
// L7  src/plugins/uuid/uuid.ts
// `.uuid(version?)`. The DIRECTORY is `uuid`, not `string-uuid`, so the 1.x
// subpath `@maroonedog/luq/plugins/uuid` needs no override.
//
// 1.x carried three names for one thing (export `uuidPlugin`, registry name
// "stringUuid", method "uuid") and emitted TWO codes from one plugin ("uuid"
// with no argument, "uuidVersion" with one). Here the registry name is "uuid",
// so the export, the method, the directory, the subpath and the default error
// code are all the same word, and an argument never moves the code.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isArray, isString } from "../../types";

/** 1.x supports 1, 3, 4, 5, 6, 7 and 8. Version 2 is deliberately absent. */
export type UuidVersion = 1 | 3 | 4 | 5 | 6 | 7 | 8;

const SUPPORTED_VERSIONS: readonly number[] = [1, 3, 4, 5, 6, 7, 8];

/** Version nibble 1-8, variant nibble 8/9/a/b, case-insensitive. */
const ANY_VERSION =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function patternForVersion(version: UuidVersion): RegExp {
  return new RegExp(
    `^[0-9a-f]{8}-[0-9a-f]{4}-${String(version)}[0-9a-f]{3}-` +
      `[89ab][0-9a-f]{3}-[0-9a-f]{12}$`,
    "i"
  );
}

function toVersionList(
  version: UuidVersion | readonly UuidVersion[] | undefined
): readonly UuidVersion[] {
  if (version === undefined) return [];
  return isArray(version) ? version : [version];
}

export const uuidPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [version?: UuidVersion | readonly UuidVersion[]];
  out: Unchanged;
  context: { readonly versions: readonly number[] };
}>()({
  name: "uuid",
  method: "uuid",
  slots: ["string"] as const,
  build: (ctx, version) => {
    const versions = toVersionList(version);
    for (const candidate of versions) {
      if (!SUPPORTED_VERSIONS.includes(candidate)) {
        throw new PluginArgumentError(ctx.pluginName, "version", candidate);
      }
    }
    const patterns =
      versions.length === 0 ? [ANY_VERSION] : versions.map(patternForVersion);
    const printed =
      versions.length === 0
        ? ""
        : `v${versions.map((each) => String(each)).join(", v")} `;
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || patterns.some((pattern) => pattern.test(value))
          ? PASS
          : fail({ actual: value }),
      describe: () => `Value must be a valid UUID ${printed}format`,
      buildMessageContext: () => ({ versions }),
    });
  },
});
