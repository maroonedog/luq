// ===========================================================================
// The run-time side of conditional presence. The fields come from the real
// compiler.
//
// Two things get pinned here:
//   1. conditional overrides stack onto the static default in declaration order
//   2. an override is only SELECTED; no policy is assembled at validation time.
//      Both sides are finished at build time, so the predicate is called once
//      per field.
// ===========================================================================
import type { ArrayItemContext, RuleContext } from "../../../src/types";
import { decidePresence } from "../../../src/runtime/decide-presence";
import type { CompiledField } from "../../../src/compile/validation-plan.types";
import {
  ALLOWS_ABSENCE,
  REJECTS_ABSENCE,
  makeConditionalPresence,
  optionalRule,
  requiredRule,
} from "../compile/rule-fixtures";
import { compileFieldAt, createSink } from "./runtime-fixtures";
import type { IssueSink } from "../../../src/runtime/issue-sink";

const ROOT = { flag: true };

function contextFor(
  root: unknown = ROOT,
  item?: ArrayItemContext
): RuleContext {
  return { root, path: "field", item, external: undefined };
}

function decide(
  field: CompiledField,
  value: unknown,
  sink: IssueSink,
  ctx: RuleContext = contextFor()
): boolean {
  return decidePresence(field, value, ctx, sink);
}

const readsFlag = (root: unknown): boolean =>
  (root as { flag: boolean }).flag === true;

describe("a field with no conditional rule", () => {
  it("passes a missing value silently when nothing was declared", () => {
    const sink = createSink();
    expect(
      decide(compileFieldAt({ path: "field", rules: [] }), undefined, sink)
    ).toBe(false);
    expect(sink.issues).toHaveLength(0);
  });

  it("carries the shared frozen array when there are no overrides", () => {
    const field = compileFieldAt({ path: "field", rules: [] });
    expect(field.presenceOverrides).toHaveLength(0);
    expect(Object.isFrozen(field.presenceOverrides)).toBe(true);
  });

  it("has required blame a missing value under its own code", () => {
    const sink = createSink();
    const field = compileFieldAt({ path: "field", rules: [requiredRule()] });
    expect(decide(field, undefined, sink)).toBe(false);
    expect(sink.issues[0]?.code).toBe("required");
  });
});

describe("the requiredIf shape: demanding when true, silent when false", () => {
  const field = compileFieldAt({
    path: "field",
    rules: [makeConditionalPresence("requiredIf", readsFlag)],
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["the empty string", ""],
  ])("rejects %s when the condition is true", (_label, value) => {
    const sink = createSink();
    expect(decide(field, value, sink)).toBe(false);
    expect(sink.issues[0]?.code).toBe("requiredIf");
  });

  it("moves on when a value is present, even with a true condition", () => {
    const sink = createSink();
    expect(decide(field, "x", sink)).toBe(true);
    expect(sink.issues).toHaveLength(0);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
  ])(
    "ends silently, treating %s as absent, when the condition is false",
    (_label, value) => {
      const sink = createSink();
      expect(decide(field, value, sink, contextFor({ flag: false }))).toBe(
        false
      );
      expect(sink.issues).toHaveLength(0);
    }
  );

  // With a false condition requiredIf is silent, so the empty string goes
  // back to counting as present.
  it("moves on with the empty string as a present value when the condition is false", () => {
    const sink = createSink();
    expect(decide(field, "", sink, contextFor({ flag: false }))).toBe(true);
    expect(sink.issues).toHaveLength(0);
  });
});

describe("a static default with conditional overrides", () => {
  const requiredThenOptionalIf = compileFieldAt({
    path: "field",
    rules: [
      requiredRule(),
      makeConditionalPresence(
        "optionalIf",
        readsFlag,
        ALLOWS_ABSENCE,
        REJECTS_ABSENCE
      ),
    ],
  });

  it("has the override lift required when the condition is true", () => {
    const sink = createSink();
    expect(decide(requiredThenOptionalIf, undefined, sink)).toBe(false);
    expect(sink.issues).toHaveLength(0);
  });

  it("has the override reject when the condition is false", () => {
    const sink = createSink();
    expect(
      decide(
        requiredThenOptionalIf,
        undefined,
        sink,
        contextFor({ flag: false })
      )
    ).toBe(false);
    expect(sink.issues[0]?.code).toBe("optionalIf");
  });

  it("leaves the static default alone on the side holding no opinion", () => {
    const sink = createSink();
    const field = compileFieldAt({
      path: "field",
      rules: [requiredRule(), makeConditionalPresence("requiredIf", readsFlag)],
    });
    expect(decide(field, undefined, sink, contextFor({ flag: false }))).toBe(
      false
    );
    expect(sink.issues[0]?.code).toBe("required");
  });

  it("lets a later override win over an earlier one", () => {
    const sink = createSink();
    const field = compileFieldAt({
      path: "field",
      rules: [
        makeConditionalPresence("first", () => true, REJECTS_ABSENCE, null),
        makeConditionalPresence("second", () => true, ALLOWS_ABSENCE, null),
      ],
    });
    expect(decide(field, undefined, sink)).toBe(false);
    expect(sink.issues).toHaveLength(0);
  });

  it("makes requiredIf over optional stricter only when the condition is true", () => {
    const field = compileFieldAt({
      path: "field",
      rules: [optionalRule(), makeConditionalPresence("requiredIf", readsFlag)],
    });
    const strict = createSink();
    expect(decide(field, undefined, strict)).toBe(false);
    expect(strict.issues[0]?.code).toBe("requiredIf");
    const lenient = createSink();
    expect(decide(field, undefined, lenient, contextFor({ flag: false }))).toBe(
      false
    );
    expect(lenient.issues).toHaveLength(0);
  });
});

describe("how the predicate is called", () => {
  it("calls it once per field, with the root and the item context", () => {
    const when = jest.fn(() => false);
    const field = compileFieldAt({
      path: "field",
      rules: [makeConditionalPresence("requiredIf", when)],
    });
    const arrayContext: ArrayItemContext = {
      index: 2,
      item: { a: 1 },
      array: [{ a: 1 }],
    };
    decide(field, "x", createSink(), contextFor(ROOT, arrayContext));
    expect(when).toHaveBeenCalledTimes(1);
    expect(when).toHaveBeenCalledWith(ROOT, arrayContext);
  });

  it("evaluates the predicate even for a present value, the empty string being treated differently either way", () => {
    const when = jest.fn(() => true);
    const field = compileFieldAt({
      path: "field",
      rules: [makeConditionalPresence("requiredIf", when)],
    });
    decide(field, 0, createSink());
    expect(when).toHaveBeenCalledTimes(1);
  });
});
