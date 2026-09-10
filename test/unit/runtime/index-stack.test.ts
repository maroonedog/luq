// ===========================================================================
// The index stack is the only source of a concrete array index.
//
// The legacy defect it exists to kill: `items[*].name` reaching a user as an
// issue path. Every assertion here is on the RENDERED path, not on internal
// state — a stack that holds the right numbers but composes them in the wrong
// order would still emit `grid[2][0]` and pass a state-only assertion.
// ===========================================================================
import { IndexStack, joinIssuePath } from "../../../src/runtime/index-stack";

const NAME = "name";
/** A declaration naming the element itself has no path of its own. */
const ELEMENT_ITSELF = "";

describe("IndexStack renders a concrete issue path", () => {
  it("is at the root before anything is pushed", () => {
    const stack = new IndexStack();
    expect(stack.depth).toBe(0);
    expect(stack.prefix).toBe("");
    expect(stack.indices).toEqual([]);
    expect(stack.renderFieldPath(NAME)).toBe("name");
  });

  it("renders items[0].name for an element field of items[*]", () => {
    const stack = new IndexStack();
    stack.push("items", 0);
    expect(stack.prefix).toBe("items[0]");
    expect(stack.renderFieldPath(NAME)).toBe("items[0].name");
  });

  it("renders grid[0][2] for an inner array with no key of its own", () => {
    const stack = new IndexStack();
    stack.push("grid", 0);
    stack.push("", 2);
    expect(stack.depth).toBe(2);
    expect(stack.indices).toEqual([0, 2]);
    expect(stack.renderFieldPath(ELEMENT_ITSELF)).toBe("grid[0][2]");
  });

  it("renders data[1].nested.inner across two levels of keys", () => {
    const stack = new IndexStack();
    stack.push("data", 1);
    expect(stack.renderFieldPath("nested.inner")).toBe("data[1].nested.inner");
  });

  it("carries the outer index into a nested array node", () => {
    const stack = new IndexStack();
    stack.push("items", 0);
    stack.push("tags", 2);
    expect(stack.renderFieldPath(ELEMENT_ITSELF)).toBe("items[0].tags[2]");
    expect(stack.renderFieldPath("label")).toBe("items[0].tags[2].label");
  });

  it("pops back to the enclosing level", () => {
    const stack = new IndexStack();
    stack.push("a", 3);
    stack.push("b", 7);
    stack.pop();
    expect(stack.indices).toEqual([3]);
    stack.push("b", 8);
    expect(stack.renderFieldPath(ELEMENT_ITSELF)).toBe("a[3].b[8]");
    stack.pop();
    stack.pop();
    expect(stack.renderFieldPath(NAME)).toBe("name");
  });

  it("reuses one index buffer instead of allocating per element", () => {
    const stack = new IndexStack();
    stack.push("items", 0);
    const first = stack.indices;
    stack.pop();
    stack.push("items", 1);
    expect(stack.indices).toBe(first);
    expect(stack.prefix).toBe("items[1]");
  });
});

describe("IndexStack refuses a location no declaration could produce", () => {
  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects the index %p",
    (index) => {
      expect(() => new IndexStack().push("items", index)).toThrow(RangeError);
    }
  );

  it("names the offending index", () => {
    expect(() => new IndexStack().push("items", -1)).toThrow(/received -1/);
  });

  it("rejects an unbalanced pop", () => {
    const stack = new IndexStack();
    expect(() => stack.pop()).toThrow(RangeError);
    stack.push("items", 0);
    stack.pop();
    expect(() => stack.pop()).toThrow(/never pushed/);
  });

  // Refusing a template that still holds a wildcard is a COMPILE-TIME job,
  // not this one: a field's own path is rendered once, and a template that
  // cannot be rendered fails there. What remains at validation time is one
  // concatenation with the prefix, which has nothing left to fail on.
  it("joins a rendered field path onto the open prefix, and nothing more", () => {
    const stack = new IndexStack();
    stack.push("items", 0);
    expect(stack.renderFieldPath("name")).toBe("items[0].name");
  });
});

describe("joinIssuePath keeps the root path free of a separator", () => {
  it.each([
    ["", "name", "name"],
    ["items[0]", "", "items[0]"],
    ["items[0]", "name", "items[0].name"],
    ["", "", ""],
  ])("joins %p and %p into %p", (prefix, own, expected) => {
    expect(joinIssuePath(prefix, own)).toBe(expected);
  });
});
