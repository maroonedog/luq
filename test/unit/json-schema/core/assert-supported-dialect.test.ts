// ===========================================================================
// test/unit/json-schema/core/assert-supported-dialect.test.ts
//
// The refusal that has no keyword to hang on. Every other refusal in this
// directory is triggered by a NAME the document wrote; this one is triggered by
// the dialect the document declares, because the divergence it guards is
// invisible in the keyword list.
//
// The case that made it necessary is the first test below: a 2020-12 document
// whose `$ref` carries a sibling `minLength`. Every keyword in it is a Draft-07
// keyword, spelled the Draft-07 way, so the keyword table sees nothing wrong —
// and Draft-07 §8.3 has `$ref` REPLACE the node it sits in, so the sibling is
// dropped and the built validator accepts a value the document forbids.
// ===========================================================================
import {
  MalformedSchemaError,
  UnsupportedDialectError,
  assertSupportedDialect,
} from "../../../../src/json-schema";
import { fromJsonSchema } from "../../../../src/json-schema/build-from-schema";
import { jsonSchemaBagFixture } from "../convert/json-schema-bag-fixture";

const build = (schema: unknown, options?: { assumeDraft07?: boolean }) =>
  fromJsonSchema(jsonSchemaBagFixture, schema, undefined, options);

/** The document from the report: every keyword Draft-07, the meaning 2020-12. */
const REF_SIBLING_DOCUMENT = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["nick"],
  $defs: { name: { type: "string" } },
  properties: { nick: { $ref: "#/$defs/name", minLength: 5 } },
};

describe("a dialect Luq does not implement is refused, never read as Draft-07", () => {
  it("refuses the 2020-12 document whose `$ref` sibling would be dropped", () => {
    expect(() => build(REF_SIBLING_DOCUMENT)).toThrow(UnsupportedDialectError);
  });

  it("names the declared dialect, the implemented one, and the way out", () => {
    let thrown: unknown;
    try {
      build(REF_SIBLING_DOCUMENT);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(UnsupportedDialectError);
    expect(thrown).toBeInstanceOf(Error);
    if (!(thrown instanceof UnsupportedDialectError)) return;
    expect(thrown.name).toBe("UnsupportedDialectError");
    expect(thrown.declared).toBe(
      "https://json-schema.org/draft/2020-12/schema"
    );
    expect(thrown.implemented).toBe("http://json-schema.org/draft-07/schema#");
    expect(thrown.message).toContain(
      "https://json-schema.org/draft/2020-12/schema"
    );
    expect(thrown.message).toContain("http://json-schema.org/draft-07/schema#");
    expect(thrown.message).toContain("assumeDraft07");
  });

  it("refuses every released dialect that is not Draft-07, by name", () => {
    const declared = [
      "http://json-schema.org/draft-03/schema#",
      "http://json-schema.org/draft-04/schema#",
      "http://json-schema.org/draft-06/schema#",
      "https://json-schema.org/draft/2019-09/schema",
      "https://json-schema.org/draft/2020-12/schema",
    ];
    for (const $schema of declared) {
      // The URI is carried into the expectation so a failure names WHICH
      // spelling slipped through rather than only that one of five did.
      expect(() => build({ $schema })).toThrow(UnsupportedDialectError);
      expect(() => build({ $schema })).toThrow($schema);
    }
  });

  it("refuses a `$schema` it does not recognise at all", () => {
    expect(() => build({ $schema: "https://example.test/my-meta" })).toThrow(
      UnsupportedDialectError
    );
    expect(() => build({ $schema: "https://example.test/my-meta" })).toThrow(
      /assumeDraft07/
    );
  });
});

describe("what must keep building exactly as before", () => {
  it("builds a document with no `$schema` at all", () => {
    const validator = build({
      type: "object",
      properties: { nick: { type: "string", minLength: 5 } },
      required: ["nick"],
    });
    expect(validator.validate({ nick: "ab" }).valid).toBe(false);
    expect(validator.validate({ nick: "abcde" }).valid).toBe(true);
  });

  it("builds a document declaring Draft-07, however the URI is spelled", () => {
    const spellings = [
      "http://json-schema.org/draft-07/schema#",
      "http://json-schema.org/draft-07/schema",
      "https://json-schema.org/draft-07/schema#",
    ];
    for (const $schema of spellings) {
      const validator = build({
        $schema,
        type: "object",
        properties: { nick: { type: "string", minLength: 5 } },
      });
      expect([$schema, validator.validate({ nick: "ab" }).valid]).toEqual([
        $schema,
        false,
      ]);
    }
  });

  it("accepts the §4.4 boolean form, which declares no dialect", () => {
    expect(() => build(true)).not.toThrow();
    expect(() => build(false)).not.toThrow();
  });
});

describe("the opt-out", () => {
  it("reads the document as Draft-07 when the caller says to", () => {
    const validator = build(REF_SIBLING_DOCUMENT, { assumeDraft07: true });
    // Draft-07 §8.3 exactly: `$ref` replaced the node, so `minLength` is gone.
    // That is the reading the caller asked for, stated at the call site.
    expect(validator.validate({ nick: "ab" }).valid).toBe(true);
  });

  it("does nothing when the flag is false, which is the default", () => {
    expect(() => build(REF_SIBLING_DOCUMENT, { assumeDraft07: false })).toThrow(
      UnsupportedDialectError
    );
  });
});

describe("`$schema` that is not a URI string at all", () => {
  // The meta-schema types `$schema` as a string, so a non-string is a
  // malformed VALUE rather than an unimplemented dialect, and it is refused by
  // the class that answers that question.
  it("refuses a non-string value with MalformedSchemaError", () => {
    expect(() => build({ $schema: 7 })).toThrow(MalformedSchemaError);
    expect(() => build({ $schema: 7 })).toThrow(/must be a URI string/);
    expect(() => build({ $schema: ["draft-07"] })).toThrow(
      MalformedSchemaError
    );
  });

  it("refuses it even under the opt-out: the opt-out names a dialect", () => {
    expect(() => build({ $schema: 7 }, { assumeDraft07: true })).toThrow(
      MalformedSchemaError
    );
  });
});

describe("assertSupportedDialect, called directly", () => {
  it("passes a value that is not a schema object: nothing declares a dialect", () => {
    expect(() => assertSupportedDialect(true, {})).not.toThrow();
    expect(() => assertSupportedDialect("not a schema", {})).not.toThrow();
    expect(() => assertSupportedDialect(undefined, {})).not.toThrow();
  });

  it("reads the ROOT only: a nested `$schema` is not the document's dialect", () => {
    expect(() =>
      assertSupportedDialect(
        {
          properties: {
            a: { $schema: "https://json-schema.org/draft/2020-12/schema" },
          },
        },
        {}
      )
    ).not.toThrow();
  });
});
