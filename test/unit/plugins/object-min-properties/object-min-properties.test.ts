import { Builder } from "../../../../src/index";
import { PluginArgumentError } from "../../../../src/plugin-kit/plugin-definition";
import { objectMinPropertiesPlugin } from "../../../../src/plugins/object-min-properties";
import {
  NOT_A_PLAIN_OBJECT,
  RULE_CONTEXT,
  createRuleBuildContext,
} from "../../../support/rule-build-context";

type Bag = { readonly config: Record<string, unknown> };

const validator = Builder()
  .use(objectMinPropertiesPlugin)
  .for<Bag>()
  .v("config", (b) => b.object.minProperties(2))
  .build();

describe("objectMinProperties", () => {
  it("counts own enumerable keys", () => {
    expect(validator.validate({ config: { a: 1, b: 2 } }).valid).toBe(true);
    expect(validator.validate({ config: { a: 1 } }).valid).toBe(false);
  });

  it("reports the legacy message and its own code", () => {
    const result = validator.validate({ config: { a: 1 } });
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "objectMinProperties",
    ]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Must have at least 2 properties, but has 1",
    ]);
  });

  // LEGACY BUG: `typeof value !== "object"` let an ARRAY count its indices.
  it("does not count array indices as properties", () => {
    // The plugin itself objects to nothing; the slot reports the type.
    expect(
      validator
        .validate({ config: ["a", "b", "c"] })
        .issues.map((issue) => issue.code)
    ).toEqual(["objectType"]);
  });

  it("passes a non-object through", () => {
    // The plugin itself objects to nothing; the slot reports the type.
    expect(
      validator.validate({ config: "ab" }).issues.map((issue) => issue.code)
    ).toEqual(["objectType"]);
  });

  it("throws at BUILD time on NaN, which legacy let through", () => {
    expect(() =>
      Builder()
        .use(objectMinPropertiesPlugin)
        .for<Bag>()
        .v("config", (b) => b.object.minProperties(Number.NaN))
        .build()
    ).toThrow(PluginArgumentError);
  });
});

const boundedRule = objectMinPropertiesPlugin.build(
  createRuleBuildContext({
    pluginName: "objectMinProperties",
    messageFactory: (context) => `${context.min}/${context.actual}`,
  }),
  2
);

describe("objectMinProperties: the rule itself", () => {
  it("answers PASS for anything that is not a plain object", () => {
    if (boundedRule.kind !== "check") throw new Error("expected a check");
    for (const value of NOT_A_PLAIN_OBJECT) {
      expect(boundedRule.run(value, RULE_CONTEXT).ok).toBe(true);
    }
  });
});
