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

  // 以前はこの3つを名前で拒否していた。その拒否は過剰だったので外した。
  // 危険なのは書き込みだけで、create-value-writer が defineProperty に移した
  // ことで経路が閉じている。詳しくは reserved-segment.ts のコメントと
  // test/unit/path/prototype-pollution.test.ts を参照。
  it.each(["__proto__", "constructor", "prototype"])(
    "%s はもう名前で拒否しない（書き込み側で安全にした）",
    (key) => {
      expect(() => assertDeclarableKey(key, "x")).not.toThrow();
    }
  );

  it("carries the source path so a regression names the offender", () => {
    let caught: unknown = null;
    try {
      // 文法として表現できないキーは今も拒否する。拒否する理由が
      // 「プロトタイプ汚染」から「文法が "." で割るのでエスケープが無い」に
      // 変わっただけで、source path を載せる約束は変わらない。
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
