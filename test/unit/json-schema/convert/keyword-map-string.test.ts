// ===========================================================================
// test/unit/json-schema/convert/keyword-map-string.test.ts
//
// `pattern` is the one string keyword whose value is COMPILED rather than
// passed through, and compiling is what hides a malformed value: every JSON
// value has a string form, so an object compiles to a pattern matching almost
// anything and a number compiles to a literal digit. The stringPattern plugin
// refuses a non-RegExp, but by then a RegExp is exactly what it has been
// handed, so the refusal has to happen where the compiling happens.
//
// Driven through fromJsonSchema rather than through the binding's own
// toArguments, because the value only ever arrives from a document.
// ===========================================================================
import { MalformedSchemaError } from "../../../../src/json-schema/malformed-schema-error";
import { fromJsonSchema } from "../../../../src/json-schema/build-from-schema";
import { refusalFrom } from "../malformed-schema-refusal";
import { jsonSchemaBagFixture } from "./json-schema-bag-fixture";

const build = (schema: unknown) => fromJsonSchema(jsonSchemaBagFixture, schema);

const buildPattern = (pattern: unknown) =>
  build({ properties: { a: { pattern } } });

describe("`pattern` refuses a value that is not a string", () => {
  it("refuses an object rather than compiling its string form", () => {
    // The string form of an object is "[object Object]", which compiles to a
    // pattern matching every string containing it — and, worse, the plugin
    // then sees a perfectly valid RegExp and has nothing left to refuse.
    const error = refusalFrom(() => buildPattern({ source: "^SKU-" }));
    expect(error.keyword).toBe("pattern");
    expect(error.received).toBe('{"source":"^SKU-"}');
  });

  it("refuses a number rather than compiling a literal digit pattern", () => {
    const error = refusalFrom(() => buildPattern(7));
    expect(error.keyword).toBe("pattern");
    expect(error.received).toBe("7");
  });

  it("refuses null and an array of sources", () => {
    expect(() => buildPattern(null)).toThrow(MalformedSchemaError);
    expect(() => buildPattern(["^a", "^b"])).toThrow(MalformedSchemaError);
  });
});

describe("`pattern` refuses a string that is not an ECMA-262 pattern", () => {
  it("reports the keyword instead of leaking a raw SyntaxError", () => {
    const error = refusalFrom(() => buildPattern("("));
    expect(error.keyword).toBe("pattern");
    expect(error.message).toContain("pattern");
    expect(error).not.toBeInstanceOf(SyntaxError);
  });

  it("carries the offending source so the document can be found", () => {
    expect(refusalFrom(() => buildPattern("a{2,1}")).received).toBe('"a{2,1}"');
  });
});

describe("a well-formed `pattern` is unaffected", () => {
  it("still compiles the document's source and judges against it", () => {
    const validator = buildPattern("^z");
    expect(validator.validate({ a: "zebra" }).valid).toBe(true);
    expect(validator.validate({ a: "abc" }).valid).toBe(false);
  });

  it("keeps the source literal, anchoring and all", () => {
    const validator = buildPattern("^[0-9]{3}$");
    expect(validator.validate({ a: "123" }).valid).toBe(true);
    expect(validator.validate({ a: "1234" }).valid).toBe(false);
  });
});
