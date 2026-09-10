import {
  PathSyntaxError,
  RESERVED_SEGMENTS,
  assertDeclarableKey,
  isReservedSegment,
} from "../../../src/path/reserved-segment";

describe("reserved segments", () => {
  it("is exactly the three prototype-reaching names", () => {
    expect([...RESERVED_SEGMENTS].sort()).toEqual([
      "__proto__",
      "constructor",
      "prototype",
    ]);
  });

  it("is frozen: the denylist cannot be widened or emptied at runtime", () => {
    expect(Object.isFrozen(RESERVED_SEGMENTS)).toBe(true);
  });

  it.each(["__proto__", "constructor", "prototype"])("flags %s", (key) => {
    expect(isReservedSegment(key)).toBe(true);
  });

  it.each(["proto", "Constructor", "prototypes", "name", "__proto"])(
    "does not flag %s",
    (key) => {
      expect(isReservedSegment(key)).toBe(false);
    }
  );
});

describe("assertDeclarableKey — the gate fromJsonSchema must call", () => {
  it("accepts an ordinary key", () => {
    expect(() => assertDeclarableKey("street", "user.street")).not.toThrow();
  });

  it("rejects a key containing a dot, because the grammar has no escape", () => {
    expect(() => assertDeclarableKey("a.b", "<schema property>")).toThrow(
      PathSyntaxError
    );
    expect(() => assertDeclarableKey("a.b", "<schema property>")).toThrow(
      /no escape/
    );
  });

  it("rejects the empty key", () => {
    expect(() => assertDeclarableKey("", "x")).toThrow(PathSyntaxError);
  });

  it.each(["a[", "a]", "a[0]", "a[*]"])("rejects the bracket in %s", (key) => {
    expect(() => assertDeclarableKey(key, "x")).toThrow(PathSyntaxError);
  });

  // These three used to be refused by name. That was over-broad: only writing
  // is dangerous, and writing through defineProperty closes the route. See
  // reserved-segment.ts.
  it.each(["__proto__", "constructor", "prototype"])(
    "%s is no longer refused by name, writing having been made safe",
    (key) => {
      expect(() => assertDeclarableKey(key, "x")).not.toThrow();
    }
  );

  it("carries the source path so a regression names the offender", () => {
    let caught: unknown = null;
    try {
      // A key the grammar cannot express is still refused. The reason moved
      // from prototype pollution to the grammar splitting on "." with no
      // escape; the promise to carry the source path did not.
      assertDeclarableKey("a.b", "payload.a.b");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PathSyntaxError);
    expect((caught as PathSyntaxError).path).toBe("payload.a.b");
    expect((caught as PathSyntaxError).name).toBe("PathSyntaxError");
    expect(caught).toBeInstanceOf(Error);
  });
});
