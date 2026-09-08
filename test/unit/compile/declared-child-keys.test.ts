import {
  indexDeclaredChildKeys,
  ROOT_PATH,
} from "../../../src/compile/declared-child-keys";
import { PathSyntaxError } from "../../../src/path/reserved-segment";

describe("indexDeclaredChildKeys", () => {
  it("lists the top-level keys under the root path", () => {
    const childKeysOf = indexDeclaredChildKeys(["name", "age", "email"]);
    expect(childKeysOf(ROOT_PATH)).toEqual(["name", "age", "email"]);
  });

  it("lists the immediate keys of a nested object", () => {
    const childKeysOf = indexDeclaredChildKeys([
      "user.name",
      "user.age",
      "other.flag",
    ]);
    expect(childKeysOf("user")).toEqual(["name", "age"]);
    expect(childKeysOf("other")).toEqual(["flag"]);
  });

  it("derives an ancestor's child key from a deeper path alone", () => {
    const childKeysOf = indexDeclaredChildKeys(["user.profile.name"]);
    expect(childKeysOf(ROOT_PATH)).toEqual(["user"]);
    expect(childKeysOf("user")).toEqual(["profile"]);
    expect(childKeysOf("user.profile")).toEqual(["name"]);
  });

  it("indexes element keys under the WILDCARD path, not under the array", () => {
    const childKeysOf = indexDeclaredChildKeys([
      "items[*].name",
      "items[*].sku",
    ]);
    expect(childKeysOf(ROOT_PATH)).toEqual(["items"]);
    expect(childKeysOf("items")).toEqual([]);
    expect(childKeysOf("items[*]")).toEqual(["name", "sku"]);
  });

  it("handles a two-level wildcard", () => {
    const childKeysOf = indexDeclaredChildKeys(["matrix[*][*].cell"]);
    expect(childKeysOf("matrix[*][*]")).toEqual(["cell"]);
    expect(childKeysOf("matrix[*]")).toEqual([]);
  });

  it("records a repeated key exactly once, first declaration wins", () => {
    const childKeysOf = indexDeclaredChildKeys([
      "user.name",
      "user.age",
      "user.name",
    ]);
    expect(childKeysOf("user")).toEqual(["name", "age"]);
  });

  it("answers with an empty list for a path nobody declared under", () => {
    const childKeysOf = indexDeclaredChildKeys(["user.name"]);
    expect(childKeysOf("nothing.here")).toEqual([]);
  });

  it("derives the keys from the STRINGS only: no value is consulted", () => {
    const childKeysOf = indexDeclaredChildKeys(["user.name"]);
    expect(childKeysOf("user")).toEqual(["name"]);
  });

  it("rejects a malformed path at build time, naming it", () => {
    expect(() => indexDeclaredChildKeys(["user..name"])).toThrow(
      PathSyntaxError
    );
    expect(() => indexDeclaredChildKeys(["user..name"])).toThrow(
      /user\.\.name/
    );
  });

  it("__proto__ を含む宣言も受け付ける", () => {
    expect(() => indexDeclaredChildKeys(["__proto__.polluted"])).not.toThrow(
      PathSyntaxError
    );
  });
});

describe("every declared key list is FROZEN", () => {
  it("a plugin's build() cannot push into the list it was handed", () => {
    const childKeysOf = indexDeclaredChildKeys(["user.name", "user.age"]);
    const declaredSiblingKeys = childKeysOf("user");
    expect(Object.isFrozen(declaredSiblingKeys)).toBe(true);
    expect(() => {
      (declaredSiblingKeys as unknown as string[]).push("smuggled");
    }).toThrow(TypeError);
    expect(childKeysOf("user")).toEqual(["name", "age"]);
  });

  it("the empty answer is frozen too", () => {
    const childKeysOf = indexDeclaredChildKeys(["user.name"]);
    const declaredSiblingKeys = childKeysOf("unknown");
    expect(Object.isFrozen(declaredSiblingKeys)).toBe(true);
    expect(() => {
      (declaredSiblingKeys as unknown as string[]).push("smuggled");
    }).toThrow(TypeError);
  });

  it("two readers built from the same paths do not share a mutable array", () => {
    const first = indexDeclaredChildKeys(["user.name"]);
    const second = indexDeclaredChildKeys(["user.name"]);
    expect(first("user")).not.toBe(second("user"));
    expect(first("user")).toEqual(second("user"));
  });
});
