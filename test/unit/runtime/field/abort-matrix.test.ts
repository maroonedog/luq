// ===========================================================================
// abortEarly x abortEarlyOnEachField, all four cells, run for real.
//
// Both default to TRUE and they are orthogonal. The cell that matters most is
// {abortEarly:false, abortEarlyOnEachField:true} — "one representative issue
// per field, for every field" — which the legacy suite pinned as the form-UX
// combination. The plan level is exercised through a driver that does exactly
// what runPlan will do: run the fields in order, asking the sink after each.
// ===========================================================================
import { fail } from "../../../../src/types";
import type { ValidateOptions } from "../../../../src/types/validation-result.types";
import { runField } from "../../../../src/runtime/run-field";
import { IssueSink } from "../../../../src/runtime/issue-sink";
import {
  compileFieldAt,
  createRunContext,
  createSink,
  makeDetailedCheck,
} from "../runtime-fixtures";

function twoFailingChecksAt(path: string) {
  return compileFieldAt({
    path,
    rules: [
      makeDetailedCheck({ code: `${path}-first`, run: () => fail({}) }),
      makeDetailedCheck({ code: `${path}-second`, run: () => fail({}) }),
    ],
  });
}

/** The whole of what runPlan adds on top of runField: order, then the ask. */
function runTwoFields(sink: IssueSink, subject: unknown): readonly string[] {
  const context = createRunContext({ sink, root: subject });
  for (const field of [twoFailingChecksAt("a"), twoFailingChecksAt("b")]) {
    runField(field, subject, context);
    if (sink.shouldStopPlan()) break;
  }
  return sink.issues.map((issue) => issue.code);
}

describe("the abort matrix", () => {
  const cases: readonly [ValidateOptions, readonly string[]][] = [
    [{}, ["a-first"]],
    [{ abortEarly: true, abortEarlyOnEachField: true }, ["a-first"]],
    [
      { abortEarly: true, abortEarlyOnEachField: false },
      ["a-first", "a-second"],
    ],
    [
      { abortEarly: false, abortEarlyOnEachField: true },
      ["a-first", "b-first"],
    ],
    [
      { abortEarly: false, abortEarlyOnEachField: false },
      ["a-first", "a-second", "b-first", "b-second"],
    ],
  ];

  it.each(cases)("with %p reports %p", (options, expected) => {
    expect(runTwoFields(createSink(options), { a: "x", b: "y" })).toEqual(
      expected
    );
  });

  it("defaults to the same answer as both flags set to true", () => {
    expect(runTwoFields(createSink(), { a: "x", b: "y" })).toEqual(
      runTwoFields(
        createSink({ abortEarly: true, abortEarlyOnEachField: true }),
        { a: "x", b: "y" }
      )
    );
  });
});

describe("the field-level abort is scoped to ONE field", () => {
  it("does not carry an earlier field's issue into the next field's decision", () => {
    const sink = createSink({ abortEarly: false });
    const context = createRunContext({ sink });
    runField(twoFailingChecksAt("a"), { a: "x" }, context);
    runField(twoFailingChecksAt("b"), { b: "y" }, context);
    expect(sink.issues.map((issue) => issue.code)).toEqual([
      "a-first",
      "b-first",
    ]);
  });
});

describe("inside an array element every rule of a field is collected", () => {
  it("ignores the caller's abortEarlyOnEachField", () => {
    const sink = createSink({ abortEarly: false, abortEarlyOnEachField: true });
    const elements = sink.forArrayElements();
    runField(
      twoFailingChecksAt("name"),
      { name: "x" },
      createRunContext({ sink: elements })
    );
    expect(sink.issues.map((issue) => issue.code)).toEqual([
      "name-first",
      "name-second",
    ]);
  });

  it("still stops the enclosing plan when abortEarly is on", () => {
    const sink = createSink();
    const elements = sink.forArrayElements();
    runField(
      twoFailingChecksAt("name"),
      { name: "x" },
      createRunContext({ sink: elements })
    );
    expect(sink.issues.map((issue) => issue.code)).toEqual([
      "name-first",
      "name-second",
    ]);
    expect(sink.shouldStopPlan()).toBe(true);
  });
});
