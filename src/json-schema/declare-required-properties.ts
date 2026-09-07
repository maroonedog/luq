// ===========================================================================
// L8  src/json-schema/declare-required-properties.ts — `required`, as a rule on
// the OBJECT rather than on each named child.
//
// The distinction decides verdicts, so it is worth a file of its own. See the
// doc comment below; the short version is that a child's presence rule cannot
// tell "the property is missing from an object that IS there" from "the whole
// object is absent", and Draft-07 applies a sub-schema only to a value that is
// there.
//
// This is also the reason the `required` KEYWORD BINDING in keyword-map-object.ts
// is not the mechanism here: `.required()` is a presence rule on ONE field, and
// it additionally treats "" as absent (1.x's form emptiness), which §6.5.3 does
// not. The binding stays as the type-checked record that `required` maps to
// `.required()`; the converter needs the object-level question instead.
// ===========================================================================
import { check } from "../plugin-kit/create-rule";
import type { Rule } from "../plugin-kit/compiled-rule";
import { PASS, fail, isArray, isPlainObject } from "../types";
import type { Draft07SchemaObject } from "./draft07.types";
import type { StructuralContext } from "./structural-expansion.types";

const NO_RULES: readonly Rule[] = Object.freeze([]);

/**
 * `required` as a rule on the OBJECT, not as a presence rule on each child.
 *
 * The difference decides a verdict. A child's presence rule fires whenever the
 * child reads `undefined`, which includes the case where the PARENT is absent —
 * so `{properties:{a:{properties:{b:{}},required:["b"]}}}` would refuse `{}`,
 * although Draft-07 applies a sub-schema only to a value that is there. Asking
 * the object itself asks the question the draft asks, and §6.5.3 also says a
 * NON-object is none of `required`'s business, which is why a non-object passes.
 *
 * The document ROOT is the exception and is handled in flatten-schema.ts: it has
 * no declarable path to carry this rule, and it is always present anyway
 * (src/runtime/create-validator.ts refuses a missing root before the plan runs).
 */
export function declareRequiredProperties(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const required = schema.required;
  if (required === undefined || required.length === 0) return NO_RULES;
  const missingOf = (value: Record<string, unknown>): readonly string[] =>
    required.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  return Object.freeze([
    check({
      code: "required",
      severity: context.build.config.defaultSeverity,
      run: (value) => {
        if (!isPlainObject(value)) return PASS;
        const missing = missingOf(value);
        return missing.length === 0
          ? PASS
          : fail({ expected: required, actual: missing });
      },
      describe: (detail) =>
        `Missing required propert${
          isArray(detail.actual) && detail.actual.length === 1 ? "y" : "ies"
        }: ${String(detail.actual)}`,
      buildMessageContext: () => ({}),
    }),
  ]);
}
