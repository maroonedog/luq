import { Builder } from "../../../../src/index";
import type { BranchRunner } from "../../../../src/plugin-kit/compiled-rule";
import { objectPatternPropertiesPlugin } from "../../../../src/plugins/object-pattern-properties";
import { probeMinCharsPlugin } from "../../../support/probe-plugins";
import {
  NOT_A_PLAIN_OBJECT,
  RULE_CONTEXT,
  createRuleBuildContext,
} from "../../../support/rule-build-context";

type Bag = { readonly labels: Record<string, string> };

const validator = Builder()
  .use(objectPatternPropertiesPlugin)
  .use(probeMinCharsPlugin)
  .for<Bag>()
  .v("labels", (b) =>
    b.object.patternProperties({
      "^env": (pb) => pb.string.minChars(2),
      prod$: (pb) => pb.string.minChars(5),
    })
  )
  .build();

describe("objectPatternProperties", () => {
  it("applies a pattern to the keys that match it", () => {
    expect(validator.validate({ labels: { envA: "dev" } }).valid).toBe(true);
    expect(validator.validate({ labels: { envA: "d" } }).valid).toBe(false);
  });

  it("leaves a key that matches no pattern alone", () => {
    expect(validator.validate({ labels: { other: "" } }).valid).toBe(true);
  });

  // LEGACY BUG: legacy stopped at the FIRST matching pattern, which Draft-07
  // does not. "envprod" matches both, and both must apply.
  it("applies EVERY matching pattern, not just the first", () => {
    expect(validator.validate({ labels: { envprod: "abcde" } }).valid).toBe(
      true
    );
    const result = validator.validate({ labels: { envprod: "abc" } });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "objectPatternProperties",
    ]);
  });

  it("names every violating property in the message", () => {
    const result = validator.validate({ labels: { envA: "d", envB: "e" } });
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Properties failing their pattern schema: envA,envB",
    ]);
  });

  it("passes a non-object through", () => {
    // The plugin itself objects to nothing; the slot reports the type.
    expect(
      validator.validate({ labels: "envA" }).issues.map((issue) => issue.code)
    ).toEqual(["objectType"]);
  });
});

const matchingRule = objectPatternPropertiesPlugin.build(
  createRuleBuildContext({
    pluginName: "objectPatternProperties",
    messageFactory: (context) => context.violatingProperties.join("|"),
  }),
  { "^env": [] }
);
const REFUSING_RUNNER: BranchRunner = Object.freeze({
  label: "^env",
  run: () => ({ ok: false as const, detail: {} }),
});

describe("objectPatternProperties: the rule itself", () => {
  it("answers PASS for anything that is not a plain object", () => {
    if (matchingRule.kind !== "composite") {
      throw new Error("expected a composite");
    }
    const execute = matchingRule.combine([REFUSING_RUNNER]);
    expect(execute({ envA: "d" }, RULE_CONTEXT).ok).toBe(false);
    for (const value of NOT_A_PLAIN_OBJECT) {
      expect(execute(value, RULE_CONTEXT).ok).toBe(true);
    }
  });
});
