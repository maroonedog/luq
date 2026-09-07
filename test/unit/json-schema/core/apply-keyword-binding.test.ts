// ===========================================================================
// test/unit/json-schema/core/apply-keyword-binding.test.ts
//
// The type test proves a wrong binding cannot be WRITTEN. This file proves the
// right one RUNS: bindings are driven through a real Builder chain and the
// validator is asked about a real document. 1.x's `minItems` regression
// type-checked too - it was only visible at run time, as a validator that said
// `valid: true` about a value the schema forbids.
// ===========================================================================
import {
  applyKeywordBinding,
  type ConverterChain,
} from "../../../../src/json-schema/apply-keyword-binding";
import {
  maxItemsBinding,
  minItemsBinding,
  uniqueItemsBinding,
} from "../../../../src/json-schema/keyword-map-array";
import {
  contentEncodingBinding,
  maxLengthBinding,
  minLengthBinding,
  patternBinding,
} from "../../../../src/json-schema/keyword-map-string";
import {
  exclusiveMaximumBinding,
  exclusiveMinimumBinding,
  maximumBinding,
  minimumBinding,
  multipleOfBinding,
} from "../../../../src/json-schema/keyword-map-number";
import { constBinding } from "../../../../src/json-schema/keyword-map-core";
import {
  maxPropertiesBinding,
  minPropertiesBinding,
  requiredBinding,
} from "../../../../src/json-schema/keyword-map-object";
import { findFormatHandling } from "../../../../src/json-schema/format-map";
import { jsonSchemaBagBuilder } from "./build-with-json-schema-bag";

interface Sample {
  readonly tags: readonly string[];
  readonly name: string;
  readonly age: number;
  readonly meta: Readonly<Record<string, unknown>>;
}

const validateTags = (
  drive: (chain: ConverterChain<"array">) => ConverterChain<"array">,
  tags: readonly string[]
): boolean =>
  jsonSchemaBagBuilder
    .for<Sample>()
    .v("tags", (b) => drive(b.array))
    .build()
    .validate({ tags, name: "n", age: 1, meta: {} }).valid;

const validateName = (
  drive: (chain: ConverterChain<"string">) => ConverterChain<"string">,
  name: string
): boolean =>
  jsonSchemaBagBuilder
    .for<Sample>()
    .v("name", (b) => drive(b.string))
    .build()
    .validate({ tags: [], name, age: 1, meta: {} }).valid;

const validateAge = (
  drive: (chain: ConverterChain<"number">) => ConverterChain<"number">,
  age: number
): boolean =>
  jsonSchemaBagBuilder
    .for<Sample>()
    .v("age", (b) => drive(b.number))
    .build()
    .validate({ tags: [], name: "n", age, meta: {} }).valid;

const validateMeta = (
  drive: (chain: ConverterChain<"object">) => ConverterChain<"object">,
  meta: Readonly<Record<string, unknown>>
): boolean =>
  jsonSchemaBagBuilder
    .for<Sample>()
    .v("meta", (b) => drive(b.object))
    .build()
    .validate({ tags: [], name: "n", age: 1, meta }).valid;

describe("array keyword bindings run on the real chain", () => {
  // THE C2 REGRESSION. `minItems` is not a chain method; `minLength` is. 1.x
  // wrote the keyword where the method belongs and the constraint vanished at
  // run time with no error anywhere. This is the run-time half of that gate.
  it("minItems rejects a short array", () => {
    const drive = (c: ConverterChain<"array">) =>
      applyKeywordBinding(c, minItemsBinding, 2);
    expect(validateTags(drive, ["a", "b"])).toBe(true);
    expect(validateTags(drive, ["a"])).toBe(false);
  });

  it("maxItems rejects a long array", () => {
    const drive = (c: ConverterChain<"array">) =>
      applyKeywordBinding(c, maxItemsBinding, 2);
    expect(validateTags(drive, ["a", "b"])).toBe(true);
    expect(validateTags(drive, ["a", "b", "c"])).toBe(false);
  });

  it("uniqueItems rejects a duplicate", () => {
    const drive = (c: ConverterChain<"array">) =>
      applyKeywordBinding(c, uniqueItemsBinding, true);
    expect(validateTags(drive, ["a", "b"])).toBe(true);
    expect(validateTags(drive, ["a", "a"])).toBe(false);
  });

  it("chains two bindings onto one field", () => {
    const drive = (c: ConverterChain<"array">) =>
      applyKeywordBinding(
        applyKeywordBinding(c, minItemsBinding, 2),
        maxItemsBinding,
        3
      );
    expect(validateTags(drive, ["a", "b", "c"])).toBe(true);
    expect(validateTags(drive, ["a"])).toBe(false);
    expect(validateTags(drive, ["a", "b", "c", "d"])).toBe(false);
  });
});

describe("string keyword bindings run on the real chain", () => {
  it("minLength and maxLength reach .min() and .max()", () => {
    expect(
      validateName((c) => applyKeywordBinding(c, minLengthBinding, 3), "ab")
    ).toBe(false);
    expect(
      validateName((c) => applyKeywordBinding(c, maxLengthBinding, 3), "abcd")
    ).toBe(false);
    expect(
      validateName((c) => applyKeywordBinding(c, maxLengthBinding, 3), "abc")
    ).toBe(true);
  });

  // Draft-07 spells `pattern` as a SOURCE string. The compile from string to
  // RegExp happens once, inside the binding, and nowhere else in src.
  it("pattern compiles the schema's source string exactly once", () => {
    const drive = (c: ConverterChain<"string">) =>
      applyKeywordBinding(c, patternBinding, "^a.c$");
    expect(validateName(drive, "abc")).toBe(true);
    expect(validateName(drive, "xbc")).toBe(false);
  });

  it("pattern is unanchored, as Draft-07 requires", () => {
    const drive = (c: ConverterChain<"string">) =>
      applyKeywordBinding(c, patternBinding, "bc");
    expect(validateName(drive, "abcd")).toBe(true);
  });

  it("contentEncoding rejects a value the encoding forbids", () => {
    const drive = (c: ConverterChain<"string">) =>
      applyKeywordBinding(c, contentEncodingBinding, "base64");
    expect(validateName(drive, "aGVsbG8=")).toBe(true);
    expect(validateName(drive, "not base64!!")).toBe(false);
  });
});

