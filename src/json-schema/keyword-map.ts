// ===========================================================================
// L8  src/json-schema/keyword-map.ts — the five category tables, joined.
//
// The join is the vocabulary: `draft07KeywordMap` is total over
// `Draft07Keyword`, so there is no keyword without a decision and no decision
// without a keyword. Everything a caller needs to ask about a keyword is asked
// here; nothing re-derives the mapping anywhere else in src.
// ===========================================================================
import type { AnyKeywordHandling, KeywordTable } from "./keyword-binding.types";
import type { Draft07Keyword } from "./draft07-keyword-value.types";
import { coreKeywordMap } from "./keyword-map-core";
import { numberKeywordMap } from "./keyword-map-number";
import { stringKeywordMap } from "./keyword-map-string";
import { arrayKeywordMap } from "./keyword-map-array";
import { objectKeywordMap } from "./keyword-map-object";
import { draft07FormatMap } from "./format-map";
import { UnsupportedKeywordError } from "./unsupported-keyword-error";

export const draft07KeywordMap: KeywordTable<Draft07Keyword> = {
  ...coreKeywordMap,
  ...numberKeywordMap,
  ...stringKeywordMap,
  ...arrayKeywordMap,
  ...objectKeywordMap,
};

/**
 * Keywords Luq recognises the NAME of but which are not Draft-07. They are
 * listed so that "we did not implement it" and "it is not in this dialect"
 * stay different answers. `$defs` is the one exception that still does
 * something: resolve-ref follows it, because a 2019-09 document's pointers
 * would otherwise dangle.
 */
export const NON_DRAFT07_KEYWORDS: Readonly<Record<string, string>> = {
  $defs: "2019-09 spelling of `definitions`; resolve-ref follows it anyway",
  $anchor: "2019-09 anchors; resolve-ref resolves JSON Pointers only",
  $dynamicRef: "2020-12 dynamic references",
  $recursiveRef: "2019-09 recursive references",
  dependentRequired: "2019-09 split of `dependencies`; use `dependencies`",
  dependentSchemas: "2019-09 split of `dependencies`; use `dependencies`",
  unevaluatedItems: "2019-09; no annotation-collection model in Luq",
  unevaluatedProperties: "2019-09; no annotation-collection model in Luq",
  contentSchema: "2019-09 companion to contentMediaType",
  deprecated: "2019-09 annotation",
  prefixItems: "2020-12 spelling of the tuple form of `items`",
};

export function isDraft07Keyword(keyword: string): keyword is Draft07Keyword {
  return Object.prototype.hasOwnProperty.call(draft07KeywordMap, keyword);
}

/** Every keyword the table decides on. No assertion; the guard narrows. */
export function listDraft07Keywords(): readonly Draft07Keyword[] {
  return Object.keys(draft07KeywordMap).filter(isDraft07Keyword);
}

/** `undefined` = not a Draft-07 keyword at all. See NON_DRAFT07_KEYWORDS. */
export function findKeywordHandling(
  keyword: string
): AnyKeywordHandling | undefined {
  return isDraft07Keyword(keyword) ? draft07KeywordMap[keyword] : undefined;
}

/** Throws for a keyword the table declares out of scope. Never silent. */
export function assertKeywordSupported(keyword: string): void {
  const handling = findKeywordHandling(keyword);
  if (handling === undefined) {
    const note = NON_DRAFT07_KEYWORDS[keyword];
    throw new UnsupportedKeywordError(
      keyword,
      note ?? "not a Draft-07 keyword"
    );
  }
  if (handling.handling === "unsupported") {
    throw new UnsupportedKeywordError(keyword, handling.reason);
  }
}

/**
 * Every plugin the two tables bind, de-duplicated and sorted. Step 26 GENERATES
 * the full-feature bundle's use() list from this, so the bundle cannot name a
 * plugin that is not bound, and cannot omit one that is.
 */
export function listBoundPluginNames(): readonly string[] {
  const names = new Set<string>();
  const handlings: readonly AnyKeywordHandling[] = [
    ...Object.values(draft07KeywordMap),
    ...Object.values(draft07FormatMap),
  ];
  for (const handling of handlings) {
    if (handling.handling === "bind") names.add(handling.pluginName);
  }
  return [...names].sort();
}

export interface KeywordHandlingCounts {
  readonly bind: number;
  readonly structural: number;
  readonly unsupported: number;
  readonly total: number;
}

/** Counted, never asserted: the published numbers come from this function. */
export function countKeywordHandlings(
  table: Readonly<Record<string, AnyKeywordHandling>>
): KeywordHandlingCounts {
  const entries = Object.values(table);
  const countOf = (kind: AnyKeywordHandling["handling"]): number =>
    entries.filter((handling) => handling.handling === kind).length;
  return {
    bind: countOf("bind"),
    structural: countOf("structural"),
    unsupported: countOf("unsupported"),
    total: entries.length,
  };
}
