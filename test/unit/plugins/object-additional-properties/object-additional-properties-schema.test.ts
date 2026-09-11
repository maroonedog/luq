import { Builder } from "../../../../src/index";
import type { BranchRunner } from "../../../../src/plugin-kit/compiled-rule";
import { objectAdditionalPropertiesSchemaPlugin } from "../../../../src/plugins/object-additional-properties";
import { probeMinCharsPlugin } from "../../../support/probe-plugins";
import {
  NOT_A_PLAIN_OBJECT,
  RULE_CONTEXT,
  createRuleBuildContext,
} from "../../../support/rule-build-context";

type Bag = { readonly labels: Record<string, string> };
type Deployment = {
  readonly labels: { readonly env: string; readonly tier?: string };
};

const validator = Builder()
  .use(objectAdditionalPropertiesSchemaPlugin)
  .use(probeMinCharsPlugin)
  .for<Bag>()
  .v("labels", (b) =>
    b.object.additionalPropertiesSchema((pb) => pb.string.minChars(3), ["env"])
  )
  .build();

describe("objectAdditionalPropertiesSchema", () => {
  it("leaves the listed keys alone", () => {
    expect(validator.validate({ labels: { env: "a" } }).valid).toBe(true);
  });

  // The sub-chain's subject is the VALUE behind an unlisted key, which is why
  // its marker is PropertyValueChain.
  it("applies the sub-chain to every unlisted key", () => {
    expect(
      validator.validate({ labels: { env: "a", tier: "abc" } }).valid
    ).toBe(true);
    const result = validator.validate({ labels: { env: "a", tier: "ab" } });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "objectAdditionalPropertiesSchema",
    ]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Unexpected properties: tier",
    ]);
  });

  it("passes a non-object through", () => {
    // The plugin itself objects to nothing; the slot reports the type.
    expect(
      validator.validate({ labels: 1 }).issues.map((issue) => issue.code)
    ).toEqual(["objectType"]);
  });
});

// With no key list given, the keys the caller already declared underneath the
// field are the listed ones, so nobody has to retype them.
const derived = Builder()
  .use(objectAdditionalPropertiesSchemaPlugin)
  .use(probeMinCharsPlugin)
  .for<Deployment>()
  .v("labels", (b) =>
    b.object.additionalPropertiesSchema((pb) => pb.string.minChars(3))
  )
  .v("labels.env", (b) => b.string.minChars(1))
  .build();

describe("objectAdditionalPropertiesSchema: the derived key list", () => {
  it("leaves a declared sibling key to its own declaration", () => {
    expect(derived.validate({ labels: { env: "a" } }).valid).toBe(true);
  });

  it("applies the sub-chain to a key no sibling declaration named", () => {
    expect(derived.validate({ labels: { env: "a", tier: "abc" } }).valid).toBe(
      true
    );
    const result = derived.validate({ labels: { env: "a", tier: "ab" } });
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Unexpected properties: tier",
    ]);
  });
});

const schemaRule = objectAdditionalPropertiesSchemaPlugin.build(
  createRuleBuildContext({
    pluginName: "objectAdditionalPropertiesSchema",
    messageFactory: (context) => context.extraProperties.join("|"),
  }),
  [],
  ["env"]
);
const REFUSING_RUNNER: BranchRunner = Object.freeze({
  label: "additional",
  run: () => ({ ok: false as const, detail: {} }),
});

describe("objectAdditionalPropertiesSchema: the rule itself", () => {
  it("answers PASS for anything that is not a plain object", () => {
    if (schemaRule.kind !== "composite")
      throw new Error("expected a composite");
    const execute = schemaRule.combine([REFUSING_RUNNER]);
    for (const value of NOT_A_PLAIN_OBJECT) {
      expect(execute(value, RULE_CONTEXT).ok).toBe(true);
    }
  });

  it("reports nothing when the sub-chain produced no runner to apply", () => {
    if (schemaRule.kind !== "composite")
      throw new Error("expected a composite");
    expect(schemaRule.combine([])({ tier: "x" }, RULE_CONTEXT).ok).toBe(true);
  });
});
