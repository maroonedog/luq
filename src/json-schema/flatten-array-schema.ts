// ===========================================================================
// L8  src/json-schema/flatten-array-schema.ts — `items`, `additionalItems`,
// `contains`.
//
// TWO SHAPES, ONE KEYWORD. `items` is either a schema (every element) or an
// ARRAY of schemas (position i constrains element i). 1.x read only the first
// shape and guessed the method name `tupleBuilder` for the second, which is not
// a chain method, so the tuple form silently constrained nothing.
//
//   single form  ->  a CHILD DECLARATION at `path[*]`. That is better than
//                    `.each()` here: the element gets a real declared path, so
//                    its own `properties` become `path[*].name` and an issue
//                    renders as `tags[2].name` rather than as a nested cause.
//   tuple form   ->  ONE composite, built from create-rule.
//
// WHY NOT tupleBuilder (measured, not assumed): tupleBuilderPlugin rejects a
// NON-ARRAY and enforces a LENGTH — exactly `value.length !== positions.length`
// without a rest chain, and `value.length < positions.length` with one. Draft-07
// §6.4 / §9.3.1 does neither: a non-array is not an array constraint's business
// at all, a SHORT array is valid, and a LONG array is `additionalItems`' to
// judge. Binding the tuple form to `.builder()` would therefore reject
// documents the schema permits. The composite below is the same rule KIND,
// with the draft's semantics.
// ===========================================================================
import { readChainRules } from "../chain/create-chain-node";
import { createFieldSlots } from "../chain/create-field-slots";
import { composite } from "../plugin-kit/create-rule";
import { applyKeywordBinding } from "./apply-keyword-binding";
import type { ConverterChain } from "./apply-keyword-binding";
import type { JsonSchemaBag } from "./json-schema-bag.types";
import {
  maxItemsBinding,
  minItemsBinding,
  uniqueItemsBinding,
} from "./keyword-map-array";
import type { BranchRunner, Rule } from "../plugin-kit/compiled-rule";
import { PASS, fail, isArray, isNumber } from "../types";
import type { CheckOutcome, RuleContext } from "../types";
import type { Draft07Schema, Draft07SchemaObject } from "./draft07.types";
import { toSchemaObject } from "./collect-definitions";
import type {
  ChildSchema,
  StructuralContext,
} from "./structural-expansion.types";

/** The declaration step for "every element of this array". */
export const EACH_STEP = "[*]";

const NO_CHILDREN: readonly ChildSchema[] = Object.freeze([]);
const NO_RULES: readonly Rule[] = Object.freeze([]);

/** True for the tuple form of `items`, which is an ARRAY of schemas. */
function isTupleItems(
  items: Draft07Schema | readonly Draft07Schema[] | undefined
): items is readonly Draft07Schema[] {
  return isArray(items);
}

/**
 * The single form only. The tuple form gets no child path: element 0 and
 * element 1 obey DIFFERENT schemas, and one declared `[*]` cannot say that.
 */
export function readItemChildren(
  schema: Draft07SchemaObject
): readonly ChildSchema[] {
  const items = schema.items;
  if (items === undefined || isTupleItems(items)) return NO_CHILDREN;
  return Object.freeze([{ step: EACH_STEP, schema: items, isRequired: false }]);
}

/**
 * Element i against position i, extra elements against `additionalItems`.
 * A non-array passes, a short array passes, and `additionalItems: false`
 * becomes the schema that matches nothing (collect-definitions), so the
 * "no extra elements" case needs no fourth branch kind.
 */
function applyPositionally(
  runners: readonly BranchRunner[],
  positionCount: number,
  hasRest: boolean
): (value: unknown, ctx: RuleContext) => CheckOutcome {
  return (value, ctx) => {
    if (!isArray(value)) return PASS;
    for (let index = 0; index < value.length; index += 1) {
      const runner =
        index < positionCount
          ? runners[index]
          : hasRest
            ? runners[positionCount]
            : undefined;
      if (runner === undefined) continue;
      const outcome = runner.run(value[index], ctx);
      if (!outcome.ok) return fail({ ...outcome.detail, index });
    }
    return PASS;
  };
}

function describePosition(index: number): string {
  return index < 0
    ? "An element does not match the schema declared for its position"
    : `Element ${String(index)} does not match the schema declared for it`;
}

export function composeTupleItems(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const items = schema.items;
  if (items === undefined || !isTupleItems(items)) return NO_RULES;
  const branches = items.map((position, index) =>
    context.toBranch(`position:${String(index)}`, position)
  );
  const rest = schema.additionalItems;
  const hasRest = rest !== undefined;
  if (rest !== undefined) branches.push(context.toBranch("rest", rest));
  const positionCount = items.length;
  return Object.freeze([
    composite({
      code: "items",
      severity: context.build.config.defaultSeverity,
      branches,
      combine: (runners) => applyPositionally(runners, positionCount, hasRest),
      describe: (detail) =>
        describePosition(isNumber(detail.index) ? detail.index : -1),
      buildMessageContext: () => ({}),
    }),
  ]);
}

/**
 * `contains` is EXISTENTIAL: at least one element matches. arrayContains owns
 * that reduction, and its default bounds (min 1, no max) are exactly the
 * draft's, so this is one call and no arithmetic.
 */
export function composeContains(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const contains = schema.contains;
  if (contains === undefined) return NO_RULES;
  const element = context.collectSubSchemaRules(toSchemaObject(contains));
  return Object.freeze([
    context.bag.arrayContains.build(
      context.ruleContextFor(context.bag.arrayContains.name, "contains"),
      element
    ),
  ]);
}

/**
 * The three array keywords that BIND. `minItems` maps to the method `minLength`
 * and `maxItems` to `maxLength`; writing "minItems" as the method name does not
 * compile (keyword-map-array.ts), which is the C2 regression made impossible.
 * `uniqueItems: false` never reaches its binding: §6.4.3 gives it no effect and
 * the binding's value type is `true`.
 */
export function declareArrayRules(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  let chain: ConverterChain<"array"> = createFieldSlots<
    unknown,
    JsonSchemaBag,
    unknown
  >(context.bag, context.build).array;
  if (schema.minItems !== undefined) {
    chain = applyKeywordBinding(chain, minItemsBinding, schema.minItems);
  }
  if (schema.maxItems !== undefined) {
    chain = applyKeywordBinding(chain, maxItemsBinding, schema.maxItems);
  }
  if (schema.uniqueItems === true) {
    chain = applyKeywordBinding(chain, uniqueItemsBinding, true);
  }
  return readChainRules(chain) ?? NO_RULES;
}
