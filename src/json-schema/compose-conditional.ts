// ===========================================================================
// L8  src/json-schema/compose-conditional.ts — if / then / else.
//
// ONE IMPLEMENTATION, TWO FRONT DOORS. The rule this module produces is not a
// copy of the one `.conditionalSchema()` produces: it IS that one. A plugin's
// `build()` receives its sub-chain arguments already RESOLVED to
// `readonly Rule[]` (src/plugin-kit/runtime-args.types.ts maps NarrowedChain
// to exactly that), so the converter can hand the plugin the rules it derived
// from `if` / `then` / `else` and get back the identical CompositeRule a
// hand-written chain would have produced. The routing — evaluate `if`, run
// `then` or `else`, a missing arm passes — lives in the plugin and nowhere
// else, which is what 1.x could not say: its converter wrapped three JSONSchema7
// documents in `chain.custom()` and evaluated them with a private recursive
// interpreter that disagreed with the plugin about `type` and `enum`.
//
// Draft-07 §6.6.2/6.6.3: `then` and `else` are INERT without `if`. That is why
// the whole expansion hangs off `if` and why the keyword table records `then`
// and `else` as consumed by this module rather than as expansions of their own.
// ===========================================================================
import type { Rule } from "../plugin-kit/compiled-rule";
import type { ConditionalSchemaContext } from "../plugins/conditional-schema";
import type { Draft07Schema, Draft07SchemaObject } from "./draft07.types";
import type { StructuralContext } from "./structural-expansion.types";

const NO_RULES: readonly Rule[] = Object.freeze([]);

/** An absent arm stays absent: the plugin treats `undefined` as "passes". */
function readArm(
  arm: Draft07Schema | undefined,
  context: StructuralContext
): readonly Rule[] | undefined {
  return arm === undefined ? undefined : context.collectSubSchemaRules(arm);
}

export function composeConditional(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const condition = schema.if;
  if (condition === undefined) return NO_RULES;
  const plugin = context.bag.conditionalSchema;
  return Object.freeze([
    plugin.build(
      context.ruleContextFor<ConditionalSchemaContext>(plugin.name, "if"),
      context.collectSubSchemaRules(condition),
      readArm(schema.then, context),
      readArm(schema.else, context)
    ),
  ]);
}
