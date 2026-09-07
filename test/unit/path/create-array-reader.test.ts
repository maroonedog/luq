import { createArrayReader } from "../../../src/path/create-array-reader";
import { parseFieldPath } from "../../../src/path/parse-field-path";

function arrayReaderFor(
  path: string
): (subject: unknown) => readonly unknown[] | null {
  return createArrayReader(parseFieldPath(path));
}

describe("createArrayReader", () => {
  const read = arrayReaderFor("items");

  it("returns the array by identity, without copying", () => {
    const items = [1, 2, 3];
    expect(read({ items })).toBe(items);
  });

  it("distinguishes an EMPTY array from no array at all", () => {
    // [] means "the element rules run zero times"; null means "there is no
    // array here". Collapsing the two is how the legacy tree lost the
    // difference between an empty list and a type error on the container.
    expect(read({ items: [] })).toEqual([]);
    expect(read({ items: [] })).not.toBeNull();
    expect(read({})).toBeNull();
  });

  it("returns null for a non-array value: element rules are vacuous", () => {
    expect(read({ items: "oops" })).toBeNull();
    expect(read({ items: 0 })).toBeNull();
    expect(read({ items: null })).toBeNull();
    expect(read({ items: { length: 2 } })).toBeNull();
  });

  it("returns null for a missing or primitive intermediate", () => {
    const nested = arrayReaderFor("a.items");
    expect(nested({})).toBeNull();
    expect(nested({ a: null })).toBeNull();
    expect(nested({ a: "s" })).toBeNull();
    expect(nested({ a: { items: [9] } })).toEqual([9]);
  });

  it("returns null for a null root instead of throwing", () => {
    expect(read(null)).toBeNull();
    expect(read(undefined)).toBeNull();
  });

  it("does not read an inherited array", () => {
    const poisoned = Object.create({ items: [1] }) as Record<string, unknown>;
    expect(read(poisoned)).toBeNull();
  });
});
