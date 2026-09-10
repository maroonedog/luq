// ===========================================================================
// test/integration/reentrancy.test.ts
//
// A built validator must give the same answer however many times it is used,
// nested inside itself included.
//
// JavaScript is single-threaded, so a validation is never switched away from
// mid-run. The one way two validations can be alive at once is **re-entry**:
// calling a validator from inside a rule. What breaks then is mutable state
// held at module scope — a previous major did exactly that, keeping a message
// in a mutable closure variable, so validating a second value reported the
// first value's message.
//
// This implementation deliberately lifts state OUT of the inner loops for
// speed: one element context per array node with only the item rewritten, a
// mutable index stack carrying the current position, a recursion runner built
// only when the plan can recurse. Every one of those is supposed to stay
// inside the call. This file pins that by running it rather than asserting it.
// Lift one of them one level too far — to module scope — and the re-entry
// tests below fail.
//
// Worth recording what was rejected: reusing one rule context per node is
// exactly that mutable module-scope singleton, and it measured slower anyway.
// If it is ever revisited, this file is the gate.
// ===========================================================================
import { Builder } from "../../src/index";
import { requiredPlugin } from "../../src/plugins/required";
import { stringMinPlugin } from "../../src/plugins/string-min";
import { stringPatternPlugin } from "../../src/plugins/string-pattern";
import { numberMinPlugin } from "../../src/plugins/number-min";
import { arrayMinLengthPlugin } from "../../src/plugins/array-min-length";
import { customPlugin } from "../../src/plugins/custom";
import { addAsyncSupport, createAsyncContext } from "../../src/async";
import type { ValidationIssue } from "../../src/types";

interface Line {
  readonly sku: string;
  readonly label: string;
}

interface Order {
  readonly lines: readonly Line[];
}

function buildOrderValidator() {
  return Builder()
    .use(requiredPlugin)
    .use(stringMinPlugin)
    .use(stringPatternPlugin)
    .use(arrayMinLengthPlugin)
    .for<Order>()
    .v("lines", (field) => field.array.required().minLength(1))
    .v("lines[*].sku", (field) => field.string.required().pattern(/^SKU-\d+$/))
    .v("lines[*].label", (field) => field.string.required().min(3))
    .build();
}

function order(...skus: readonly string[]): Order {
  return {
    lines: skus.map((sku) => ({ sku, label: `label for ${sku}` })),
  };
}

function paths(issues: readonly ValidationIssue[]): readonly string[] {
  return issues.map((issue) => issue.path);
}

