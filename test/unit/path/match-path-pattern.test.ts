import { formatIssuePath } from "../../../src/path/format-issue-path";
import { matchPathPattern } from "../../../src/path/match-path-pattern";
import { parseFieldPath } from "../../../src/path/parse-field-path";
import { PathSyntaxError } from "../../../src/path/reserved-segment";

describe("matchPathPattern", () => {
  it.each([
    ["items[*].name", "items[0].name"],
    ["items[*].name", "items[42].name"],
    ["matrix[*][*]", "matrix[0][2]"],
    ["tags[*]", "tags[7]"],
    ["user.address.street", "user.address.street"],
    ["orders[*].items[*].productId", "orders[1].items[4].productId"],
    ["departments[*].teams[*]", "departments[2].teams[0]"],
  ] as const)("%s matches %s", (pattern, concrete) => {
    expect(matchPathPattern(pattern, concrete)).toBe(true);
  });

  it.each([
    ["items[*].name", "items[0].other"],
    ["items[*].name", "items.name"],
    ["items[*].name", "items[0].name.deep"],
    ["items[*].name", "otheritems[0].name"],
    ["matrix[*][*]", "matrix[0]"],
    ["matrix[*]", "matrix[0][2]"],
    ["tags[*]", "tags[]"],
    ["tags[*]", "tags[x]"],
    ["tags[*]", "tags[-1]"],
    ["user.address", "user.address.street"],
    ["user.address.street", "user.address"],
    ["a", "ab"],
    ["a.b", "ab.b"],
  ] as const)("%s does not match %s", (pattern, concrete) => {
    expect(matchPathPattern(pattern, concrete)).toBe(false);
  });

  it("refuses to match a declaration path against itself", () => {
    // The grammars are disjoint on purpose: a wildcard is never an issue path.
    expect(matchPathPattern("items[*].name", "items[*].name")).toBe(false);
  });

  it("closes the round trip with formatIssuePath for every wildcard shape", () => {
    for (const pattern of [
      "items[*].name",
      "matrix[*][*]",
      "tags[*]",
      "orders[*].items[*].productId",
    ]) {
      const template = parseFieldPath(pattern);
      const rendered = formatIssuePath(template, [0, 1]);
      expect(matchPathPattern(pattern, rendered)).toBe(true);
    }
  });

  it("throws on a malformed pattern instead of quietly matching nothing", () => {
    expect(() => matchPathPattern("", "a")).toThrow(PathSyntaxError);
    expect(() => matchPathPattern("a..b", "a.b")).toThrow(PathSyntaxError);
  });

  it("__proto__ を含むパターンは受け付ける（名前での拒否はやめた）", () => {
    expect(matchPathPattern("__proto__", "__proto__")).toBe(true);
  });

  it("treats a regex metacharacter in a key as a literal", () => {
    // The legacy matcher built a RegExp by string replacement, so a key like
    // "a+b" changed the meaning of the pattern.
    expect(matchPathPattern("a+b", "a+b")).toBe(true);
    expect(matchPathPattern("a+b", "aab")).toBe(false);
    expect(matchPathPattern("x(y", "x(y")).toBe(true);
  });
});
