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

  it.each(["__proto__", "constructor", "prototype"])(
    "rejects the reserved key %s",
    (key) => {
      expect(() => assertDeclarableKey(key, "x")).toThrow(
        /reserved segment \(prototype pollution\)/
      );
    }
  );

  it("carries the source path so a regression names the offender", () => {
    let caught: unknown = null;
    try {
      assertDeclarableKey("__proto__", "payload.__proto__");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PathSyntaxError);
    expect((caught as PathSyntaxError).path).toBe("payload.__proto__");
    expect((caught as PathSyntaxError).name).toBe("PathSyntaxError");
    expect(caught).toBeInstanceOf(Error);
  });
});
