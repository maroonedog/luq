// ===========================================================================
// L8  src/json-schema/declare-scalar-keywords.ts — the keywords that BIND.
//
// Every call below goes through applyKeywordBinding, so the chain method a
// keyword drives is checked by the compiler against the plugin that declares
// it. That is the whole reason step 24 exists: 1.x wrote
// `chain.minItems && chain.minItems(n)` and the constraint evaporated.
//
// The slot chains are built and driven here, but a slot is NOT a filter: every
// bound plugin in the bag passes a wrong-typed value on purpose (see
// string-min.ts: "a wrong-typed value PASSES"), which is exactly Draft-07 §6 —
// `minLength` says nothing about a number. So the converter applies the string
// keywords AND the number keywords whenever they appear, without first deciding
// what the value will be, and `type` (declare-value-keywords.ts) is the only rule
// that judges the type. That is also what makes `type: ["string","number"]`
// with a `minLength` correct rather than approximated.
// ===========================================================================
import { readChainRules } from "../chain/create-chain-node";
import { createFieldSlots } from "../chain/create-field-slots";
import type { Rule } from "../plugin-kit/compiled-rule";
import { applyKeywordBinding } from "./apply-keyword-binding";
import type { ConverterChain } from "./apply-keyword-binding";
import type { ContentEncodingName } from "../plugins/string-content-encoding";
import type { Draft07SchemaObject } from "./draft07.types";
import { findFormatHandling } from "./format-map";
import type { JsonSchemaBag } from "./json-schema-bag.types";
import {
  exclusiveMaximumBinding,
  exclusiveMinimumBinding,
  maximumBinding,
  minimumBinding,
  multipleOfBinding,
} from "./keyword-map-number";
import {
  contentEncodingBinding,
  contentMediaTypeBinding,
  maxLengthBinding,
  minLengthBinding,
  patternBinding,
} from "./keyword-map-string";
import type { StructuralContext } from "./structural-expansion.types";
import { UnsupportedKeywordError } from "./unsupported-keyword-error";

const NO_RULES: readonly Rule[] = Object.freeze([]);

/** Total over the plugin's own union, so a new encoding breaks THIS line. */
const CONTENT_ENCODING_NAMES: Readonly<Record<ContentEncodingName, true>> = {
  base64: true,
  base32: true,
  binary: true,
  "7bit": true,
  "8bit": true,
  "quoted-printable": true,
};

function isContentEncodingName(name: string): name is ContentEncodingName {
  return Object.prototype.hasOwnProperty.call(CONTENT_ENCODING_NAMES, name);
}

function readRules(chain: unknown): readonly Rule[] {
  return readChainRules(chain) ?? NO_RULES;
}

function emptyStringChain(bag: JsonSchemaBag, context: StructuralContext) {
  return createFieldSlots<unknown, JsonSchemaBag, unknown>(bag, context.build)
    .string;
}

export function declareStringRules(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  let chain: ConverterChain<"string"> = emptyStringChain(context.bag, context);
  if (schema.minLength !== undefined) {
    chain = applyKeywordBinding(chain, minLengthBinding, schema.minLength);
  }
  if (schema.maxLength !== undefined) {
    chain = applyKeywordBinding(chain, maxLengthBinding, schema.maxLength);
  }
  if (schema.pattern !== undefined) {
    chain = applyKeywordBinding(chain, patternBinding, schema.pattern);
  }
  if (schema.contentMediaType !== undefined) {
    chain = applyKeywordBinding(
      chain,
      contentMediaTypeBinding,
      schema.contentMediaType
    );
  }
  const encoding = schema.contentEncoding;
  if (encoding !== undefined) {
    if (!isContentEncodingName(encoding)) {
      throw new UnsupportedKeywordError(
        "contentEncoding",
        `"${encoding}" is not one of the encodings stringContentEncoding ` +
          "recognises; 1.x accepted every unknown name and validated nothing"
      );
    }
    chain = applyKeywordBinding(chain, contentEncodingBinding, encoding);
  }
  return readRules(chain);
}

/**
 * Draft-07 §7.2: an unknown format is an ANNOTATION and passes. A format the
 * table declares out of scope is a different answer and throws — 1.x confused
 * the two and its validator and its error generator disagreed about which.
 */
export function declareFormatRules(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const format = schema.format;
  if (format === undefined) return NO_RULES;
  const handling = findFormatHandling(format);
  if (handling === undefined) return NO_RULES;
  if (handling.handling === "unsupported") {
    throw new UnsupportedKeywordError(`format: ${format}`, handling.reason);
  }
  const chain = emptyStringChain(context.bag, context);
  return readRules(applyKeywordBinding(chain, handling, "format"));
}

export function declareNumberRules(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  let chain: ConverterChain<"number"> = createFieldSlots<
    unknown,
    JsonSchemaBag,
    unknown
  >(context.bag, context.build).number;
  if (schema.minimum !== undefined) {
    chain = applyKeywordBinding(chain, minimumBinding, schema.minimum);
  }
  if (schema.maximum !== undefined) {
    chain = applyKeywordBinding(chain, maximumBinding, schema.maximum);
  }
  if (schema.exclusiveMinimum !== undefined) {
    chain = applyKeywordBinding(
      chain,
      exclusiveMinimumBinding,
      schema.exclusiveMinimum
    );
  }
  if (schema.exclusiveMaximum !== undefined) {
    chain = applyKeywordBinding(
      chain,
      exclusiveMaximumBinding,
      schema.exclusiveMaximum
    );
  }
  if (schema.multipleOf !== undefined) {
    chain = applyKeywordBinding(chain, multipleOfBinding, schema.multipleOf);
  }
  return readRules(chain);
}
