// ===========================================================================
// The sink owns both abort decisions and nothing else owns either.
//
// The legacy spelling `options?.abortEarly !== false` made `undefined` and
// `true` accidentally equal and hid the default from every reader. The
// defaults are asserted here explicitly, in both directions, so a future
// `?? false` cannot slip through as "no visible change".
// ===========================================================================
import type { IssueSeverity, ValidationIssue } from "../../../src/types";
import {
  ARRAY_ELEMENTS_ABORT_ON_EACH_FIELD,
  IssueSink,
  resolveAbortPolicy,
} from "../../../src/runtime/issue-sink";

function anIssue(
  code: string,
  severity: IssueSeverity = "error"
): ValidationIssue {
  return { path: "name", code, message: `${code} failed`, severity };
}

describe("resolveAbortPolicy states its defaults", () => {
  it("defaults BOTH levels to true", () => {
    expect(resolveAbortPolicy()).toEqual({
      abortEarly: true,
      abortEarlyOnEachField: true,
    });
  });

  it("treats an absent option exactly like an explicit true", () => {
    expect(resolveAbortPolicy({})).toEqual(
      resolveAbortPolicy({ abortEarly: true, abortEarlyOnEachField: true })
    );
  });

  it("honours an explicit false on each level independently", () => {
    expect(resolveAbortPolicy({ abortEarly: false })).toEqual({
      abortEarly: false,
      abortEarlyOnEachField: true,
    });
    expect(resolveAbortPolicy({ abortEarlyOnEachField: false })).toEqual({
      abortEarly: true,
      abortEarlyOnEachField: false,
    });
  });
});

describe("IssueSink accumulates", () => {
  it("counts and exposes what it was given, in order", () => {
    const sink = new IssueSink(resolveAbortPolicy());
    expect(sink.count).toBe(0);
    sink.add(anIssue("required"));
    sink.add(anIssue("minLength"));
    expect(sink.count).toBe(2);
    expect(sink.issues.map((issue) => issue.code)).toEqual([
      "required",
      "minLength",
    ]);
  });
});

describe("the object-level abort", () => {
  it("stops the plan once anything has been recorded", () => {
    const sink = new IssueSink(resolveAbortPolicy());
    expect(sink.shouldStopPlan()).toBe(false);
    sink.add(anIssue("required"));
    expect(sink.shouldStopPlan()).toBe(true);
  });

  it("never stops the plan when abortEarly is false", () => {
    const sink = new IssueSink(resolveAbortPolicy({ abortEarly: false }));
    sink.add(anIssue("required"));
    expect(sink.shouldStopPlan()).toBe(false);
  });

  it("counts a warning and an info, not only an error", () => {
    const sink = new IssueSink(resolveAbortPolicy());
    sink.add(anIssue("deprecated", "warning"));
    expect(sink.shouldStopPlan()).toBe(true);
    const other = new IssueSink(resolveAbortPolicy());
    other.add(anIssue("hint", "info"));
    expect(other.shouldStopPlan()).toBe(true);
  });
});

describe("the field-level abort is taken against a mark", () => {
  it("ignores issues recorded before the field started", () => {
    const sink = new IssueSink(resolveAbortPolicy());
    sink.add(anIssue("from-an-earlier-field"));
    const mark = sink.count;
    expect(sink.shouldStopField(mark)).toBe(false);
    sink.add(anIssue("this-field"));
    expect(sink.shouldStopField(mark)).toBe(true);
  });

  it("never stops the field when abortEarlyOnEachField is false", () => {
    const sink = new IssueSink(
      resolveAbortPolicy({ abortEarlyOnEachField: false })
    );
    const mark = sink.count;
    sink.add(anIssue("minLength"));
    expect(sink.shouldStopField(mark)).toBe(false);
    expect(sink.shouldStopPlan()).toBe(true);
  });
});

describe("the sink for array elements", () => {
  it("disables the field-level abort under a named rule", () => {
    expect(ARRAY_ELEMENTS_ABORT_ON_EACH_FIELD).toBe(false);
    const elements = new IssueSink(resolveAbortPolicy()).forArrayElements();
    const mark = elements.count;
    elements.add(anIssue("minLength"));
    expect(elements.shouldStopField(mark)).toBe(false);
  });

  it("keeps the caller's abortEarly", () => {
    const collecting = new IssueSink(
      resolveAbortPolicy({ abortEarly: false })
    ).forArrayElements();
    collecting.add(anIssue("minLength"));
    expect(collecting.shouldStopField(collecting.count - 1)).toBe(false);
    expect(collecting.shouldStopPlan()).toBe(false);
    const stopping = new IssueSink(resolveAbortPolicy()).forArrayElements();
    stopping.add(anIssue("minLength"));
    expect(stopping.shouldStopPlan()).toBe(true);
  });

  it("shares ONE issue buffer with the sink it came from", () => {
    const outer = new IssueSink(resolveAbortPolicy());
    const elements = outer.forArrayElements();
    elements.add(anIssue("items-0-name"));
    expect(outer.count).toBe(1);
    expect(outer.issues.map((issue) => issue.code)).toEqual(["items-0-name"]);
    outer.add(anIssue("after"));
    expect(elements.count).toBe(2);
  });
});
