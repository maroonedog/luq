// ===========================================================================
// L8  src/json-schema/draft07-bindings.ts — every Draft-07 keyword that lands
// on a chain method, bound ONCE, with the method name checked by the compiler.
// Source of the mapping: docs/legacy-spec/json-schema-mapping.md.
//
// Read the second argument of each call as the answer to "which chain method
// does this keyword actually call?". The legacy converter guessed (`minItems`,
// `maxItems`, `tupleBuilder`) and the guesses were silently dropped at runtime.
//
// COMPOSITION NOTE (one keyword the composed tree could not keep bound):
//   * `enum` no longer binds. The single `oneOf` plugin types its allowed list
//     against the field through SelfValue, so it carries a marker and
//     MarkerFreeArgs rejects it. `enum` is `structural` instead.
//   `additionalProperties` DOES bind: the boolean form was split into its own
//   marker-free plugin, and the schema form lives on .additionalPropertiesSchema().
// The keyword is not dropped: the converter still drives the same chain method.
// What is lost is the compile-time gate on `enum`, written down here rather
// than left to be discovered.
// ===========================================================================
import { bindKeyword } from "./bind-keyword";
import { requiredPlugin } from "../plugins/required";
import { numberMinPlugin } from "../plugins/number-min";
import { stringMinPlugin } from "../plugins/string-min";
import { arrayMaxLengthPlugin } from "../plugins/array-max-length";
import { arrayMinLengthPlugin } from "../plugins/array-min-length";
import { arrayUniquePlugin } from "../plugins/array-unique";
import { numberMaxPlugin } from "../plugins/number-max";
import { stringMaxPlugin } from "../plugins/string-max";
import { stringPatternPlugin } from "../plugins/string-pattern";
import { literalPlugin } from "../plugins/literal";
import { objectAdditionalPropertiesPlugin } from "../plugins/object-additional-properties";

// -- numbers ---------------------------------------------------------------
export const minimumBinding = bindKeyword(
  "number",
  "min",
  numberMinPlugin,
  (v: number) => [v] as const
);
export const maximumBinding = bindKeyword(
  "number",
  "max",
  numberMaxPlugin,
  (v: number) => [v] as const
);

// -- strings ---------------------------------------------------------------
export const minLengthBinding = bindKeyword(
  "string",
  "min",
  stringMinPlugin,
  (v: number) => [v] as const
);
export const maxLengthBinding = bindKeyword(
  "string",
  "max",
  stringMaxPlugin,
  (v: number) => [v] as const
);
/**
 * Draft-07 spells `pattern` as an ECMA-262 source string; the plugin accepts a
 * RegExp and only a RegExp, because 1.x's `new RegExp(source)` dropped flags
 * silently and gave the call site no compile-time check. Compiling the schema's
 * string is therefore done HERE, once, and nowhere else.
 */
export const patternBinding = bindKeyword(
  "string",
  "pattern",
  stringPatternPlugin,
  (v: string) => [new RegExp(v)] as const
);

// -- arrays ----------------------------------------------------------------
// THE C2 REGRESSION, fixed in one line: the keyword is minItems, the method is
// minLength. Writing "minItems" here does not compile (see the type test).
export const minItemsBinding = bindKeyword(
  "array",
  "minLength",
  arrayMinLengthPlugin,
  (v: number) => [v] as const
);
export const maxItemsBinding = bindKeyword(
  "array",
  "maxLength",
  arrayMaxLengthPlugin,
  (v: number) => [v] as const
);
/** Draft-07 `uniqueItems: false` is a no-op, so only `true` reaches a binding. */
export const uniqueItemsBinding = bindKeyword(
  "array",
  "unique",
  arrayUniquePlugin,
  (_v: true) => [] as const
);

// -- presence --------------------------------------------------------------
/** The parent's `required: [...]` array, resolved to one flag per field. */
export const requiredBinding = bindKeyword(
  "string",
  "required",
  requiredPlugin,
  (_v: true) => [] as const
);

// -- values ----------------------------------------------------------------
export const constBinding = bindKeyword(
  "any",
  "literal",
  literalPlugin,
  (v: unknown) => [v] as const
);

// -- objects ---------------------------------------------------------------
/**
 * Only Draft-07's BOOLEAN form binds. The schema form takes a
 * PropertyValueChain, which MarkerFreeArgs rejects by construction — a JSON
 * document cannot supply a sub-chain. The converter expands that form itself.
 */
export const additionalPropertiesBinding = bindKeyword(
  "object",
  "additionalProperties",
  objectAdditionalPropertiesPlugin,
  (v: boolean) => [v] as const
);