describe("a built validator carries nothing between calls", () => {
  it("gives the same answer to the same value, ten times running", () => {
    const validator = buildOrderValidator();
    const value = order("SKU-1", "SKU-2", "SKU-3");
    const first = validator.validate(value);
    for (let run = 0; run < 10; run += 1) {
      const again = validator.validate(value);
      expect(again.valid).toBe(first.valid);
      expect(paths(again.issues)).toEqual(paths(first.issues));
    }
  });

  it("does not let a rejected run colour the accepted run after it", () => {
    const validator = buildOrderValidator();
    const good = order("SKU-1", "SKU-2");
    const bad = order("SKU-1", "nope", "SKU-3");
    for (let run = 0; run < 5; run += 1) {
      expect(validator.validate(good).valid).toBe(true);
      const rejected = validator.validate(bad);
      expect(rejected.valid).toBe(false);
      expect(paths(rejected.issues)).toEqual(["lines[1].sku"]);
      expect(validator.validate(good).valid).toBe(true);
    }
  });

  // One element context per node with only the item rewritten, so running
  // arrays of different lengths back to back shifts the indices if the
  // previous length is still there.
  it("renders the right index when the array length changes between calls", () => {
    const validator = buildOrderValidator();
    const long = order("SKU-1", "SKU-2", "SKU-3", "SKU-4", "bad");
    const short = order("bad");
    expect(paths(validator.validate(long).issues)).toEqual(["lines[4].sku"]);
    expect(paths(validator.validate(short).issues)).toEqual(["lines[0].sku"]);
    expect(paths(validator.validate(long).issues)).toEqual(["lines[4].sku"]);
  });

  it("reports every element that fails, with abortEarly off, twice running", () => {
    const validator = buildOrderValidator();
    const bad = order("no", "SKU-1", "also-no");
    const options = { abortEarly: false, abortEarlyOnEachField: false };
    const expected = ["lines[0].sku", "lines[2].sku"];
    expect(paths(validator.validate(bad, options).issues)).toEqual(expected);
    expect(paths(validator.validate(bad, options).issues)).toEqual(expected);
  });

  // The same validator called alternately with different options. The abort
  // policy belongs to the sink, and a sink is made per call — lift it too far
  // and this fails.
  it("keeps abortEarly per call, not per validator", () => {
    const validator = buildOrderValidator();
    const bad = order("no", "SKU-1", "also-no");
    expect(validator.validate(bad).issues).toHaveLength(1);
    expect(
      validator.validate(bad, {
        abortEarly: false,
        abortEarlyOnEachField: false,
      }).issues
    ).toHaveLength(2);
    expect(validator.validate(bad).issues).toHaveLength(1);
  });

  it("hands back a result whose issues survive a later run", () => {
    const validator = buildOrderValidator();
    const bad = order("nope");
    const held = validator.validate(bad);
    expect(held.valid).toBe(false);
    validator.validate(order("SKU-9"));
    validator.validate(order("SKU-1", "SKU-2", "bad"));
    // A held result is untouched by later runs: path and message are as they
    // were when it was taken, with nothing from the two runs in between.
    expect(paths(held.issues)).toEqual(["lines[0].sku"]);
    expect(held.issues[0]?.message).toBe("Invalid format");
    expect(held.issues).toHaveLength(1);
  });
});

describe("a validator called from inside its own rule", () => {
  // The one way two validations are alive at once on a single thread. The
  // outer one is partway through an array element, with its index on the
  // stack, when the inner one runs and pushes and pops a stack of its own. If
  // the outer one's emitted path is affected, state has leaked out of the call.
  interface Node {
    readonly items: readonly { readonly name: string }[];
  }

  const inner = Builder()
    .use(requiredPlugin)
    .use(numberMinPlugin)
    .for<{ readonly depth: number }>()
    .v("depth", (field) => field.number.required().min(1))
    .build();

  const seenInside: string[] = [];

  const outer = Builder()
    .use(requiredPlugin)
    .use(customPlugin)
    .for<Node>()
    .v("items[*].name", (field) =>
      field.string.required().custom((value) => {
        // Runs an entire second validation partway through the first.
        const nested = inner.validate({ depth: 0 });
        seenInside.push(nested.issues[0]?.path ?? "(none)");
        return typeof value === "string" && value.startsWith("ok");
      })
    )
    .build();

  beforeEach(() => {
    seenInside.length = 0;
  });

  it("still renders the OUTER element index after the inner run finishes", () => {
    const result = outer.validate({
      items: [{ name: "ok-1" }, { name: "ok-2" }, { name: "bad" }],
    });
    expect(result.valid).toBe(false);
    expect(paths(result.issues)).toEqual(["items[2].name"]);
  });

  it("gives the inner run its own path, unprefixed by the outer position", () => {
    outer.validate({ items: [{ name: "ok-1" }, { name: "ok-2" }] });
    // The inner one reports a path relative to its own root. The outer one
    // having an index open does not prefix it.
    expect(seenInside).toEqual(["depth", "depth"]);
  });

  it("survives the re-entrant call happening on every element, repeatedly", () => {
    const value = {
      items: [{ name: "ok-1" }, { name: "bad" }, { name: "ok-3" }],
    };
    for (let run = 0; run < 5; run += 1) {
      expect(paths(outer.validate(value).issues)).toEqual(["items[1].name"]);
    }
    // The default abortEarly stops the plan, so the third element is never
    // reached. What is being watched is that the count is exactly the same
    // every time: leftover state shifts either the count or the position.
    expect(seenInside).toHaveLength(10);
  });

  it("runs every element, and re-enters on every one, with abortEarly off", () => {
    const value = {
      items: [{ name: "bad-1" }, { name: "ok" }, { name: "bad-3" }],
    };
    const options = { abortEarly: false, abortEarlyOnEachField: false };
    for (let run = 0; run < 3; run += 1) {
      expect(paths(outer.validate(value, options).issues)).toEqual([
        "items[0].name",
        "items[2].name",
      ]);
    }
    expect(seenInside).toHaveLength(9);
  });
});

