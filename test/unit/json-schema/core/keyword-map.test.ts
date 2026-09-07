// ===========================================================================
// test/unit/json-schema/core/keyword-map.test.ts
//
// The table's contract is that it is TOTAL and that every entry is a written
// decision. Both are checked here against the vocabulary itself, not against a
// number typed in by hand: the counts are computed from the table and then
// cross-checked against the union of the five category tables, so a keyword
// added to one place and forgotten in another fails the suite.
// ===========================================================================
import {
  NON_DRAFT07_KEYWORDS,
  assertKeywordSupported,
  countKeywordHandlings,
  draft07KeywordMap,
  findKeywordHandling,
  isDraft07Keyword,
  listBoundPluginNames,
  listDraft07Keywords,
} from "../../../../src/json-schema/keyword-map";
import { coreKeywordMap } from "../../../../src/json-schema/keyword-map-core";
import { numberKeywordMap } from "../../../../src/json-schema/keyword-map-number";
import { stringKeywordMap } from "../../../../src/json-schema/keyword-map-string";
import { arrayKeywordMap } from "../../../../src/json-schema/keyword-map-array";
import { objectKeywordMap } from "../../../../src/json-schema/keyword-map-object";
import { UnsupportedKeywordError } from "../../../../src/json-schema/unsupported-keyword-error";
import { jsonSchemaBagBuilder } from "./build-with-json-schema-bag";

/** The draft-07 meta-schema's own `properties` keys, transcribed. */
const METASCHEMA_KEYWORDS: readonly string[] = [
  "$id",
  "$schema",
  "$ref",
  "$comment",
  "title",
  "description",
  "default",
  "readOnly",
  "writeOnly",
  "examples",
  "multipleOf",
  "maximum",
  "exclusiveMaximum",
  "minimum",
  "exclusiveMinimum",
  "maxLength",
  "minLength",
  "pattern",
  "additionalItems",
  "items",
  "maxItems",
  "minItems",
  "uniqueItems",
  "contains",
  "maxProperties",
  "minProperties",
  "required",
  "additionalProperties",
  "definitions",
  "properties",
  "patternProperties",
  "dependencies",
  "propertyNames",
  "const",
  "enum",
  "type",
  "format",
  "contentMediaType",
  "contentEncoding",
  "if",
  "then",
  "else",
  "allOf",
  "anyOf",
  "oneOf",
  "not",
];

describe("the Draft-07 vocabulary is complete", () => {
  it("covers the meta-schema exactly, with nothing extra", () => {
    expect([...listDraft07Keywords()].sort()).toEqual(
      [...METASCHEMA_KEYWORDS].sort()
    );
  });

  it("is the union of the five category tables and nothing else", () => {
    const categories = [
      coreKeywordMap,
      numberKeywordMap,
      stringKeywordMap,
      arrayKeywordMap,
      objectKeywordMap,
    ];
    const fromCategories = categories.flatMap((table) => Object.keys(table));
    expect(fromCategories).toHaveLength(new Set(fromCategories).size);
    expect([...fromCategories].sort()).toEqual(
      [...listDraft07Keywords()].sort()
    );
  });

  it("gives every keyword one of exactly three handlings", () => {
    for (const keyword of listDraft07Keywords()) {
      expect(["bind", "structural", "unsupported"]).toContain(
        draft07KeywordMap[keyword].handling
      );
    }
  });

  // The measured split. It is asserted so that a keyword silently changing
  // category is a failure, and it is COMPUTED so the numbers cannot drift from
  // the table they describe.
  it("splits 18 bind / 19 structural / 9 unsupported over 46 keywords", () => {
    expect(countKeywordHandlings(draft07KeywordMap)).toEqual({
      bind: 18,
      structural: 19,
      unsupported: 9,
      total: 46,
    });
  });

  it("splits the same way per category", () => {
    expect(countKeywordHandlings(coreKeywordMap)).toEqual({
      bind: 1,
      structural: 11,
      unsupported: 9,
      total: 21,
    });
    expect(countKeywordHandlings(numberKeywordMap)).toEqual({
      bind: 5,
      structural: 0,
      unsupported: 0,
      total: 5,
    });
    expect(countKeywordHandlings(stringKeywordMap)).toEqual({
      bind: 5,
      structural: 1,
      unsupported: 0,
      total: 6,
    });
    expect(countKeywordHandlings(arrayKeywordMap)).toEqual({
      bind: 3,
      structural: 3,
      unsupported: 0,
      total: 6,
    });
    expect(countKeywordHandlings(objectKeywordMap)).toEqual({
      bind: 4,
      structural: 4,
      unsupported: 0,
      total: 8,
    });
  });
});

