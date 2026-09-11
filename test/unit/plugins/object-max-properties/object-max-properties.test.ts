import { Builder } from "../../../../src/index";
import { PluginArgumentError } from "../../../../src/plugin-kit/plugin-definition";
import { objectMaxPropertiesPlugin } from "../../../../src/plugins/object-max-properties";
import {
  NOT_A_PLAIN_OBJECT,
  RULE_CONTEXT,
  createRuleBuildContext,
} from "../../../support/rule-build-context";

type Bag = { readonly config: Record<string, unknown> };

const validator = Builder()
  .use(objectMaxPropertiesPlugin)
  .for<Bag>()
  .v("config", (b) => b.object.maxProperties(2))
  .build();

describe("objectMaxProperties", () => {
  it("accepts at the bound and below it", () => {
    expect(validator.validate({ config: { a: 1, b: 2 } }).valid).toBe(true);
    expect(validator.validate({ config: {} }).valid).toBe(true);
  });

  it("rejects above it with the legacy message", () => {
    const result = validator.validate({ config: { a: 1, b: 2, c: 3 } });
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "objectMaxProperties",
    ]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Must have at most 2 properties, but has 3",
    ]);
  });

  it("passes a non-object through", () => {
    // The plugin itself objects to nothing; the slot reports the type.
    expect(
      validator
        .validate({ config: [1, 2, 3, 4] })
        .issues.map((issue) => issue.code)
    ).toEqual(["objectType"]);
  });
});

// A bound that is not a count is refused where it was written, not turned into
// a rule that quietly accepts or rejects everything.
function buildWithBound(max: number) {
  return () =>
    Builder()
      .use(objectMaxPropertiesPlugin)
      .for<Bag>()
      .v("config", (b) => b.object.maxProperties(max))
      .build();
}

describe("objectMaxProperties: the bound itself", () => {
  it("accepts zero, which forbids every property", () => {
    const none = buildWithBound(0)();
    expect(none.validate({ config: {} }).valid).toBe(true);
    expect(none.validate({ config: { a: 1 } }).valid).toBe(false);
  });

  it("throws at BUILD time on a negative bound", () => {
    expect(buildWithBound(-1)).toThrow(PluginArgumentError);
  });

  it("throws at BUILD time on NaN", () => {
    expect(buildWithBound(Number.NaN)).toThrow(PluginArgumentError);
  });

  it("throws at BUILD time on Infinity", () => {
    expect(buildWithBound(Number.POSITIVE_INFINITY)).toThrow(
      PluginArgumentError
    );
  });
});

const boundedRule = objectMaxPropertiesPlugin.build(
  createRuleBuildContext({
    pluginName: "objectMaxProperties",
    messageFactory: (context) => `${context.max}/${context.actual}`,
  }),
  2
);

describe("objectMaxProperties: the rule itself", () => {
  it("answers PASS for anything that is not a plain object", () => {
    if (boundedRule.kind !== "check") throw new Error("expected a check");
    for (const value of NOT_A_PLAIN_OBJECT) {
      expect(boundedRule.run(value, RULE_CONTEXT).ok).toBe(true);
    }
  });
});