// ===========================================================================
describe("one built validator, many concurrent callers", () => {
  // How a server uses it: one built validator at module scope, called per
  // request. A synchronous validate() cannot be interrupted on the event loop,
  // so the only place concurrency can interleave is the await in the async
  // entry point — and that is one await followed by the ordinary synchronous
  // engine, which never yields inside itself.
  //
  // This pins that claim by running it: several validations at once, with
  // external contexts that resolve at different speeds, checking that each
  // gets the answer for its own value **even when the resolutions land out of
  // order**. State held across calls would mix a path or a verdict here.
  const validator = buildOrderValidator();

  function delayed<T>(value: T, ms: number): Promise<T> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(value), ms);
    });
  }

  it("keeps every concurrent async validation to its own value", async () => {
    const bound = addAsyncSupport(validator);
    const cases = [
      {
        value: order("SKU-1", "SKU-2", "bad-a"),
        expected: ["lines[2].sku"],
        ms: 12,
      },
      { value: order("bad-b"), expected: ["lines[0].sku"], ms: 1 },
      { value: order("SKU-3", "SKU-4"), expected: [], ms: 7 },
      {
        value: order("SKU-5", "bad-c", "SKU-6"),
        expected: ["lines[1].sku"],
        ms: 3,
      },
      { value: order("SKU-7"), expected: [], ms: 9 },
    ];
    const results = await Promise.all(
      cases.map(async (one) => {
        const context = await createAsyncContext()
          .set("tenant", delayed("acme", one.ms))
          .build();
        return bound.withAsyncContext(context).validate(one.value);
      })
    );
    results.forEach((result, index) => {
      expect(paths(result.issues)).toEqual(cases[index]?.expected);
    });
  });

  // The same again, arranged so the resolution order is the reverse of the
  // start order.
  it("holds when the async contexts resolve in reverse order", async () => {
    const bound = addAsyncSupport(validator);
    const values = [
      order("bad-0"),
      order("SKU-1", "bad-1"),
      order("SKU-1", "SKU-2", "bad-2"),
      order("SKU-1", "SKU-2", "SKU-3", "bad-3"),
    ];
    const results = await Promise.all(
      values.map(async (value, index) => {
        const context = await createAsyncContext()
          .set("tenant", delayed("acme", (values.length - index) * 4))
          .build();
        return bound.withAsyncContext(context).validate(value);
      })
    );
    results.forEach((result, index) => {
      expect(paths(result.issues)).toEqual([`lines[${index}].sku`]);
    });
  });

  it("gives the same answers whether the callers are sequential or concurrent", async () => {
    const bound = addAsyncSupport(validator);
    const values = [
      order("SKU-1", "bad"),
      order("SKU-2"),
      order("bad", "SKU-3"),
    ];
    const context = await createAsyncContext()
      .set("tenant", delayed("acme", 1))
      .build();
    const sequential = [];
    for (const value of values) {
      sequential.push(paths(validator.validate(value).issues));
    }
    const concurrent = await Promise.all(
      values.map(async (value) =>
        paths((await bound.withAsyncContext(context).validate(value)).issues)
      )
    );
    expect(concurrent).toEqual(sequential);
  });
});
