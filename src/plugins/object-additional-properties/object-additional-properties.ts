// ===========================================================================
// L7  src/plugins/object-additional-properties/object-additional-properties.ts
// Draft-07's BOOLEAN form: `additionalProperties: false` forbids any key the
// sibling declarations did not name. Deliberately marker-free so L8 can bind
// the keyword directly; the schema form lives in its sibling module because a
// sub-chain cannot come out of a JSON document.
// `allowedProperties` stays optional so a hand-written key list keeps working;
// omitted, the known set comes from ctx.declaredSiblingKeys.
// ===========================================================================
import { PASS, fail, isPlainObject, isStringArray } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import {
  compilePatterns,
  selectAdditionalKeys,
} from "./select-additional-keys";

export interface UnexpectedPropertiesExtra {
  readonly extraProperties: readonly string[];
}

export const objectAdditionalPropertiesPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [
    allowed: boolean,
    allowedProperties?: readonly string[],
    allowedPatterns?: readonly string[],
  ];
  out: Unchanged;
  context: UnexpectedPropertiesExtra;
}>()({
  name: "objectAdditionalProperties",
  method: "additionalProperties",
  slots: ["object"] as const,
  build: (ctx, allowed, allowedProperties, allowedPatterns) => {
    const known: ReadonlySet<string> = new Set(
      allowedProperties ?? ctx.declaredSiblingKeys
    );
    const patterns = compilePatterns(allowedPatterns);
    return check<UnexpectedPropertiesExtra>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) => {
        if (allowed) return PASS;
        if (!isPlainObject(value)) return PASS;
        const extra = selectAdditionalKeys(value, known, patterns);
        return extra.length === 0 ? PASS : fail({ actual: extra });
      },
      describe: (detail) => `Unexpected properties: ${String(detail.actual)}`,
      buildMessageContext: (detail) => ({
        extraProperties: isStringArray(detail.actual) ? detail.actual : [],
      }),
    });
  },
});
