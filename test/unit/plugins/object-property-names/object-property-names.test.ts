import { Builder } from "../../../../src/index";
import type { BranchRunner } from "../../../../src/plugin-kit/compiled-rule";
import { objectPropertyNamesPlugin } from "../../../../src/plugins/object-property-names";
import { probeMinCharsPlugin } from "../../../support/probe-plugins";
import {
  NOT_A_PLAIN_OBJECT,
  RULE_CONTEXT,
  createRuleBuildContext,
} from "../../../support/rule-build-context";

type Bag = { readonly metrics: Record<string, number> };

const validator = Builder()
  .use(objectPropertyNamesPlugin)
  .use(probeMinCharsPlugin)
  .for<Bag>()
  .v("metrics", (b) => b.object.propertyNames((kb) => kb.string.minChars(3)))
  .build();

describe("objectPropertyNames", () => {
  // The sub-chain's subject is the KEY, a string, even though the property
  // VALUES here are numbers.
  it("constrains the keys and not the values", () => {
    expect(validator.validate({ metrics: { hits: 1, miss: 2 } }).valid).toBe(
      true
    );
    expect(validator.validate({ metrics: { ok: 1 } }).valid).toBe(false);
  });

  it("accepts an object with no keys at all", () => {
    expect(validator.validate({ metrics: {} }).valid).toBe(true);
  });

  it("names every invalid key under its own code", () => {
    const result = validator.validate({ metrics: { a: 1, b: 2, long: 3 } });
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "objectPropertyNames",
    ]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Invalid property names: a,b",
    ]);
  });

  // LEGACY BUG: legacy returned false for a non-object, alone among the
  // object plugins.
  it("passes a non-object through", () => {
    // The plugin itself objects to nothing; the slot reports the type.
    expect(
      validator.validate({ metrics: 3 }).issues.map((issue) => issue.code)
    ).toEqual(["objectType"]);
  });
});

const keyRule = objectPropertyNamesPlugin.build(
  createRuleBuildContext({
    pluginName: "objectPropertyNames",
    messageFactory: (context) => context.invalidPropertyNames.join("|"),
  }),
  []
);
const REFUSING_RUNNER: BranchRunner = Object.freeze({
  label: "propertyName",
  run: () => ({ ok: false as const, detail: {} }),
});

describe("objectPropertyNames: the rule itself", () => {
  it("answers PASS for anything that is not a plain object", () => {
    if (keyRule.kind !== "composite") throw new Error("expected a composite");
    const execute = keyRule.combine([REFUSING_RUNNER]);
    for (const value of NOT_A_PLAIN_OBJECT) {
      expect(execute(value, RULE_CONTEXT).ok).toBe(true);
    }
  });

  it("reports nothing when the sub-chain produced no runner to apply", () => {
    if (keyRule.kind !== "composite") throw new Error("expected a composite");
    expect(keyRule.combine([])({ a: 1 }, RULE_CONTEXT).ok).toBe(true);
  });
});
