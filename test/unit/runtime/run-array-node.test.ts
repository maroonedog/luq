// ===========================================================================
// The loop interchange, executed. Two things are proved here and nowhere else:
// the array is READ ONCE per node however many element fields there are, and
// the index stack renders a concrete path for every depth.
// ===========================================================================
import { fail } from "../../../src/types";
import type { ArrayItemContext } from "../../../src/types";
import { runArrayNodes } from "../../../src/runtime/run-array-node";
import { runPlan } from "../../../src/runtime/run-plan";
import {
  NO_WRITE_TARGETS,
  createArrayWriteTargets,
} from "../../../src/runtime/output-writer";
import { makeTransform, requiredRule } from "../compile/rule-fixtures";
import { makeDetailedCheck } from "./runtime-fixtures";
import {
  harnessFor,
  issuePathsOf,
  withCountedRead,
} from "./plan/engine-fixtures";

const failing = (code: string) =>
  makeDetailedCheck({ code, run: () => fail({}) });

describe("one array, read once", () => {
  it("reads the array ONCE however many element fields the node carries", () => {
    const counted = withCountedRead("items", [{ a: 1 }, { a: 2 }, { a: 3 }]);
    const harness = harnessFor(
      [
        { path: "items[*].a", rules: [] },
        { path: "items[*].b", rules: [] },
        { path: "items[*].c", rules: [] },
      ],
      counted.subject,
      { abortEarly: false }
    );
    expect(harness.plan.arrays).toHaveLength(1);
    runArrayNodes(
      harness.plan.arrays,
      counted.subject,
      harness.context,
      NO_WRITE_TARGETS
    );
    expect(counted.readCount()).toBe(1);
  });

  it("runs zero times on an empty array and reports nothing", () => {
    const root = { items: [] };
    const harness = harnessFor(
      [{ path: "items[*].a", rules: [requiredRule()] }],
      root
    );
    runArrayNodes(harness.plan.arrays, root, harness.context, NO_WRITE_TARGETS);
    expect(harness.sink.issues).toHaveLength(0);
  });

  it("is vacuous when there is no array at the path", () => {
    const root = { items: "not an array" };
    const harness = harnessFor(
      [{ path: "items[*].a", rules: [requiredRule()] }],
      root
    );
    const output = runArrayNodes(
      harness.plan.arrays,
      root,
      harness.context,
      NO_WRITE_TARGETS
    );
    expect(harness.sink.issues).toHaveLength(0);
    expect(output).toBe(root);
  });
});

describe("issue paths carry the concrete index", () => {
  it("renders items[0].name and items[2].name", () => {
    const root = { items: [{}, {}, {}] };
    const harness = harnessFor(
      [{ path: "items[*].name", rules: [requiredRule()] }],
      root,
      { abortEarly: false }
    );
    runArrayNodes(harness.plan.arrays, root, harness.context, NO_WRITE_TARGETS);
    expect(issuePathsOf(harness.sink)).toEqual([
      "items[0].name",
      "items[1].name",
      "items[2].name",
    ]);
  });

  it("renders grid[0][2] for an adjacent-wildcard declaration", () => {
    const root = { grid: [[1, 2, undefined]] };
    const harness = harnessFor(
      [{ path: "grid[*][*]", rules: [requiredRule()] }],
      root,
      { abortEarly: false }
    );
    runArrayNodes(harness.plan.arrays, root, harness.context, NO_WRITE_TARGETS);
    expect(issuePathsOf(harness.sink)).toEqual(["grid[0][2]"]);
  });

  it("renders items[1].sub[0].x through two nested nodes", () => {
    const root = { items: [{ sub: [] }, { sub: [{}] }] };
    const harness = harnessFor(
      [{ path: "items[*].sub[*].x", rules: [requiredRule()] }],
      root,
      { abortEarly: false }
    );
    runArrayNodes(harness.plan.arrays, root, harness.context, NO_WRITE_TARGETS);
    expect(issuePathsOf(harness.sink)).toEqual(["items[1].sub[0].x"]);
  });

  it("leaves the stack balanced, so a later field renders no index", () => {
    const root = { items: [{}, {}], name: undefined };
    const harness = harnessFor(
      [
        { path: "items[*].name", rules: [requiredRule()] },
        { path: "name", rules: [requiredRule()] },
      ],
      root,
      { abortEarly: false }
    );
    runArrayNodes(harness.plan.arrays, root, harness.context, NO_WRITE_TARGETS);
    expect(harness.context.indices.depth).toBe(0);
    expect(harness.context.indices.prefix).toBe("");
  });
});

