import { Builder } from "../../../../src/index";
import { tupleBuilderPlugin } from "../../../../src/plugins/tuple-builder";
import { probeAtLeastPlugin } from "../../../support/probe-plugins";

type Bag = { readonly point: readonly number[] };

// LEGACY BUG: legacy's tupleBuilder threw during build() and never validated
// anything at all. Every expectation below is a real validate() call.
const fixed = Builder()
  .use(tupleBuilderPlugin)
  .use(probeAtLeastPlugin)
  .for<Bag>()
  .v("point", (b) =>
    b.tuple.builder([
      (eb) => eb.number.atLeast(0),
      (eb) => eb.number.atLeast(10),
    ])
  )
  .build();

const withRest = Builder()
  .use(tupleBuilderPlugin)
  .use(probeAtLeastPlugin)
  .for<Bag>()
  .v("point", (b) =>
    b.tuple.builder([(eb) => eb.number.atLeast(0)], (eb) =>
      eb.number.atLeast(100)
    )
  )
  .build();

describe("tupleBuilder", () => {
  it("applies position i to element i", () => {
    expect(fixed.validate({ point: [0, 10] }).valid).toBe(true);
    expect(fixed.validate({ point: [0, 9] }).valid).toBe(false);
    expect(fixed.validate({ point: [-1, 10] }).valid).toBe(false);
  });

  it("reports which element failed", () => {
    const result = fixed.validate({ point: [0, 9] });
    expect(result.issues.map((issue) => issue.code)).toEqual(["tupleBuilder"]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Validation failed for element 1",
    ]);
  });

  it("demands an exact length when there is no rest schema", () => {
    const short = fixed.validate({ point: [0] });
    expect(short.valid).toBe(false);
    expect(short.issues.map((issue) => issue.message)).toEqual([
      "Tuple must have exactly 2 elements, got 1",
    ]);
    expect(
      fixed
        .validate({ point: [0, 10, 20] })
        .issues.map((issue) => issue.message)
    ).toEqual(["Tuple must have exactly 2 elements, got 3"]);
  });

  it("applies the rest schema to every surplus element", () => {
    expect(withRest.validate({ point: [0, 100, 200] }).valid).toBe(true);
    expect(withRest.validate({ point: [0, 100, 99] }).valid).toBe(false);
  });

  it("demands at least the positional length when there is a rest schema", () => {
    const result = withRest.validate({ point: [] });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Tuple must have at least 1 elements, got 0",
    ]);
  });

  // The tuple slot gets no injected type guard, so this plugin owns the check.
  it("rejects a non-array instead of passing it through", () => {
    const result = fixed.validate({ point: "0,10" });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Value must be an array",
    ]);
  });

  it("exposes the failure kind to a message factory", () => {
    const custom = Builder()
      .use(tupleBuilderPlugin)
      .use(probeAtLeastPlugin)
      .for<Bag>()
      .v("point", (b) =>
        b.tuple.builder([(eb) => eb.number.atLeast(0)], undefined, {
          messageFactory: (context) =>
            `${context.failure}:${String(context.actualLength)}`,
        })
      )
      .build();
    expect(
      custom.validate({ point: [0, 1] }).issues.map((issue) => issue.message)
    ).toEqual(["lengthMismatch:2"]);
  });
});
