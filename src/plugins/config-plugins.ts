// ===========================================================================
// L7  src/plugins/** — the two plugins that PROVE the new L2 members are wired.
// A type nobody calls is how withAsyncContext and refine* disappeared the first
// time, so each addition below has a real reader.
// ===========================================================================
import { PASS, fail, isPlainObject, isString } from "../types";
import { check } from "../plugin-kit/create-rule";
import { definePlugin } from "../plugin-kit/plugin-definition";
import { readExternalContext } from "../plugin-kit/external-context";
import type { Unchanged } from "../plugin-kit/marker.types";

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
export const stringTruthyPlugin = /*#__PURE__*/ definePlugin<{
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
export const externalFlagPlugin = /*#__PURE__*/ definePlugin<{
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
