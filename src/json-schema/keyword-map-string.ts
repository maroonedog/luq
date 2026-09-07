// ===========================================================================
// L8  src/json-schema/keyword-map-string.ts — the six string keywords.
//
// `format` is the only structural one, and it is structural for a reason worth
// stating: its VALUE selects the binding. One keyword, twenty possible chain
// methods. The selection lives in format-map.ts, which is the single format
// table in this repository — 1.x shipped three of them and they disagreed
// (docs/legacy-spec/json-schema-mapping.md records the disagreements).
// ===========================================================================
import { bindKeyword, structural } from "./bind-keyword";
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
 * Draft-07 spells `pattern` as an ECMA-262 SOURCE string; the plugin accepts a
 * RegExp and only a RegExp, because 1.x's `new RegExp(source)` at the call site
 * dropped flags silently and gave the caller no compile-time check. Compiling
 * the schema's string therefore happens HERE, once, and nowhere else.
 */
export const patternBinding = bindKeyword(
  "string",
  "pattern",
  stringPatternPlugin,
  (v: string) => [new RegExp(v)] as const
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
