// ===========================================================================
// L8  src/json-schema/keyword-map-string.ts — the six string keywords.
//
// `format` is the only structural one, and it is structural for a reason worth
// stating: its VALUE selects the binding. One keyword, twenty possible chain
// methods. The selection lives in format-map.ts, which is the single format
// table in this repository — 1.x shipped three of them and they disagreed
// (docs/legacy-spec/json-schema-mapping.md records the disagreements).
// ===========================================================================
import { isString } from "../types";
import { bindKeyword, structural } from "./bind-keyword";
import { MalformedSchemaError } from "./malformed-schema-error";
import type { KeywordTable } from "./keyword-binding.types";
import type { Draft07StringKeyword } from "./draft07-keyword-value.types";
import { stringMinPlugin } from "../plugins/string-min";
import { stringMaxPlugin } from "../plugins/string-max";
import { stringPatternPlugin } from "../plugins/string-pattern";
import {
  stringContentEncodingPlugin,
  type ContentEncodingName,
} from "../plugins/string-content-encoding";
import { stringContentMediaTypePlugin } from "../plugins/string-content-media-type";

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
 * Compiles the document's source, refusing anything the meta-schema forbids.
 *
 * The parameter is `unknown` although the keyword's value type is `string`,
 * and that is the whole point: compiling is a TOTAL operation on JSON values —
 * every one of them has a string form — so a number becomes a literal digit
 * pattern and an object becomes one that matches almost every string. Both
 * then reach stringPattern as a perfectly valid RegExp, leaving its
 * non-RegExp guard nothing to fire on. The refusal has to be here, before the
 * value is turned into something well formed.
 *
 * A string that is not a valid ECMA-262 pattern is the same failure wearing a
 * different coat: the compile step throws a SyntaxError naming neither the
 * keyword nor the document, so it is caught and re-raised as the typed refusal
 * every other malformed value gets.
 */
function compilePattern(source: unknown): RegExp {
  if (!isString(source)) {
    throw new MalformedSchemaError(
      "pattern",
      "the value must be a string",
      source
    );
  }
  try {
    return new RegExp(source);
  } catch {
    throw new MalformedSchemaError(
      "pattern",
      "the value must be a valid ECMA-262 regular expression",
      source
    );
  }
}

/**
 * Draft-07 spells `pattern` as an ECMA-262 SOURCE string; the plugin accepts a
 * RegExp and only a RegExp, because 1.x's `new RegExp(source)` at the call site
 * dropped flags silently and gave the caller no compile-time check. Compiling
 * the schema's string therefore happens HERE, once, and nowhere else.
 */
export const patternBinding = bindKeyword(
  "string",
  "pattern",
  stringPatternPlugin,
  (v: string) => [compilePattern(v)] as const
);

/**
 * The value type is `ContentEncodingName`, not `string`: an encoding the
 * plugin does not know must be refused by the converter rather than accepted
 * silently, and the compiler is what forces that narrowing to happen.
 */
export const contentEncodingBinding = bindKeyword(
  "string",
  "contentEncoding",
  stringContentEncodingPlugin,
  (v: ContentEncodingName) => [v] as const
);

export const contentMediaTypeBinding = bindKeyword(
  "string",
  "contentMediaType",
  stringContentMediaTypePlugin,
  (v: string) => [v] as const
);

export const stringKeywordMap: KeywordTable<Draft07StringKeyword> = {
  maxLength: maxLengthBinding,
  minLength: minLengthBinding,
  pattern: patternBinding,
  format: structural(
    "the keyword's VALUE selects which of the sixteen format plugins runs; " +
      "see format-map.ts, the only format table in src. An unknown format " +
      "name is an annotation and passes, which is what Draft-07 §7.2 requires"
  ),
  contentEncoding: contentEncodingBinding,
  contentMediaType: contentMediaTypeBinding,
};
