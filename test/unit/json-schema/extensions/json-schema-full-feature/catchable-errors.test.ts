// ===========================================================================
// Every error fromJsonSchema can throw must be catchable BY CLASS from the
// subpath that offers fromJsonSchema.
//
// This subpath is the one-import route and the one the documentation points a
// reader at. It offered `UnsupportedDialectError` alone, so a caller who hit
// any of the other three had nothing to catch but `Error` and nothing to
// discriminate on but the message text — which this repository is otherwise at
// pains not to make anyone parse.
//
// The four are deliberately separate classes because they call for different
// responses: the document is not Draft-07 at all; it is Draft-07 and malformed;
// it is well formed and uses a keyword Luq cannot honour; it is not a schema.
// A caller that cannot tell them apart has to treat every bad document the same
// way.
//
// The assertions go through the PUBLIC subpath, never through src/json-schema,
// because the gap being pinned was one of re-export and an internal import
// would not have seen it.
// ===========================================================================
import {
  MalformedSchemaError,
  NotASchemaError,
  UnsupportedDialectError,
  UnsupportedKeywordError,
  fromJsonSchema,
} from "../../../../../src/json-schema/extensions/json-schema-full-feature/index";

/** Runs the build and hands back whatever came out of it. */
function thrownBy(schema: unknown): unknown {
  try {
    fromJsonSchema(schema);
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("the errors fromJsonSchema can throw", () => {
  it("offers all four classes on the subpath that offers fromJsonSchema", () => {
    expect(typeof MalformedSchemaError).toBe("function");
    expect(typeof NotASchemaError).toBe("function");
    expect(typeof UnsupportedDialectError).toBe("function");
    expect(typeof UnsupportedKeywordError).toBe("function");
  });

  it("throws a value that is not a schema as NotASchemaError", () => {
    expect(thrownBy(42)).toBeInstanceOf(NotASchemaError);
  });

  it("throws a malformed keyword value as MalformedSchemaError", () => {
    const thrown = thrownBy({
      type: "object",
      properties: { a: { type: "string" } },
      additionalProperties: "false",
    });
    expect(thrown).toBeInstanceOf(MalformedSchemaError);
  });

  it("throws a foreign dialect as UnsupportedDialectError", () => {
    const thrown = thrownBy({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
    });
    expect(thrown).toBeInstanceOf(UnsupportedDialectError);
  });

  it("throws a keyword it cannot honour as UnsupportedKeywordError", () => {
    const thrown = thrownBy({
      type: "object",
      properties: {
        xs: { type: "array", contains: { type: "number" }, minContains: 2 },
      },
    });
    expect(thrown).toBeInstanceOf(UnsupportedKeywordError);
  });

  it("keeps the four apart, so catching one does not catch another", () => {
    const malformed = thrownBy({ type: "strig" });
    const dialect = thrownBy({
      $schema: "https://json-schema.org/draft/2020-12/schema",
    });
    expect(malformed).not.toBeInstanceOf(UnsupportedDialectError);
    expect(dialect).not.toBeInstanceOf(MalformedSchemaError);
    expect(dialect).not.toBeInstanceOf(UnsupportedKeywordError);
  });
});
