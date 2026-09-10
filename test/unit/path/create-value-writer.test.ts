import { createValueWriter } from "../../../src/path/create-value-writer";
import { parseFieldPath } from "../../../src/path/parse-field-path";

function writerFor(
  path: string
): (subject: unknown, value: unknown) => unknown {
  return createValueWriter(parseFieldPath(path));
}

describe("createValueWriter — copy on write", () => {
  it("returns a NEW root and leaves the input untouched", () => {
    const before = { a: { b: 1 }, other: { keep: true } };
    const snapshot = JSON.parse(JSON.stringify(before));
    const after = writerFor("a.b")(before, 2);

    expect(after).not.toBe(before);
    expect(before).toEqual(snapshot);
    expect(after).toEqual({ a: { b: 2 }, other: { keep: true } });
  });

  it("copies only the written spine: untouched siblings keep identity", () => {
    const sibling = { keep: true };
    const before = { a: { b: 1 }, other: sibling };
    const after = writerFor("a.b")(before, 2);

    expect(after).not.toBe(before);
    expect((after as { other: unknown }).other).toBe(sibling);
    expect((after as { a: unknown }).a).not.toBe(before.a);
  });

  it("keeps deep siblings of the written key", () => {
    const deepSibling = { untouched: 1 };
    const before = { a: { b: 1, sib: deepSibling } };
    const after = writerFor("a.b")(before, 2) as { a: { sib: unknown } };
    expect(after.a.sib).toBe(deepSibling);
  });

  it("writes a single-segment path", () => {
    const before = { a: 1 };
    expect(writerFor("a")(before, 9)).toEqual({ a: 9 });
    expect(before.a).toBe(1);
  });

  it("replaces the subject entirely for an empty template", () => {
    expect(createValueWriter([])({ a: 1 }, "replaced")).toBe("replaced");
  });

  it("returns the root by identity when the value is unchanged", () => {
    const before = { a: { b: 1 } };
    expect(writerFor("a.b")(before, 1)).toBe(before);
  });
});

describe("createValueWriter — arrays", () => {
  it("copies the array rather than mutating it, and stays an array", () => {
    const items = [{ n: 1 }, { n: 2 }];
    const before = { items };
    const after = writerFor("items.0.n")(before, 99) as {
      items: { n: number }[];
    };

    expect(items[0]?.n).toBe(1);
    expect(after.items).not.toBe(items);
    expect(Array.isArray(after.items)).toBe(true);
    expect(after.items[0]?.n).toBe(99);
    expect(after.items[1]).toBe(items[1]);
  });

  it("refuses a non-index key on an array instead of turning it into an object", () => {
    const before = { items: [1, 2] };
    const after = writerFor("items.name")(before, "x");
    expect(after).toBe(before);
    expect(Array.isArray((before as { items: unknown }).items)).toBe(true);
  });
});

describe("createValueWriter — vivification", () => {
  it("creates missing intermediates", () => {
    expect(writerFor("a.b.c")({}, 1)).toEqual({ a: { b: { c: 1 } } });
  });

  it("creates through a null intermediate", () => {
    expect(writerFor("a.b")({ a: null }, 1)).toEqual({ a: { b: 1 } });
  });

  it("NEVER overwrites a present falsy intermediate", () => {
    // The legacy `if (!obj[k]) obj[k] = {}` destroyed 0 / "" / false here.
    for (const kept of [0, "", false]) {
      const before = { a: kept };
      const after = writerFor("a.b")(before, 1);
      expect(after).toBe(before);
      expect(before.a).toBe(kept);
    }
  });

  it("leaves a primitive root alone instead of conjuring an object", () => {
    expect(writerFor("a.b")(7, 1)).toBe(7);
  });

  it("vivifies a plain object, never an array, for a numeric segment", () => {
    const after = writerFor("a.0")({}, "x") as { a: unknown };
    expect(Array.isArray(after.a)).toBe(false);
    expect(after.a).toEqual({ "0": "x" });
  });
});

describe("createValueWriter — prototype safety", () => {
  it("writes through a path containing __proto__; prototype-pollution.test.ts covers the safety", () => {
    expect(() => writerFor("__proto__.polluted")).not.toThrow();
    expect(() =>
      createValueWriter([{ kind: "key", key: "constructor" }])
    ).not.toThrow();
  });

  it("cannot pollute Object.prototype through any accepted path", () => {
    const writer = writerFor("a.b");
    writer({}, "value");
    const probe: Record<string, unknown> = {};
    expect(probe.polluted).toBeUndefined();
    expect(probe.b).toBeUndefined();
  });

  it("refuses a wildcard template: an element write goes through the runner", () => {
    expect(() => writerFor("items[*].name")).toThrow(/wildcard segment/);
  });
});
