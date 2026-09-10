// ===========================================================================
// The lazily built rule context.
//
// Three things: **when** it is assembled, **how many times**, and **what stops
// being visible**.
//
// The third matters because this implements a public type. RuleContext is an
// interface and promises only property access, but `path` no longer being an
// own property is an observable difference, and not one to hold quietly. What
// is written here is everything this shape gives up.
// ===========================================================================
import { FieldRuleContext } from "../../../src/runtime/field-rule-context";
import { IndexStack } from "../../../src/runtime/index-stack";

function contextAt(
  stack: IndexStack,
  ownPath: string,
  root: unknown = { lines: [] }
): FieldRuleContext {
  return new FieldRuleContext(root, stack, ownPath, undefined, undefined);
}

describe("the path is built when it is asked for, and not before", () => {
  it("renders nothing until path is read", () => {
    const stack = new IndexStack();
    let renders = 0;
    const counting = new (class extends IndexStack {
      override renderFieldPath(renderedPath: string): string {
        renders += 1;
        return super.renderFieldPath(renderedPath);
      }
    })();
    const context = contextAt(counting, "sku");
    expect(renders).toBe(0);
    expect(context.path).toBe("sku");
    expect(renders).toBe(1);
    void stack;
  });

  it("builds it once, however many times it is read", () => {
    let renders = 0;
    const counting = new (class extends IndexStack {
      override renderFieldPath(renderedPath: string): string {
        renders += 1;
        return super.renderFieldPath(renderedPath);
      }
    })();
    counting.push("lines", 3);
    const context = contextAt(counting, "sku");
    expect(context.path).toBe("lines[3].sku");
    expect(context.path).toBe("lines[3].sku");
    expect(context.path).toBe("lines[3].sku");
    expect(renders).toBe(1);
  });

  // The stack is mutable and pops when an element ends. A path already taken
  // that follows the pop would disagree with the issue that gets emitted.
  it("pins the path it built, even after the stack has moved on", () => {
    const stack = new IndexStack();
    stack.push("lines", 0);
    const context = contextAt(stack, "sku");
    expect(context.path).toBe("lines[0].sku");
    stack.pop();
    stack.push("lines", 7);
    expect(context.path).toBe("lines[0].sku");
  });

  it("reads the stack as it is at the moment of the FIRST read", () => {
    const stack = new IndexStack();
    stack.push("lines", 2);
    const context = contextAt(stack, "sku");
    stack.pop();
    // Never read before the pop, it is assembled at the popped position.
    // That cannot happen while a rule reads it within its own call, but what
    // it answers if it does is decided rather than left open.
    expect(context.path).toBe("sku");
  });

  it("renders the root path as the field's own path, by identity", () => {
    const stack = new IndexStack();
    const context = contextAt(stack, "name");
    expect(context.path).toBe("name");
  });
});

describe("the declared members are ordinary properties", () => {
  it("carries root, item and external as given", () => {
    const stack = new IndexStack();
    const root = { lines: [{ sku: "SKU-1" }] };
    const item = { index: 0, item: root.lines[0], array: root.lines };
    const external = Object.freeze({ tenant: "acme" });
    const context = new FieldRuleContext(root, stack, "sku", item, external);
    expect(context.root).toBe(root);
    expect(context.item).toBe(item);
    expect(context.external).toBe(external);
  });

  it("answers destructuring and `in`, the two ways a rule reads a path", () => {
    const stack = new IndexStack();
    stack.push("lines", 1);
    const context = contextAt(stack, "sku");
    const { path } = context;
    expect(path).toBe("lines[1].sku");
    expect("path" in context).toBe(true);
  });
});

describe("what this shape gives up, stated exactly", () => {
  it("puts path on the prototype, so it is not an own property", () => {
    const stack = new IndexStack();
    const context = contextAt(stack, "sku");
    expect(Object.prototype.hasOwnProperty.call(context, "path")).toBe(false);
    expect(Object.keys(context)).not.toContain("path");
  });

  // Spreading drops path — but **the compiler knows that**: reading path off
  // the spread is an error, so for anyone type-checking their code this
  // difference is not silent. The cast to a Record here exists only to get
  // past that error and look at the run-time shape.
  it("loses path through a spread, which the type system already says", () => {
    const stack = new IndexStack();
    stack.push("lines", 0);
    const context = contextAt(stack, "sku");
    expect(context.path).toBe("lines[0].sku");
    const spread: Record<string, unknown> = { ...context };
    expect(spread["path"]).toBeUndefined();
    expect(spread["root"]).toEqual({ lines: [] });
  });

  // Logging one is a real use, so that shape at least is pinned.
  it("keeps JSON to the four declared members, internals included nowhere", () => {
    const stack = new IndexStack();
    stack.push("lines", 4);
    const context = new FieldRuleContext(
      { lines: [] },
      stack,
      "sku",
      undefined,
      Object.freeze({ tenant: "acme" })
    );
    expect(JSON.parse(JSON.stringify(context))).toEqual({
      root: { lines: [] },
      path: "lines[4].sku",
      external: { tenant: "acme" },
    });
  });
});
