// ===========================================================================
// test/unit/json-schema/convert/structural-expansion.test.ts
//
// THE TABLE AND THE VOCABULARY MUST NOT DRIFT.
//
// Step 24's review said it plainly: "structural is a string memo and is not
// type-checked, so forgetting the `not` recursion is as silent as the legacy
// bug". The compiler now stops a MISSING expansion (StructuralExpansionTable is
// total over StructuralKeyword). What the compiler cannot see is whether
// StructuralKeyword still names the same keywords `draft07KeywordMap` marks
// structural — one is a hand-written union, the other a runtime record — so
// that equality is asserted here, in BOTH directions, and every entry is then
// exercised against a real document.
// ===========================================================================
import {
  findKeywordHandling,
  listDraft07Keywords,
} from "../../../../src/json-schema/keyword-map";
import {
  STRUCTURAL_EXPANSIONS,
  isStructuralKeyword,
  readChildSchemas,
} from "../../../../src/json-schema/schema-to-declarations";
import {
  readChildExpansion,
  readRuleExpansion,
} from "../../../../src/json-schema/structural-expansion.types";
import { fromJsonSchema } from "../../../../src/json-schema/build-from-schema";
import { jsonSchemaBagFixture } from "./json-schema-bag-fixture";

const structuralFromMap = listDraft07Keywords()
  .filter((keyword) => findKeywordHandling(keyword)?.handling === "structural")
  .slice()
  .sort();

const structuralFromTable = Object.keys(STRUCTURAL_EXPANSIONS).slice().sort();

/**
 * One document per structural keyword, and one value the document REFUSES.
 * Every entry is a rejection, so an expansion that quietly produced no rule
 * would turn the case green-to-red here rather than staying silent.
 */
const REFUSED_BY: Readonly<
  Record<string, { schema: unknown; value: unknown }>
> = {
  $ref: {
    schema: {
      definitions: { small: { maxLength: 2 } },
      properties: { a: { $ref: "#/definitions/small" } },
    },
    value: { a: "abc" },
  },
  definitions: {
    schema: {
      definitions: { small: { maxLength: 2 } },
      properties: { a: { $ref: "#/definitions/small" } },
    },
    value: { a: "abc" },
  },
  type: {
    schema: { properties: { a: { type: "number" } } },
    value: { a: "x" },
  },
  enum: { schema: { properties: { a: { enum: [1, 2] } } }, value: { a: 3 } },
  allOf: {
    schema: { properties: { a: { allOf: [{ minLength: 3 }] } } },
    value: { a: "ab" },
  },
  anyOf: {
    schema: { properties: { a: { anyOf: [{ minLength: 3 }] } } },
    value: { a: "ab" },
  },
  oneOf: {
    schema: { properties: { a: { oneOf: [{ minLength: 3 }] } } },
    value: { a: "ab" },
  },
  not: {
    schema: { properties: { a: { not: { minLength: 1 } } } },
    value: { a: "ab" },
  },
  if: {
    schema: {
      properties: { a: { if: { type: "string" }, then: { minLength: 3 } } },
    },
    value: { a: "ab" },
  },
  then: {
    schema: {
      properties: { a: { if: { type: "string" }, then: { minLength: 3 } } },
    },
    value: { a: "ab" },
  },
  else: {
    schema: {
      properties: {
        a: { if: { type: "number" }, else: { minLength: 3 } },
      },
    },
    value: { a: "ab" },
  },
  format: {
    schema: { properties: { a: { format: "date" } } },
    value: { a: "2024-13-01" },
  },
  items: {
    schema: { properties: { a: { items: { type: "number" } } } },
    value: { a: ["x"] },
  },
  additionalItems: {
    schema: {
      properties: {
        a: { items: [{ type: "string" }], additionalItems: false },
      },
    },
    value: { a: ["x", 1] },
  },
  contains: {
    schema: { properties: { a: { contains: { type: "number" } } } },
    value: { a: ["x"] },
  },
  properties: {
    schema: { properties: { a: { properties: { b: { type: "number" } } } } },
    value: { a: { b: "x" } },
  },
  patternProperties: {
    schema: {
      properties: { a: { patternProperties: { "^x": { type: "number" } } } },
    },
    value: { a: { xy: "no" } },
  },
  dependencies: {
    schema: { properties: { a: { dependencies: { p: ["q"] } } } },
    value: { a: { p: 1 } },
  },
  propertyNames: {
    schema: { properties: { a: { propertyNames: { maxLength: 1 } } } },
    value: { a: { long: 1 } },
  },
};

describe("the structural vocabulary", () => {
  it("names exactly the keywords the keyword map marks structural", () => {
    expect(structuralFromTable).toEqual(structuralFromMap);
  });

  it("counts nineteen of them", () => {
    expect(structuralFromMap).toHaveLength(19);
  });

  it("recognises every one of them and nothing else", () => {
    for (const keyword of structuralFromMap) {
      expect(isStructuralKeyword(keyword)).toBe(true);
    }
    expect(isStructuralKeyword("minLength")).toBe(false);
    expect(isStructuralKeyword("nonsense")).toBe(false);
  });

  it("gives every entry either a function or a NAMED consumer", () => {
    for (const [keyword, expansion] of Object.entries(STRUCTURAL_EXPANSIONS)) {
      const hasFunction =
        readRuleExpansion(expansion) !== undefined ||
        readChildExpansion(expansion) !== undefined;
      if (expansion.expandsTo === "consumed") {
        expect(hasFunction).toBe(false);
        expect(expansion.consumedBy.length).toBeGreaterThan(0);
        expect(expansion.reason.length).toBeGreaterThan(0);
        continue;
      }
      expect(hasFunction).toBe(true);
      expect(keyword.length).toBeGreaterThan(0);
    }
  });
});

describe("every structural keyword changes a verdict", () => {
  it.each(structuralFromMap)(
    "%s refuses a document it must refuse",
    (keyword) => {
      const declared = REFUSED_BY[keyword];
      expect(declared).toBeDefined();
      if (declared === undefined) return;
      const validator = fromJsonSchema(jsonSchemaBagFixture, declared.schema);
      expect(validator.validate(declared.value).valid).toBe(false);
    }
  );
});

describe("readChildSchemas", () => {
  it("is driven by the table, not by the keys of the document", () => {
    expect(readChildSchemas({ properties: { a: {} } })).toEqual([
      { step: "a", schema: {}, isRequired: false },
    ]);
    expect(readChildSchemas({ items: { type: "string" } })).toEqual([
      { step: "[*]", schema: { type: "string" }, isRequired: false },
    ]);
    // The tuple form declares no `[*]`: element 0 and element 1 differ.
    expect(readChildSchemas({ items: [{}, {}] })).toEqual([]);
    expect(readChildSchemas({})).toEqual([]);
  });
});
