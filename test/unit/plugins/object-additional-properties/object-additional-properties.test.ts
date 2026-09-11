import { Builder } from "../../../../src/index";
import { objectAdditionalPropertiesPlugin } from "../../../../src/plugins/object-additional-properties";
import { probeMinCharsPlugin } from "../../../support/probe-plugins";
import {
  NOT_A_PLAIN_OBJECT,
  RULE_CONTEXT,
  createRuleBuildContext,
} from "../../../support/rule-build-context";

type Bag = { readonly user: { readonly name: string; readonly nick: string } };
type Labels = { readonly labels: Record<string, unknown> };

// The known key set is DERIVED from the sibling declarations below, which is
// the legacy design defect this closes: legacy made the caller retype the key
// list in options.allowedProperties.
const derived = Builder()
  .use(objectAdditionalPropertiesPlugin)
  .use(probeMinCharsPlugin)
  .for<Bag>()
  .v("user", (b) => b.object.additionalProperties(false))
  .v("user.name", (b) => b.string.minChars(1))
  .v("user.nick", (b) => b.string.minChars(1))
  .build();

describe("objectAdditionalProperties", () => {
  it("accepts an object holding only the declared keys", () => {
    expect(derived.validate({ user: { name: "a", nick: "b" } }).valid).toBe(
      true
    );
  });

  it("rejects a key no sibling declaration named", () => {
    const result = derived.validate({
      user: { name: "a", nick: "b", extra: 1 },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "objectAdditionalProperties",
    ]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Unexpected properties: extra",
    ]);
  });

  it("allows anything when the flag is true", () => {
    const permissive = Builder()
      .use(objectAdditionalPropertiesPlugin)
      .for<Bag>()
      .v("user", (b) => b.object.additionalProperties(true))
      .build();
    expect(permissive.validate({ user: { anything: 1 } }).valid).toBe(true);
  });

  it("lets an explicit key list win over the derived one", () => {
    const explicit = Builder()
      .use(objectAdditionalPropertiesPlugin)
      .use(probeMinCharsPlugin)
      .for<Bag>()
      .v("user", (b) => b.object.additionalProperties(false, ["name"]))
      .v("user.nick", (b) => b.string.minChars(1))
      .build();
    expect(explicit.validate({ user: { name: "a" } }).valid).toBe(true);
    expect(explicit.validate({ user: { name: "a", nick: "b" } }).valid).toBe(
      false
    );
  });

  it("passes a non-object through", () => {
    // The plugin itself objects to nothing; the slot reports the type.
    expect(
      derived.validate({ user: "a" }).issues.map((issue) => issue.code)
    ).toEqual(["objectType"]);
  });
});

// A key is additional only when NEITHER a declared name NOR an allowed pattern
// matched it, so a caller who allows `^x-` may send `x-trace` without naming it.
function buildAllowingPatterns(allowedPatterns: readonly string[]) {
  return Builder()
    .use(objectAdditionalPropertiesPlugin)
    .for<Labels>()
    .v("labels", (b) =>
      b.object.additionalProperties(false, ["env"], allowedPatterns)
    )
    .build();
}

describe("objectAdditionalProperties: allowed patterns", () => {
  it("leaves a key an allowed pattern matched alone", () => {
    expect(
      buildAllowingPatterns(["^x-"]).validate({
        labels: { env: 1, "x-trace": 2 },
      }).valid
    ).toBe(true);
  });

  it("still reports a key no name and no pattern matched", () => {
    const result = buildAllowingPatterns(["^x-"]).validate({
      labels: { env: 1, "y-trace": 2 },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Unexpected properties: y-trace",
    ]);
  });

  // `^\p` is a SyntaxError under the "u" flag and an ordinary literal without
  // it, so a pattern like it survives only if the second attempt is made.
  it("keeps a pattern that only the unicode flag rejects", () => {
    const validator = buildAllowingPatterns(["^\\p"]);
    expect(validator.validate({ labels: { path: 1 } }).valid).toBe(true);
    expect(validator.validate({ labels: { kind: 1 } }).valid).toBe(false);
  });

  // `(` is a SyntaxError either way. One unusable pattern must not take the
  // whole validator down with it; it matches nothing instead.
  it("drops a pattern that will not compile at all, rather than refusing to build", () => {
    const validator = buildAllowingPatterns(["("]);
    expect(validator.validate({ labels: { env: 1 } }).valid).toBe(true);
    expect(validator.validate({ labels: { other: 1 } }).valid).toBe(false);
  });
});

const forbiddingRule = objectAdditionalPropertiesPlugin.build(
  createRuleBuildContext({
    pluginName: "objectAdditionalProperties",
    messageFactory: (context) => context.extraProperties.join("|"),
    declaredSiblingKeys: ["name"],
  }),
  false
);

describe("objectAdditionalProperties: the rule itself", () => {
  it("answers PASS for anything that is not a plain object", () => {
    if (forbiddingRule.kind !== "check") throw new Error("expected a check");
    for (const value of NOT_A_PLAIN_OBJECT) {
      expect(forbiddingRule.run(value, RULE_CONTEXT).ok).toBe(true);
    }
  });
});
