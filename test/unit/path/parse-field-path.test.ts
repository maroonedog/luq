import {
  formatFieldPath,
  leafKeyOf,
  parentFieldPath,
  parseFieldPath,
} from "../../../src/path/parse-field-path";
import { PathSyntaxError } from "../../../src/path/reserved-segment";
import {
  NO_GRAMMAR_DRIFT,
  PATH_GRAMMAR_TABLE,
  TABLE_IS_RUNTIME_VOCABULARY,
} from "./path-grammar-table";

describe("parseFieldPath — the shared grammar table", () => {
  it("compiles the anti-drift gate: ParsePath agrees with parseFieldPath", () => {
    // NO_GRAMMAR_DRIFT is `true` only when every row's type-level parse equals
    // its runtime segments. If the two parsers diverge the file stops
    // typechecking and ts-jest fails this suite before it runs.
    expect(NO_GRAMMAR_DRIFT).toBe(true);
    expect(TABLE_IS_RUNTIME_VOCABULARY).toBe(true);
  });

  it.each(PATH_GRAMMAR_TABLE.map((entry) => [entry.path, entry] as const))(
    "parses %s",
    (_path, entry) => {
      expect(parseFieldPath(entry.path)).toEqual(entry.segments);
    }
  );

  it("round-trips every row through formatFieldPath", () => {
    for (const entry of PATH_GRAMMAR_TABLE) {
      expect(formatFieldPath(parseFieldPath(entry.path))).toBe(entry.path);
    }
  });

  it("yields [key, each, each] in that order for matrix[*][*]", () => {
    expect(parseFieldPath("matrix[*][*]")).toEqual([
      { kind: "key", key: "matrix" },
      { kind: "each" },
      { kind: "each" },
    ]);
  });

  it("freezes the segments so a consumer cannot edit a compiled template", () => {
    const segments = parseFieldPath("a.b");
    expect(Object.isFrozen(segments)).toBe(true);
    expect(Object.isFrozen(segments[0])).toBe(true);
  });
});

describe("parseFieldPath — rejections", () => {
  it("rejects the empty path", () => {
    expect(() => parseFieldPath("")).toThrow(PathSyntaxError);
  });

  it.each([".name", "name.", "a..b", "[*]", "a.[*]"])(
    "rejects the empty segment in %s",
    (path) => {
      expect(() => parseFieldPath(path)).toThrow(PathSyntaxError);
    }
  );

  it.each(["items[0]", "items[0].name", "items[]", "it[*]ems", "items[*][0]"])(
    "rejects the index/bracket form %s (that is the ISSUE grammar)",
    (path) => {
      expect(() => parseFieldPath(path)).toThrow(PathSyntaxError);
    }
  );

  // Refusing by name was dropped: validating an object with a "__proto__" key
  // has to be possible, and writing through defineProperty closes the
  // pollution route. See prototype-pollution.test.ts for the safety.
  it.each([
    "__proto__",
    "constructor",
    "prototype",
    "a.__proto__.b",
    "a.constructor",
    "items[*].__proto__",
    "__proto__[*]",
  ])("accepts %s as a declared path", (path) => {
    expect(() => parseFieldPath(path)).not.toThrow();
  });

  it("names the offending path on the error", () => {
    let caught: unknown = null;
    try {
      // What the grammar cannot express is still refused.
      parseFieldPath("a..b");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PathSyntaxError);
    expect((caught as PathSyntaxError).path).toBe("a..b");
  });

  it("accepts a key that merely CONTAINS a reserved name", () => {
    expect(parseFieldPath("myconstructor")).toEqual([
      { kind: "key", key: "myconstructor" },
    ]);
  });
});

describe("parentFieldPath / leafKeyOf — step 9 depends on both", () => {
  it.each([
    ["a.b.c", "a.b"],
    ["items[*].name", "items[*]"],
    ["items[*]", "items"],
    ["matrix[*][*]", "matrix[*]"],
    ["orders[*].items[*].productId", "orders[*].items[*]"],
    ["departments[*].teams[*]", "departments[*].teams"],
  ] as const)("parentFieldPath(%s) === %s", (path, expected) => {
    expect(parentFieldPath(path)).toBe(expected);
  });

  it("returns null at the top level", () => {
    expect(parentFieldPath("name")).toBeNull();
  });

  it.each([
    ["a.b.c", "c"],
    ["items[*].name", "name"],
    ["name", "name"],
  ] as const)("leafKeyOf(%s) === %s", (path, expected) => {
    expect(leafKeyOf(path)).toBe(expected);
  });

  it("returns null when the path ends in a wildcard: an element has an index, not a key", () => {
    expect(leafKeyOf("items[*]")).toBeNull();
    expect(leafKeyOf("matrix[*][*]")).toBeNull();
  });

  it("rejects a malformed path instead of returning null", () => {
    expect(() => parentFieldPath("a..b")).toThrow(PathSyntaxError);
    expect(() => leafKeyOf("a..b")).toThrow(PathSyntaxError);
  });
});