describe("the element context", () => {
  it("hands every element field an ArrayItemContext", () => {
    const seen: (ArrayItemContext | undefined)[] = [];
    const array = ["a", "b"];
    const root = { items: array };
    const harness = harnessFor(
      [
        {
          path: "items[*]",
          rules: [
            makeDetailedCheck({
              code: "seen",
              run: (_value, ctx) => {
                seen.push(ctx.item);
                return fail({});
              },
            }),
          ],
        },
      ],
      root,
      { abortEarly: false }
    );
    runArrayNodes(harness.plan.arrays, root, harness.context, NO_WRITE_TARGETS);
    expect(seen).toEqual([
      { index: 0, item: "a", array },
      { index: 1, item: "b", array },
    ]);
  });

  it("runs every field of an element, in declaration order", () => {
    const root = { items: [{ a: 1, b: 2 }] };
    const harness = harnessFor(
      [
        { path: "items[*].a", rules: [failing("first")] },
        { path: "items[*].b", rules: [failing("second")] },
      ],
      root,
      { abortEarly: false, abortEarlyOnEachField: true }
    );
    runArrayNodes(harness.plan.arrays, root, harness.context, NO_WRITE_TARGETS);
    expect(issuePathsOf(harness.sink)).toEqual(["items[0].a", "items[0].b"]);
  });

  /**
   * abortEarlyOnEachField is FORCED OFF inside an element (IssueSink.
   * forArrayElements). Legacy hard-coded that in two places and forgot it in a
   * third, so an element reported one rule down one path and all of them down
   * another. The proof needs ONE field with TWO failing rules: two fields with
   * one rule each cannot tell the two sinks apart.
   */
  it("reports EVERY failing rule of one element field, abort flag or not", () => {
    const root = { items: [{ a: 1 }] };
    const harness = harnessFor(
      [{ path: "items[*].a", rules: [failing("first"), failing("second")] }],
      root,
      { abortEarly: false, abortEarlyOnEachField: true }
    );
    runArrayNodes(harness.plan.arrays, root, harness.context, NO_WRITE_TARGETS);
    expect(harness.sink.issues.map((issue) => issue.code)).toEqual([
      "first",
      "second",
    ]);
  });

  it("keeps a TOP-LEVEL field on the caller's own abort flag", () => {
    const root = { a: 1 };
    const harness = harnessFor(
      [{ path: "a", rules: [failing("first"), failing("second")] }],
      root,
      { abortEarly: false, abortEarlyOnEachField: true }
    );
    runPlan(harness.plan, root, harness.context);
    expect(harness.sink.issues.map((issue) => issue.code)).toEqual(["first"]);
  });

  it("still honours abortEarly across elements", () => {
    const root = { items: [{ a: 1 }, { a: 2 }, { a: 3 }] };
    const harness = harnessFor(
      [{ path: "items[*].a", rules: [failing("first")] }],
      root,
      { abortEarly: true }
    );
    runArrayNodes(harness.plan.arrays, root, harness.context, NO_WRITE_TARGETS);
    expect(issuePathsOf(harness.sink)).toEqual(["items[0].a"]);
  });
});

describe("writing an element back", () => {
  it("rebuilds the array copy-on-write and leaves the input alone", () => {
    const root = { items: [{ name: "ada" }, { name: "bob" }] };
    const original = root.items;
    const harness = harnessFor(
      [
        {
          path: "items[*].name",
          rules: [makeTransform((value) => String(value).toUpperCase())],
        },
      ],
      root,
      { shouldApplyTransforms: true }
    );
    const output = runArrayNodes(
      harness.plan.arrays,
      root,
      harness.context,
      createArrayWriteTargets(harness.plan.arrays)
    );
    expect(output).toEqual({ items: [{ name: "ADA" }, { name: "BOB" }] });
    expect(root.items).toBe(original);
    expect(original[0]).toEqual({ name: "ada" });
  });

  it("writes nothing at all when no target was supplied", () => {
    const root = { items: [{ name: "ada" }] };
    const harness = harnessFor(
      [{ path: "items[*].name", rules: [makeTransform(() => "X")] }],
      root,
      { shouldApplyTransforms: true }
    );
    const output = runArrayNodes(
      harness.plan.arrays,
      root,
      harness.context,
      NO_WRITE_TARGETS
    );
    expect(output).toBe(root);
  });

  it("returns the subject by identity when nothing changed", () => {
    const root = { items: [{ name: "ada" }] };
    const harness = harnessFor(
      [{ path: "items[*].name", rules: [makeTransform((value) => value)] }],
      root,
      { shouldApplyTransforms: true }
    );
    const output = runArrayNodes(
      harness.plan.arrays,
      root,
      harness.context,
      createArrayWriteTargets(harness.plan.arrays)
    );
    expect(output).toBe(root);
  });
});
