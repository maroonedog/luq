import { formatIssuePath } from "../../../src/path/format-issue-path";
import { parseFieldPath } from "../../../src/path/parse-field-path";

describe("formatIssuePath — [*] is input-only, [n] is output-only", () => {
  it.each([
    ["items[*].name", [0], "items[0].name"],
    ["items[*].name", [3], "items[3].name"],
    ["matrix[*][*]", [0, 2], "matrix[0][2]"],
    ["tags[*]", [7], "tags[7]"],
    ["orders[*].items[*].productId", [1, 4], "orders[1].items[4].productId"],
    ["departments[*].teams[*]", [2, 0], "departments[2].teams[0]"],
    ["user.address.street", [], "user.address.street"],
  ] as const)("%s with %j renders %s", (path, indices, expected) => {
    expect(formatIssuePath(parseFieldPath(path), [...indices])).toBe(expected);
  });

  it("renders the root path as the empty string", () => {
    expect(formatIssuePath([], [])).toBe("");
  });

  it("never emits a wildcard: the rendered path is not a declaration path", () => {
    const rendered = formatIssuePath(parseFieldPath("matrix[*][*]"), [0, 1]);
    expect(rendered).not.toContain("[*]");
  });

  it("consumes indices outermost-first, in the order the stack pushes them", () => {
    expect(formatIssuePath(parseFieldPath("a[*].b[*]"), [1, 2])).toBe(
      "a[1].b[2]"
    );
    expect(formatIssuePath(parseFieldPath("a[*].b[*]"), [2, 1])).toBe(
      "a[2].b[1]"
    );
  });

  it("throws rather than rendering a [*] when indices are missing", () => {
    expect(() => formatIssuePath(parseFieldPath("items[*].name"), [])).toThrow(
      RangeError
    );
    expect(() => formatIssuePath(parseFieldPath("matrix[*][*]"), [0])).toThrow(
      /needs 2 index/
    );
  });

  it("ignores surplus indices belonging to array nodes above the template", () => {
    expect(formatIssuePath(parseFieldPath("items[*]"), [0, 5, 9])).toBe(
      "items[0]"
    );
  });
});
