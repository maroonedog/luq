// ===========================================================================
// test/unit/json-schema/convert/declare-scalar-keywords.test.ts
//
// The counterpart of structural-expansion.test.ts for the OTHER half of the
// vocabulary: every keyword the table BINDS must change a verdict. The type
// system proves a binding names a real method; only running it proves the
// converter actually reaches the binding, which is the half 1.x got wrong —
// `minItems` type-checked and evaporated.
// ===========================================================================
import {
  findFormatHandling,
  listFormatNames,
} from "../../../../src/json-schema/format-map";
import {
  findKeywordHandling,
  listDraft07Keywords,
} from "../../../../src/json-schema/keyword-map";
import { UnsupportedKeywordError } from "../../../../src/json-schema/unsupported-keyword-error";
import { fromJsonSchema } from "../../../../src/json-schema/build-from-schema";
import { jsonSchemaBagFixture } from "./json-schema-bag-fixture";

const boundKeywords = listDraft07Keywords()
  .filter((keyword) => findKeywordHandling(keyword)?.handling === "bind")
  .slice()
  .sort();

const build = (schema: unknown) => fromJsonSchema(jsonSchemaBagFixture, schema);

const validateA = (subSchema: unknown, value: unknown): boolean =>
  build({ properties: { a: subSchema } }).validate({ a: value }).valid;

/** One rejection per bound keyword. A dropped binding turns a case green. */
const REFUSED_BY: Readonly<
  Record<string, { schema: unknown; value: unknown }>
> = {
  const: { schema: { properties: { a: { const: 5 } } }, value: { a: 6 } },
  multipleOf: {
    schema: { properties: { a: { multipleOf: 3 } } },
    value: { a: 4 },
  },
  maximum: { schema: { properties: { a: { maximum: 3 } } }, value: { a: 4 } },
  exclusiveMaximum: {
    schema: { properties: { a: { exclusiveMaximum: 3 } } },
    value: { a: 3 },
  },
  minimum: { schema: { properties: { a: { minimum: 3 } } }, value: { a: 2 } },
  exclusiveMinimum: {
    schema: { properties: { a: { exclusiveMinimum: 3 } } },
    value: { a: 3 },
  },
  maxLength: {
    schema: { properties: { a: { maxLength: 2 } } },
    value: { a: "abc" },
  },
  minLength: {
    schema: { properties: { a: { minLength: 2 } } },
    value: { a: "a" },
  },
  pattern: {
    schema: { properties: { a: { pattern: "^z" } } },
    value: { a: "abc" },
  },
  contentEncoding: {
    schema: { properties: { a: { contentEncoding: "base64" } } },
    value: { a: "not base64 !!" },
  },
  contentMediaType: {
    schema: { properties: { a: { contentMediaType: "application/json" } } },
    value: { a: "not json" },
  },
  maxItems: {
    schema: { properties: { a: { maxItems: 1 } } },
    value: { a: [1, 2] },
  },
  minItems: {
    schema: { properties: { a: { minItems: 2 } } },
    value: { a: [1] },
  },
  uniqueItems: {
    schema: { properties: { a: { uniqueItems: true } } },
    value: { a: [1, 1] },
  },
  maxProperties: {
    schema: { properties: { a: { maxProperties: 1 } } },
    value: { a: { x: 1, y: 2 } },
  },
  minProperties: {
    schema: { properties: { a: { minProperties: 2 } } },
    value: { a: { x: 1 } },
  },
  required: {
    schema: { properties: { a: { required: ["q"] } } },
    value: { a: {} },
  },
  additionalProperties: {
    schema: {
      properties: { a: { properties: { x: {} }, additionalProperties: false } },
    },
    value: { a: { x: 1, y: 2 } },
  },
};

describe("every bound keyword", () => {
  it("counts eighteen of them", () => {
    expect(boundKeywords).toHaveLength(18);
  });

  it.each(boundKeywords)("%s refuses a document it must refuse", (keyword) => {
    const declared = REFUSED_BY[keyword];
    expect(declared).toBeDefined();
    if (declared === undefined) return;
    expect(build(declared.schema).validate(declared.value).valid).toBe(false);
  });
});

describe("format", () => {
  const SAMPLE: Readonly<Record<string, string>> = {
    "date-time": "not a date-time",
    date: "2024-13-01",
    time: "99:99:99",
    duration: "not a duration",
    email: "not an email",
    hostname: "-nope-",
    ipv4: "999.999.999.999",
    ipv6: "zzzz::1",
    uri: "not a uri",
    url: "not a url",
    iri: "not an iri",
    "iri-reference": " has a space ",
    "uri-template": "{unclosed",
    "json-pointer": "no-leading-slash",
    "relative-json-pointer": "not-relative",
    uuid: "not-a-uuid",
    "idn-email": "no-at-sign",
    "idn-hostname": "-nope-",
    "uri-reference": "has space",
    regex: "a**",
  };

  const boundFormats = listFormatNames().filter(
    (name) => findFormatHandling(name)?.handling === "bind"
  );
  const unsupportedFormats = listFormatNames().filter(
    (name) => findFormatHandling(name)?.handling === "unsupported"
  );

  it("binds all twenty names and declares none out of scope", () => {
    expect(boundFormats).toHaveLength(20);
    expect(unsupportedFormats).toHaveLength(0);
  });

  it.each(boundFormats)("%s rejects a value of the wrong shape", (name) => {
    const sample = SAMPLE[name];
    expect(sample).toBeDefined();
    if (sample === undefined) return;
    expect(validateA({ format: name }, sample)).toBe(false);
  });

  // No FORMAT is out of scope any more, so the "declared unsupported" branch
  // has no example left in the format table. The branch itself must stay
  // reachable — it is the thing that stops a value the library cannot check
  // from being accepted silently — so it is proved on the other scalar
  // keyword that still uses it.
  it("still throws UnsupportedKeywordError for a value it cannot check", () => {
    expect(() =>
      build({ properties: { a: { contentEncoding: "uuencode" } } })
    ).toThrow(UnsupportedKeywordError);
  });

  it("passes an UNKNOWN name through as an annotation (§7.2)", () => {
    // The distinction 1.x lost: its validator passed unknown formats and its
    // error generator failed them.
    expect(validateA({ format: "not-a-registered-format" }, "zz")).toBe(true);
  });
});

describe("enum and const", () => {
  it("drives .oneOf() from the enum list", () => {
    expect(validateA({ enum: ["x", "y"] }, "x")).toBe(true);
    expect(validateA({ enum: ["x", "y"] }, "z")).toBe(false);
  });

  it("accepts a const of any JSON scalar, including false and 0", () => {
    expect(validateA({ const: false }, false)).toBe(true);
    expect(validateA({ const: false }, true)).toBe(false);
    expect(validateA({ const: 0 }, 0)).toBe(true);
    expect(validateA({ const: 0 }, 1)).toBe(false);
  });
});

describe("contentEncoding", () => {
  it("refuses an encoding the plugin does not know, at BUILD time", () => {
    // 1.x accepted every unknown name and then validated nothing.
    expect(() =>
      build({ properties: { a: { contentEncoding: "totally-made-up" } } })
    ).toThrow(UnsupportedKeywordError);
  });

  it("accepts every encoding it does know", () => {
    for (const encoding of ["base64", "base32", "binary", "7bit", "8bit"]) {
      expect(() =>
        build({ properties: { a: { contentEncoding: encoding } } })
      ).not.toThrow();
    }
  });
});
