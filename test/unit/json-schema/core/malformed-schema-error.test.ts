// ===========================================================================
// test/unit/json-schema/core/malformed-schema-error.test.ts
//
// The refusal a caller sees when a run-time document is not Draft-07. Two
// properties matter to that caller and neither is obvious from the class body:
// the error must be catchable by identity WITHOUT also catching
// UnsupportedKeywordError, and rendering the offending value must never be the
// thing that throws — the value comes from the same untrusted document, so it
// can be circular, enormous, or hold something JSON cannot encode.
// ===========================================================================
import {
  MalformedSchemaError,
  renderReceivedValue,
} from "../../../../src/json-schema/malformed-schema-error";
import { UnsupportedKeywordError } from "../../../../src/json-schema/unsupported-keyword-error";

describe("MalformedSchemaError", () => {
  it("carries the keyword, the reason and a rendering of the value", () => {
    const error = new MalformedSchemaError(
      "type",
      'the name "strig" must be one of the seven type names',
      "strig"
    );

    expect(error.keyword).toBe("type");
    expect(error.reason).toBe(
      'the name "strig" must be one of the seven type names'
    );
    expect(error.received).toBe('"strig"');
  });

  it("states what to fix in the document", () => {
    const error = new MalformedSchemaError(
      "type",
      'the name "strig" must be one of the seven type names',
      "strig"
    );

    expect(error.message).toBe(
      'JSON Schema keyword "type" has a value the Draft-07 meta-schema does ' +
        'not allow: the name "strig" must be one of the seven type ' +
        "names. " +
        'Received: "strig".'
    );
  });

  it("is catchable by identity", () => {
    const error = new MalformedSchemaError(
      "pattern",
      "the value must be a string",
      {}
    );

    expect(error).toBeInstanceOf(MalformedSchemaError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("MalformedSchemaError");
  });

  it("does not answer to the unsupported-keyword refusal", () => {
    const malformed = new MalformedSchemaError(
      "additionalProperties",
      "the value must be an object or a boolean",
      "false"
    );
    const unsupported = new UnsupportedKeywordError("contains", "no plugin");

    expect(malformed).not.toBeInstanceOf(UnsupportedKeywordError);
    expect(unsupported).not.toBeInstanceOf(MalformedSchemaError);
  });
});

describe("renderReceivedValue", () => {
  it("renders the JSON forms the way a document author wrote them", () => {
    expect(renderReceivedValue("strig")).toBe('"strig"');
    expect(renderReceivedValue(7)).toBe("7");
    expect(renderReceivedValue(true)).toBe("true");
    expect(renderReceivedValue(null)).toBe("null");
    expect(renderReceivedValue({ source: "^SKU-" })).toBe('{"source":"^SKU-"}');
    expect(renderReceivedValue(["a", "b"])).toBe('["a","b"]');
  });

  it("names the values JSON has no encoding for", () => {
    expect(renderReceivedValue(undefined)).toBe("undefined");
    expect(renderReceivedValue(() => true)).toBe("[function]");
    expect(renderReceivedValue(Symbol("x"))).toBe("[symbol]");
  });

  it("truncates a value too large to belong in a message", () => {
    const huge = { items: "x".repeat(10_000) };

    const rendered = renderReceivedValue(huge);

    expect(rendered.length).toBeLessThanOrEqual(80);
    expect(rendered.endsWith("...")).toBe(true);
    expect(rendered.startsWith('{"items":"xxx')).toBe(true);
  });

  it("survives a value that cannot be serialised at all", () => {
    const circular: Record<string, unknown> = { type: "object" };
    circular.self = circular;

    expect(renderReceivedValue(circular)).toBe("[unrenderable object]");
    expect(renderReceivedValue([circular])).toBe("[unrenderable array]");
    expect(renderReceivedValue({ min: BigInt(3) })).toBe(
      "[unrenderable object]"
    );
  });

  it("keeps the message finite when the value is enormous", () => {
    const enormous: Record<string, string> = {};
    for (let index = 0; index < 2000; index += 1) {
      enormous[`property${index}`] = "y".repeat(100);
    }

    const error = new MalformedSchemaError(
      "properties",
      "the value must be an object mapping property names to schemas",
      enormous
    );

    expect(error.received.length).toBe(80);
    expect(error.message.length).toBeLessThan(250);
  });
});