describe("no decision is left blank", () => {
  it("gives every structural keyword a non-trivial note", () => {
    for (const keyword of listDraft07Keywords()) {
      const handling = draft07KeywordMap[keyword];
      if (handling.handling !== "structural") continue;
      expect([keyword, handling.note.length > 20]).toEqual([keyword, true]);
    }
  });

  it("gives every unsupported keyword a non-trivial reason", () => {
    for (const keyword of listDraft07Keywords()) {
      const handling = draft07KeywordMap[keyword];
      if (handling.handling !== "unsupported") continue;
      expect([keyword, handling.reason.length > 20]).toEqual([keyword, true]);
    }
  });
});

function isMethodBag(
  value: unknown
): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

/** The nine slot chains of a builder carrying the whole JsonSchemaBag. */
function collectSlotChains(): Readonly<Record<string, unknown>> {
  const chains: Record<string, unknown> = {};
  jsonSchemaBagBuilder
    .for<{ readonly probe: string }>()
    .v("probe", (b) => {
      chains["string"] = b.string;
      chains["number"] = b.number;
      chains["boolean"] = b.boolean;
      chains["date"] = b.date;
      chains["array"] = b.array;
      chains["tuple"] = b.tuple;
      chains["object"] = b.object;
      chains["union"] = b.union;
      chains["any"] = b.any;
      return b.string;
    })
    .build();
  return chains;
}

describe("every binding names a plugin that really is on the chain", () => {
  // The run-time twin of the compile-time gate: the method a binding names
  // must exist on a chain built from the whole bag. 1.x's
  // `chain.minItems && chain.minItems(n)` is exactly what this catches.
  const chainsBySlot = collectSlotChains();

  it("resolves each bound method on its own slot chain", () => {
    for (const keyword of listDraft07Keywords()) {
      const handling = draft07KeywordMap[keyword];
      if (handling.handling !== "bind") continue;
      const chain = chainsBySlot[handling.slot];
      expect([keyword, isMethodBag(chain)]).toEqual([keyword, true]);
      const method = isMethodBag(chain) ? chain[handling.method] : undefined;
      expect([keyword, handling.method, typeof method]).toEqual([
        keyword,
        handling.method,
        "function",
      ]);
    }
  });

  it("lists 35 distinct bound plugins across the keyword and format tables", () => {
    const names = listBoundPluginNames();
    expect(names).toHaveLength(new Set(names).size);
    expect(names).toHaveLength(35);
    expect(names).toContain("arrayMinLength");
    expect(names).toContain("stringIpv4");
    // The four the format table declared out of scope until step 27.
    expect(names).toContain("stringIdnEmail");
    expect(names).toContain("stringIdnHostname");
    expect(names).toContain("stringUriReference");
    expect(names).toContain("stringRegex");
    expect(names).not.toContain("arrayEach");
  });
});

describe("an unsupported keyword is refused, never dropped", () => {
  it("throws UnsupportedKeywordError naming the keyword and the reason", () => {
    expect(() => assertKeywordSupported("multipleOf")).not.toThrow();
    let thrown: unknown;
    try {
      assertKeywordSupported("$comment");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(UnsupportedKeywordError);
    expect(thrown).toBeInstanceOf(Error);
    const error = thrown as UnsupportedKeywordError;
    expect(error.keyword).toBe("$comment");
    const declared = draft07KeywordMap.$comment;
    expect(declared.handling).toBe("unsupported");
    if (declared.handling === "unsupported") {
      expect(error.reason).toBe(declared.reason);
    }
    expect(error.message).toContain("$comment");
    expect(error.message).toContain(error.reason);
  });

  it("refuses a keyword from a newer draft with the draft named", () => {
    expect(() => assertKeywordSupported("unevaluatedProperties")).toThrow(
      UnsupportedKeywordError
    );
    expect(() => assertKeywordSupported("unevaluatedProperties")).toThrow(
      /2019-09/
    );
  });

  it("refuses an invented keyword", () => {
    expect(() => assertKeywordSupported("minItemz")).toThrow(
      /not a Draft-07 keyword/
    );
  });

  it("keeps the newer-draft names out of the Draft-07 vocabulary", () => {
    for (const keyword of Object.keys(NON_DRAFT07_KEYWORDS)) {
      expect([keyword, isDraft07Keyword(keyword)]).toEqual([keyword, false]);
      expect([keyword, findKeywordHandling(keyword)]).toEqual([
        keyword,
        undefined,
      ]);
    }
    expect(Object.keys(NON_DRAFT07_KEYWORDS)).toHaveLength(11);
  });
});

describe("the keyword lookup is exact", () => {
  it("does not answer for a prototype member", () => {
    expect(findKeywordHandling("toString")).toBeUndefined();
    expect(findKeywordHandling("constructor")).toBeUndefined();
    expect(isDraft07Keyword("hasOwnProperty")).toBe(false);
  });

  it("answers for every keyword it lists", () => {
    for (const keyword of listDraft07Keywords()) {
      expect(findKeywordHandling(keyword)).toBe(draft07KeywordMap[keyword]);
    }
  });
});
