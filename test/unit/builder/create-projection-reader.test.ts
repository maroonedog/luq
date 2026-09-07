import { createProjectionReader } from "../../../src/builder/create-projection-reader";
import { PathSyntaxError } from "../../../src/path/reserved-segment";

describe("createProjectionReader", () => {
  it("reads a plain nested path", () => {
    const read = createProjectionReader("user.name");
    expect(read({ user: { name: "Ada" } })).toBe("Ada");
    expect(read({ user: {} })).toBeUndefined();
    expect(read({})).toBeUndefined();
  });

  it("maps one wildcard over the elements", () => {
    const read = createProjectionReader("employees[*].name");
    expect(read({ employees: [{ name: "Ada" }, { name: "Bob" }] })).toEqual([
      "Ada",
      "Bob",
    ]);
    expect(read({ employees: [] })).toEqual([]);
  });

  it("maps nested wildcards, keeping the shape", () => {
    const read = createProjectionReader("grid[*][*]");
    expect(
      read({
        grid: [
          [1, 2],
          [3, 4],
        ],
      })
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("answers undefined, not [], when there is no array at a wildcard", () => {
    const read = createProjectionReader("employees[*].name");
    expect(read({ employees: "not an array" })).toBeUndefined();
    expect(read({})).toBeUndefined();
  });

  it("reads a whole array when the path names no wildcard", () => {
    const read = createProjectionReader("tags");
    expect(read({ tags: ["a", "b"] })).toEqual(["a", "b"]);
  });

  it("reads own properties only", () => {
    const read = createProjectionReader("toString");
    expect(read({})).toBeUndefined();
  });

  it("rejects a malformed path when the reader is BUILT, not when it runs", () => {
    expect(() => createProjectionReader("user..name")).toThrow(PathSyntaxError);
  });
});
