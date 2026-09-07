// ===========================================================================
// L8  src/json-schema/declare-value-keywords.ts — the keywords
// that judge the VALUE ITSELF: `type`, `enum` and `const`.
//
// The keyword table calls `type` structural because it "chooses the slot".
// Choosing a slot is a TYPE-LEVEL act and asserts nothing at run time, so a
// converter that only chose a slot would accept `42` for `{"type":"string"}` —
// which is precisely what 1.x did (docs/legacy-spec/json-schema-mapping.md).
// The slot choice is still made, in declare-scalar-keywords; the RULE is made
// here, from create-rule, because no plugin in JsonSchemaBag asserts a
// primitive type (`object` is the only type plugin in the catalogue and it is
// not in the bag).
//
// `null` never reaches a check — src/runtime/decide-presence.ts settles absence
// first — so `type: "null"` reads as "every value that got this far is wrong",
// which is exactly right: the only null-shaped value was already accepted by
// the nullable presence rule this module's neighbour declares.
// ===========================================================================
import { readChainRules } from "../chain/create-chain-node";
import { createFieldSlots } from "../chain/create-field-slots";
import { check } from "../plugin-kit/create-rule";
import type { Rule } from "../plugin-kit/compiled-rule";
import { PASS, fail, isArray, isPlainObject, isString } from "../types";
import { applyKeywordBinding } from "./apply-keyword-binding";
import type { ConverterChain } from "./apply-keyword-binding";
import type { Draft07SchemaObject, Draft07TypeKeyword } from "./draft07.types";
import type { JsonSchemaBag } from "./json-schema-bag.types";
import { constBinding } from "./keyword-map-core";
import type { StructuralContext } from "./structural-expansion.types";

const NO_RULES: readonly Rule[] = Object.freeze([]);

/** Every Draft-07 `type` name, so an unknown one is a build-time refusal. */
const JSON_TYPE_TESTS: Readonly<
  Record<Draft07TypeKeyword, (value: unknown) => boolean>
> = {
  string: isString,
  number: (value) => typeof value === "number",
  integer: (value) => typeof value === "number" && Number.isInteger(value),
  boolean: (value) => typeof value === "boolean",
  array: isArray,
  object: isPlainObject,
  null: (value) => value === null,
};

function isTypeKeyword(name: string): name is Draft07TypeKeyword {
  return Object.prototype.hasOwnProperty.call(JSON_TYPE_TESTS, name);
}

/** The declared names, always as a list, with unknown names rejected loudly. */
export function readDeclaredTypes(
  schema: Draft07SchemaObject
): readonly Draft07TypeKeyword[] {
  const declared = schema.type;
  if (declared === undefined) return Object.freeze([]);
  const names = isArray(declared) ? declared : [declared];
  return Object.freeze(names.filter((name) => isTypeKeyword(name)));
}

/** True when the document permits an explicit null at this position. */
export function permitsNull(schema: Draft07SchemaObject): boolean {
  const declared = readDeclaredTypes(schema);
  return declared.length === 0 || declared.includes("null");
}

function describeActual(value: unknown): string {
  if (value === null) return "null";
  if (isArray(value)) return "array";
  return typeof value;
}

/**
 * One check for the whole list: `type: ["string","number"]` is a union, and
 * running one rule per member would report a failure per member for a value
 * that fails all of them.
 */
export function declareTypeRules(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const declared = readDeclaredTypes(schema);
  if (declared.length === 0) return NO_RULES;
  const tests = declared.map((name) => JSON_TYPE_TESTS[name]);
  const rendered = declared.join(" or ");
  return Object.freeze([
    check({
      code: "type",
      severity: context.build.config.defaultSeverity,
      run: (value) =>
        tests.some((test) => test(value))
          ? PASS
          : fail({ expected: rendered, actual: describeActual(value) }),
      describe: (detail) =>
        `Value must be of type ${rendered}, but got ${String(detail.actual)}`,
      buildMessageContext: () => ({}),
    }),
  ]);
}

/** `type: "integer"` is the only `type` member that adds a chain method. */
export function declareIntegerRules(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  if (!readDeclaredTypes(schema).includes("integer")) return NO_RULES;
  const plugin = context.bag.numberInteger;
  return Object.freeze([
    plugin.build(context.ruleContextFor(plugin.name, "type")),
  ]);
}

export function declareConstRules(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  if (!Object.prototype.hasOwnProperty.call(schema, "const")) return NO_RULES;
  const chain: ConverterChain<"any"> = createFieldSlots<
    unknown,
    JsonSchemaBag,
    unknown
  >(context.bag, context.build).any;
  const applied = applyKeywordBinding(chain, constBinding, schema.const);
  return readChainRules(applied) ?? NO_RULES;
}

/**
 * `enum` drives the `.oneOf()` METHOD, which is a different thing from the
 * `oneOf` KEYWORD. The list is typed against the FIELD (readonly SelfValue[]),
 * so it carries a marker and can never be a keyword binding; the converter
 * resolves the list and calls the plugin itself, exactly as the table says.
 */
export function declareEnumRules(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const allowed = schema.enum;
  if (allowed === undefined || allowed.length === 0) return NO_RULES;
  const plugin = context.bag.oneOf;
  return Object.freeze([
    plugin.build(context.ruleContextFor(plugin.name, "enum"), allowed),
  ]);
}
