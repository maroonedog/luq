// ===========================================================================
// test/support/probe-config-plugins.ts — the two plugins that PROVE the L2
// members added by the core stage are wired. A type nobody calls is how
// withAsyncContext and refine* disappeared the first time, so each addition
// keeps a real reader here.
//
// They are fixtures, not catalog entries: neither name appears in
// docs/legacy-public-surface.md, and a plugin under src/plugins/ is a published
// subpath. Moved out of src at the catalog-integration gate so that
// src/plugins/ contains plugin directories and nothing else.
// ===========================================================================
import { PASS, fail, isPlainObject, isString } from "../../src/types";
import { check } from "../../src/plugin-kit/create-rule";
import { definePlugin } from "../../src/plugin-kit/plugin-definition";
import { readExternalContext } from "../../src/plugin-kit/external-context";
import type { Unchanged } from "../../src/plugin-kit/marker.types";

const EVERY_SLOT = [
  "string",
  "number",
  "boolean",
  "date",
  "array",
  "tuple",
  "object",
  "union",
  "any",
] as const;

/**
 * READS RuleBuildContext.config. Every GlobalConfig member 1.x used for this
 * check — toBooleanTruthyValues, trimStrings, caseSensitive — is read ONCE, at
 * build time, and closed over. The rule that runs touches no global.
 */
export const stringTruthyPlugin = definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: { accepted: readonly string[] };
}>()({
  name: "stringTruthy",
  method: "truthy",
  slots: ["string"] as const,
  build: (ctx) => {
    const { caseSensitive, toBooleanTruthyValues, trimStrings } = ctx.config;
    const accepted = caseSensitive
      ? toBooleanTruthyValues
      : toBooleanTruthyValues.map((entry) => entry.toLowerCase());
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) => {
        if (!isString(value)) return PASS;
        const trimmed = trimStrings ? value.trim() : value;
        const compared = caseSensitive ? trimmed : trimmed.toLowerCase();
        return accepted.includes(compared)
          ? PASS
          : fail({ expected: accepted, actual: value });
      },
      describe: () => `Value must be one of ${accepted.join(", ")}`,
      buildMessageContext: () => ({ accepted }),
    });
  },
});

type FlagBag = Readonly<Record<string, boolean>>;

function isFlagBag(value: unknown): value is FlagBag {
  return (
    isPlainObject(value) &&
    Object.values(value).every((entry) => typeof entry === "boolean")
  );
}

/**
 * READS RuleContext.external through readExternalContext — i.e. the resolved
 * async context. This is 1.x's fromContext with `required: true` actually
 * wired: plugin-catalog-relational.md:76 records that the real path was
 * unreachable and the required form always failed. Here `required` is the
 * second argument and the failing branch is the one that runs.
 */
export const externalFlagPlugin = definePlugin<{
  args: readonly [key: string, required: boolean];
  out: Unchanged;
  context: { key: string };
}>()({
  name: "externalFlag",
  method: "externalFlag",
  slots: EVERY_SLOT,
  build: (ctx, key, required) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (_value, runCtx) => {
        const flags = readExternalContext(runCtx, isFlagBag);
        if (flags === undefined)
          return required ? fail({ expected: key }) : PASS;
        return flags[key] === true
          ? PASS
          : fail({ expected: key, actual: flags[key] });
      },
      describe: () => `Async context flag "${key}" is not set`,
      buildMessageContext: () => ({ key }),
    }),
});
