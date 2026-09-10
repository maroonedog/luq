// Confirms that prototype pollution cannot happen, by actually attempting it.
//
// The path parser used to refuse "__proto__" as a declared segment. That was
// over-broad: it made validating a property actually named __proto__
// impossible, which the conformance suite requires.
//
// In place of the refusal, the value writer stopped assigning and moved to
// defineProperty. The danger is that Object.prototype.__proto__ is an
// ACCESSOR: assigning invokes it and swaps the prototype. defineProperty
// ignores accessors and defines the own property, closing that route.
//
// This file guards that boundary. If it fails, pollution has become possible.
import { createValueReader } from "../../../src/path/create-value-reader";
import { createValueWriter } from "../../../src/path/create-value-writer";
import { parseFieldPath } from "../../../src/path/parse-field-path";
import { RESERVED_SEGMENTS } from "../../../src/path/reserved-segment";

/** Confirms nothing was added to Object.prototype. */
function readFromPrototype(key: string): unknown {
  return (Object.prototype as unknown as Record<string, unknown>)[key];
}

describe("what became declarable", () => {
  it.each(RESERVED_SEGMENTS)("parses %s as a declared path", (segment) => {
    expect(() => parseFieldPath(segment)).not.toThrow();
  });

  it("reads __proto__ as an own property", () => {
    // JSON.parse creates __proto__ as an own property.
    const subject: unknown = JSON.parse('{"__proto__": "own value"}');
    const read = createValueReader(parseFieldPath("__proto__"));
    expect(read(subject)).toBe("own value");
  });

  it("does not read a value through the prototype", () => {
    // Anything not own reads as undefined; reading was always own-only.
    const read = createValueReader(parseFieldPath("toString"));
    expect(read({})).toBeUndefined();
  });
});

describe("and Object.prototype still cannot be polluted", () => {
  afterEach(() => {
    for (const key of ["polluted", "injected"]) {
      delete (Object.prototype as unknown as Record<string, unknown>)[key];
    }
  });

  it("does not swap the prototype when writing to __proto__", () => {
    const write = createValueWriter(parseFieldPath("__proto__"));
    const written = write({}, { polluted: "yes" });

    // What was written is an own property.
    expect(Object.prototype.hasOwnProperty.call(written, "__proto__")).toBe(
      true
    );
    // The prototype is unchanged.
    expect(Object.getPrototypeOf(written)).toBe(Object.prototype);
    // Nothing leaked to another object.
    expect(readFromPrototype("polluted")).toBeUndefined();
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  it("does not pollute when writing to a nested __proto__", () => {
    const write = createValueWriter(parseFieldPath("nested.__proto__"));
    const written = write({ nested: {} }, { injected: "yes" });
    expect(readFromPrototype("injected")).toBeUndefined();
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    void written;
  });

  it("does not pollute when writing through created intermediates", () => {
    // The auto-vivify route. Back on assignment, this is pollutable.
    const write = createValueWriter(parseFieldPath("missing.__proto__"));
    write({}, { injected: "yes" });
    expect(readFromPrototype("injected")).toBeUndefined();
  });

  it("makes own properties of constructor and prototype too", () => {
    for (const key of ["constructor", "prototype"]) {
      const written = write1(key, "own value");
      expect(Object.prototype.hasOwnProperty.call(written, key)).toBe(true);
      expect((written as Record<string, unknown>)[key]).toBe("own value");
    }
    // Object.prototype.constructor is still Object.
    expect(Object.prototype.constructor).toBe(Object);
  });

  it("leaves the input object unmodified", () => {
    const input = {};
    createValueWriter(parseFieldPath("__proto__"))(input, { polluted: "yes" });
    expect(Object.prototype.hasOwnProperty.call(input, "__proto__")).toBe(
      false
    );
  });
});

function write1(key: string, value: unknown): unknown {
  return createValueWriter(parseFieldPath(key))({}, value);
}