describe("number keyword bindings run on the real chain", () => {
  it("minimum is inclusive and exclusiveMinimum is not", () => {
    expect(
      validateAge((c) => applyKeywordBinding(c, minimumBinding, 5), 5)
    ).toBe(true);
    expect(
      validateAge((c) => applyKeywordBinding(c, exclusiveMinimumBinding, 5), 5)
    ).toBe(false);
    expect(
      validateAge((c) => applyKeywordBinding(c, exclusiveMinimumBinding, 5), 6)
    ).toBe(true);
  });

  it("maximum is inclusive and exclusiveMaximum is not", () => {
    expect(
      validateAge((c) => applyKeywordBinding(c, maximumBinding, 5), 5)
    ).toBe(true);
    expect(
      validateAge((c) => applyKeywordBinding(c, exclusiveMaximumBinding, 5), 5)
    ).toBe(false);
  });

  it("multipleOf uses scaled integers, so 0.3 is a multiple of 0.1", () => {
    const drive = (c: ConverterChain<"number">) =>
      applyKeywordBinding(c, multipleOfBinding, 0.1);
    expect(validateAge(drive, 0.3)).toBe(true);
    expect(validateAge(drive, 0.35)).toBe(false);
  });
});

describe("object and cross-slot bindings run on the real chain", () => {
  it("minProperties and maxProperties reach the object chain", () => {
    expect(
      validateMeta((c) => applyKeywordBinding(c, minPropertiesBinding, 2), {
        a: 1,
      })
    ).toBe(false);
    expect(
      validateMeta((c) => applyKeywordBinding(c, maxPropertiesBinding, 1), {
        a: 1,
        b: 2,
      })
    ).toBe(false);
  });

  // `required` and `const` bind at slot "any" because their plugins declare
  // every slot. The point of that slot is that the SAME binding reaches a
  // string field and a number field.
  it("required at slot any rejects a missing value", () => {
    const mustHaveName = jsonSchemaBagBuilder
      .for<Sample>()
      .v("name", (b) => applyKeywordBinding(b.any, requiredBinding, true))
      .build();
    expect(mustHaveName.validate({ tags: [], age: 1, meta: {} }).valid).toBe(
      false
    );
    expect(
      mustHaveName.validate({ tags: [], name: "n", age: 1, meta: {} }).valid
    ).toBe(true);
  });

  it("const at slot any rejects anything but the literal", () => {
    const fixedAge = jsonSchemaBagBuilder
      .for<Sample>()
      .v("age", (b) => applyKeywordBinding(b.any, constBinding, 42))
      .build();
    expect(
      fixedAge.validate({ tags: [], name: "n", age: 42, meta: {} }).valid
    ).toBe(true);
    expect(
      fixedAge.validate({ tags: [], name: "n", age: 41, meta: {} }).valid
    ).toBe(false);
  });
});

describe("format bindings run on the real chain", () => {
  const runFormat = (format: string, value: string): boolean => {
    const handling = findFormatHandling(format);
    if (handling === undefined || handling.handling !== "bind") {
      throw new Error(`${format} does not bind`);
    }
    return validateName(
      (c) => applyKeywordBinding(c, handling, "format"),
      value
    );
  };

  // The two 1.x was MEASURED to get wrong: `format: "date"` accepted
  // "2024-13-01" and `format: "ipv4"` accepted "999.999.999.999", because
  // neither format was on the builder path at all. Both now reject.
  it("date rejects an impossible calendar date", () => {
    expect(runFormat("date", "2024-01-31")).toBe(true);
    expect(runFormat("date", "2024-13-01")).toBe(false);
  });

  it("ipv4 rejects an out-of-range octet", () => {
    expect(runFormat("ipv4", "192.168.0.1")).toBe(true);
    expect(runFormat("ipv4", "999.999.999.999")).toBe(false);
  });

  it("every bound format accepts a good value and rejects a bad one", () => {
    const samples: readonly (readonly [string, string, string])[] = [
      ["date-time", "2024-01-31T10:00:00Z", "2024-01-31 10:00:00"],
      ["date", "2024-01-31", "31-01-2024"],
      ["time", "10:00:00", "25:00:00"],
      ["duration", "P1Y2M3D", "1 year"],
      ["email", "a@b.co", "a b@c.co"],
      ["hostname", "example.com", "-bad-.com"],
      ["ipv4", "10.0.0.1", "10.0.0"],
      ["ipv6", "2001:db8::1", "gggg::1"],
      ["uri", "https://example.com/x", "not a uri"],
      ["url", "https://example.com/x", "not a url"],
      ["iri", "https://example.com/x", "no scheme here"],
      ["iri-reference", "/path/x", "has a space"],
      ["uri-template", "/x/{id}", "/x/{id"],
      ["json-pointer", "/a/b", "a/b"],
      ["relative-json-pointer", "1/a", "/a"],
      ["uuid", "123e4567-e89b-12d3-a456-426614174000", "123e4567"],
    ];
    for (const [format, good, bad] of samples) {
      expect([format, runFormat(format, good)]).toEqual([format, true]);
      expect([format, runFormat(format, bad)]).toEqual([format, false]);
    }
  });
});
