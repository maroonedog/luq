import { splitIssuePath } from "../../../src/standard-schema/split-issue-path";

describe("splitIssuePath", () => {
  it("gives the root the empty list", () => {
    // The spec reads the empty list as an issue on the root itself.
    expect(splitIssuePath("")).toEqual([]);
  });

  it("opens a single key", () => {
    expect(splitIssuePath("name")).toEqual(["name"]);
  });

  it("opens nested keys", () => {
    expect(splitIssuePath("user.address.street")).toEqual([
      "user",
      "address",
      "street",
    ]);
  });

  it("makes an array index a number", () => {
    expect(splitIssuePath("items[1]")).toEqual(["items", 1]);
  });

  it("opens a field of an array element", () => {
    expect(splitIssuePath("items[1].productId")).toEqual([
      "items",
      1,
      "productId",
    ]);
  });

  it("opens indices at several levels", () => {
    expect(splitIssuePath("matrix[0][2]")).toEqual(["matrix", 0, 2]);
  });

  it("opens deep nesting mixed with indices", () => {
    expect(splitIssuePath("orders[3].items[0].sku")).toEqual([
      "orders",
      3,
      "items",
      0,
      "sku",
    ]);
  });

  it("emits an index as a number and not as a string", () => {
    const segments = splitIssuePath("items[10].name");
    expect(typeof segments[1]).toBe("number");
    expect(segments[1]).toBe(10);
  });

  it("opens an index of two digits or more", () => {
    expect(splitIssuePath("items[123]")).toEqual(["items", 123]);
  });

  describe("a shape it cannot interpret comes back whole, in one segment", () => {
    // Handing over something visibly unopened beats dropping the issue.
    it.each([
      ["a leading dot", ".name"],
      ["a trailing dot", "name."],
      ["two dots in a row", "a..b"],
      ["an unclosed bracket", "items[1"],
      ["a non-numeric index", "items[x]"],
      ["an empty index", "items[]"],
      ["a declaration wildcard", "items[*].name"],
    ])("%s", (_label, path) => {
      expect(splitIssuePath(path)).toEqual([path]);
    });
  });

  it("does not misread a declaration's [*] as 0", () => {
    // Handling both grammars in one function is how this slips in quietly.
    expect(splitIssuePath("items[*].name")).not.toEqual(["items", 0, "name"]);
  });
});
