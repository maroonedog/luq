// ===========================================================================
// Loop interchange, asserted on the GROUPING and not on validation results.
//
// The property that matters is arity: N declarations over one array must
// produce ONE group, because the group is what becomes one array read. A
// grouping that produced N groups would still validate correctly and would
// silently be the legacy "walk the array once per field" cost.
// ===========================================================================
import { formatFieldPath, parseFieldPath } from "../../../../src/path";
import { groupArrayFields } from "../../../../src/compile/group-array-fields";
import type { RelativeDeclaration } from "../../../../src/compile/group-array-fields";
import { makeCheck } from "../rule-fixtures";

function declare(path: string): RelativeDeclaration {
  return {
    template: parseFieldPath(path),
    rules: [makeCheck(path)],
    fieldPath: path,
    defaultOf: null,
    applyDefaultToNull: true,
  };
}

function groupPaths(paths: readonly string[]) {
  return groupArrayFields(paths.map(declare));
}

describe("declarations without a wildcard stay direct", () => {
  it("keeps them in declaration order and makes no group", () => {
    const grouped = groupPaths(["name", "profile.age", "profile.city"]);
    expect(grouped.direct.map((each) => each.fieldPath)).toEqual([
      "name",
      "profile.age",
      "profile.city",
    ]);
    expect(grouped.arrays).toHaveLength(0);
  });

  it("treats the array container itself as a direct field", () => {
    const grouped = groupPaths(["items", "items[*].name"]);
    expect(grouped.direct.map((each) => each.fieldPath)).toEqual(["items"]);
    expect(grouped.arrays).toHaveLength(1);
  });
});

describe("three fields under one prefix become one group", () => {
  const grouped = groupPaths([
    "addresses[*].type",
    "addresses[*].city",
    "addresses[*].zip",
  ]);

  it("produces exactly one array group", () => {
    expect(grouped.arrays).toHaveLength(1);
    expect(grouped.direct).toHaveLength(0);
  });

  it("names the array by the prefix before the wildcard", () => {
    expect(formatFieldPath(grouped.arrays[0]!.template)).toBe("addresses");
  });

  it("re-bases every member on ONE element, in declaration order", () => {
    expect(
      grouped.arrays[0]!.members.map((each) => formatFieldPath(each.template))
    ).toEqual(["type", "city", "zip"]);
  });

  it("carries the declared path through for build-time diagnostics", () => {
    expect(grouped.arrays[0]!.members.map((each) => each.fieldPath)).toEqual([
      "addresses[*].type",
      "addresses[*].city",
      "addresses[*].zip",
    ]);
  });
});

describe("only ONE level is split here", () => {
  it("leaves the inner wildcard on the member of items[*].sub[*].x", () => {
    const grouped = groupPaths(["items[*].sub[*].x"]);
    expect(formatFieldPath(grouped.arrays[0]!.template)).toBe("items");
    expect(formatFieldPath(grouped.arrays[0]!.members[0]!.template)).toBe(
      "sub[*].x"
    );
  });

  it("leaves matrix[*][*] as a bare wildcard member of matrix", () => {
    const grouped = groupPaths(["matrix[*][*]"]);
    expect(formatFieldPath(grouped.arrays[0]!.template)).toBe("matrix");
    expect(formatFieldPath(grouped.arrays[0]!.members[0]!.template)).toBe(
      "[*]"
    );
  });

  it("re-bases items[*] onto the element itself, an EMPTY template", () => {
    const grouped = groupPaths(["items[*]"]);
    expect(grouped.arrays[0]!.members[0]!.template).toEqual([]);
  });
});

describe("group identity and order", () => {
  it("separates two different arrays and keeps first-declaration order", () => {
    const grouped = groupPaths([
      "tags[*].label",
      "authors[*].name",
      "tags[*].colour",
    ]);
    expect(
      grouped.arrays.map((each) => formatFieldPath(each.template))
    ).toEqual(["tags", "authors"]);
    expect(grouped.arrays[0]!.members).toHaveLength(2);
    expect(grouped.arrays[1]!.members).toHaveLength(1);
  });

  it("does not merge arrays that merely share a leading key", () => {
    const grouped = groupPaths(["a.b[*].x", "a.c[*].x"]);
    expect(
      grouped.arrays.map((each) => formatFieldPath(each.template))
    ).toEqual(["a.b", "a.c"]);
  });

  it("groups siblings reached through the SAME nested prefix", () => {
    const grouped = groupPaths(["a.b[*].x", "a.b[*].y"]);
    expect(grouped.arrays).toHaveLength(1);
    expect(grouped.arrays[0]!.members).toHaveLength(2);
  });
});

describe("the grouping is frozen", () => {
  const grouped = groupPaths(["items[*].name", "top"]);

  it("refuses a push into direct, arrays or members", () => {
    expect(Object.isFrozen(grouped.direct)).toBe(true);
    expect(Object.isFrozen(grouped.arrays)).toBe(true);
    expect(Object.isFrozen(grouped.arrays[0]!.members)).toBe(true);
    expect(() => {
      (grouped.direct as RelativeDeclaration[]).push(declare("injected"));
    }).toThrow(TypeError);
    expect(() => {
      (grouped.arrays[0]!.members as RelativeDeclaration[]).push(
        declare("injected")
      );
    }).toThrow(TypeError);
  });

  it("rejects an empty input without inventing a group", () => {
    const empty = groupArrayFields([]);
    expect(empty.direct).toEqual([]);
    expect(empty.arrays).toEqual([]);
  });
});
