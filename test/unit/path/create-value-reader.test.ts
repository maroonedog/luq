import { createValueReader } from "../../../src/path/create-value-reader";
import { parseFieldPath } from "../../../src/path/parse-field-path";
import { PathSyntaxError } from "../../../src/path/reserved-segment";

function readerFor(path: string): (subject: unknown) => unknown {
  return createValueReader(parseFieldPath(path));
}

describe("createValueReader — resolution", () => {
  it("reads a single key", () => {
    expect(readerFor("name")({ name: "ada" })).toBe("ada");
  });

  it("reads a nested key", () => {
    expect(
      readerFor("user.address.street")({ user: { address: { street: "s" } } })
    ).toBe("s");
  });

  it("is the identity reader for an empty template (the element of items[*])", () => {
    const subject = { any: "thing" };
    expect(createValueReader([])(subject)).toBe(subject);
  });
});

describe("createValueReader — boundaries", () => {
  const read = readerFor("a.b");

  it("missing key resolves to undefined and never throws", () => {
    expect(read({})).toBeUndefined();
    expect(read({ a: {} })).toBeUndefined();
  });

  it("an own key set to undefined resolves to undefined", () => {
    expect(read({ a: { b: undefined } })).toBeUndefined();
  });

  it("a null intermediate resolves to undefined", () => {
    expect(read({ a: null })).toBeUndefined();
  });

  it("a primitive intermediate does NOT descend", () => {
    // The legacy accessor answered "John".length === 4 here.
    expect(
      readerFor("user.name.length")({ user: { name: "John" } })
    ).toBeUndefined();
    expect(read({ a: 0 })).toBeUndefined();
    expect(read({ a: "s" })).toBeUndefined();
  });

  it("a null or primitive ROOT resolves to undefined instead of throwing", () => {
    expect(read(null)).toBeUndefined();
    expect(read(undefined)).toBeUndefined();
    expect(read(7)).toBeUndefined();
  });

  it("never implicitly maps an array: a dotted segment on an array is undefined", () => {
    const users = [{ name: "a" }, { name: "b" }];
    expect(readerFor("users.name")({ users })).toBeUndefined();
    expect(readerFor("users")({ users })).toBe(users);
  });

  it("returns the array itself for a dotted path that lands on one", () => {
    const tags = ["x"];
    expect(readerFor("tags")({ tags })).toBe(tags);
  });

  it("an array hole is absent, not a stored undefined", () => {
    const sparse: unknown[] = [];
    sparse[1] = "present";
    expect(readerFor("list.0")({ list: sparse })).toBeUndefined();
    expect(readerFor("list.1")({ list: sparse })).toBe("present");
  });

  it("reads OWN properties only: an inherited member is not a field", () => {
    expect(readerFor("toString")({})).toBeUndefined();
    expect(readerFor("hasOwnProperty")({})).toBeUndefined();
    const base = { inherited: "no" };
    const derived: Record<string, unknown> = Object.create(base);
    derived.own = "yes";
    expect(readerFor("own")(derived)).toBe("yes");
    expect(readerFor("inherited")(derived)).toBeUndefined();
  });

  it("does not read through a poisoned prototype", () => {
    const poisoned = Object.create({ leaked: "secret" }) as Record<
      string,
      unknown
    >;
    expect(readerFor("leaked")(poisoned)).toBeUndefined();
  });
});

describe("createValueReader — template validation is a BUILD-time gate", () => {
  it("refuses a wildcard template: one reader cannot return many values", () => {
    expect(() => createValueReader(parseFieldPath("items[*].name"))).toThrow(
      PathSyntaxError
    );
    expect(() => createValueReader(parseFieldPath("items[*]"))).toThrow(
      /wildcard segment/
    );
  });

  it("refuses a hand-built template carrying a reserved key", () => {
    expect(() =>
      createValueReader([
        { kind: "key", key: "a" },
        { kind: "key", key: "__proto__" },
      ])
    ).toThrow(PathSyntaxError);
  });
});
