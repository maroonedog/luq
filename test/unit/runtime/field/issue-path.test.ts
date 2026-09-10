// ===========================================================================
// The issue path a user reads, produced end to end by runField.
//
// The single legacy defect this closes: the same declaration `items[*].name`
// reported `items[0].name` down the array-batch path and the raw pattern
// `items[*].name` down the other, because two places decided the path. Here
// the index stack decides, once, and runField never sees a wildcard.
// ===========================================================================
import { fail } from "../../../../src/types";
import { compileField } from "../../../../src/compile/compile-field";
import type { CompiledField } from "../../../../src/compile/validation-plan.types";
import { IndexStack } from "../../../../src/runtime/index-stack";
import { runField } from "../../../../src/runtime/run-field";
import {
  EMPTY_PLAN,
  eraseCompositeToCheck,
  planRefTo,
  requiredRule,
} from "../../compile/rule-fixtures";
import {
  compileFieldAt,
  createRunContext,
  createSink,
  makeDetailedCheck,
} from "../runtime-fixtures";

function failingFieldAt(path: string) {
  return compileFieldAt({
    path,
    rules: [makeDetailedCheck({ code: "minLength", run: () => fail({}) })],
  });
}

describe("an issue path names a real location", () => {
  it("uses the declared path at the root", () => {
    const sink = createSink();
    runField(
      failingFieldAt("user.profile.email"),
      { user: { profile: { email: "x" } } },
      createRunContext({ sink })
    );
    expect(sink.issues[0]?.path).toBe("user.profile.email");
  });

  it("expands an element field to items[0].name", () => {
    const sink = createSink();
    const indices = new IndexStack();
    indices.push("items", 0);
    runField(
      failingFieldAt("name"),
      { name: "x" },
      createRunContext({ sink, indices })
    );
    expect(sink.issues[0]?.path).toBe("items[0].name");
    expect(sink.issues[0]?.path).not.toContain("[*]");
  });

  it("uses the ACTUAL index, element by element", () => {
    const sink = createSink({ abortEarly: false });
    const indices = new IndexStack();
    const field = failingFieldAt("name");
    for (const index of [0, 1, 2]) {
      indices.push("items", index);
      runField(field, { name: "x" }, createRunContext({ sink, indices }));
      indices.pop();
    }
    expect(sink.issues.map((issue) => issue.path)).toEqual([
      "items[0].name",
      "items[1].name",
      "items[2].name",
    ]);
  });

  it("expands a nested array to grid[0][2]", () => {
    const sink = createSink();
    const indices = new IndexStack();
    indices.push("grid", 0);
    indices.push("", 2);
    runField(elementItself(), 7, createRunContext({ sink, indices }));
    expect(sink.issues[0]?.path).toBe("grid[0][2]");
  });

  it("expands data[1].nested.inner", () => {
    const sink = createSink();
    const indices = new IndexStack();
    indices.push("data", 1);
    runField(
      failingFieldAt("nested.inner"),
      { nested: { inner: "x" } },
      createRunContext({ sink, indices })
    );
    expect(sink.issues[0]?.path).toBe("data[1].nested.inner");
  });

  it("puts the same path on a presence issue", () => {
    const sink = createSink();
    const indices = new IndexStack();
    indices.push("items", 3);
    runField(
      compileFieldAt({ path: "name", rules: [requiredRule()] }),
      {},
      createRunContext({ sink, indices })
    );
    expect(sink.issues[0]).toEqual({
      path: "items[3].name",
      code: "required",
      message: "required policy",
      severity: "error",
    });
  });

  it("hands the same path to the rule as ctx.path", () => {
    const seen: string[] = [];
    const indices = new IndexStack();
    indices.push("items", 5);
    runField(
      compileFieldAt({
        path: "name",
        rules: [
          makeDetailedCheck({
            code: "minLength",
            run: (_value, ctx) => {
              seen.push(ctx.path);
              return fail({});
            },
          }),
        ],
      }),
      { name: "x" },
      createRunContext({ sink: createSink(), indices })
    );
    expect(seen).toEqual(["items[5].name"]);
  });
});

/** The element of `grid[*][*]` is the number itself: an empty template, which
 *  compileField turns into the identity reader. */
function elementItself(): CompiledField {
  return compileField({
    template: [],
    rules: [makeDetailedCheck({ code: "numberMin", run: () => fail({}) })],
    fieldPath: "grid[*][*]",
    defaultOf: null,
    applyDefaultToNull: true,
    normalize: null,
    planRef: planRefTo(EMPTY_PLAN),
    eraseComposite: eraseCompositeToCheck,
  });
}
