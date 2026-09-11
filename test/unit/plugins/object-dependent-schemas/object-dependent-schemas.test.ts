import { Builder } from "../../../../src/index";
import type { BranchRunner } from "../../../../src/plugin-kit/compiled-rule";
import { objectDependentSchemasPlugin } from "../../../../src/plugins/object-dependent-schemas";
import { objectMinPropertiesPlugin } from "../../../../src/plugins/object-min-properties";
import {
  NOT_A_PLAIN_OBJECT,
  RULE_CONTEXT,
  createRuleBuildContext,
} from "../../../support/rule-build-context";

type Bag = { readonly payment: Record<string, unknown> };

const validator = Builder()
  .use(objectDependentSchemasPlugin)
  .use(objectMinPropertiesPlugin)
  .for<Bag>()
  .v("payment", (b) =>
    b.object.dependentSchemas({
      card: (sb) => sb.object.minProperties(3),
    })
  )
  .build();

describe("objectDependentSchemas", () => {
  it("applies nothing while the trigger is absent", () => {
    expect(validator.validate({ payment: { a: 1 } }).valid).toBe(true);
  });

  // The sub-chain sees the WHOLE object, not the trigger's value: that is what
  // makes its marker NarrowedChain and not PropertyValueChain.
  it("applies the schema to the whole object once the trigger appears", () => {
    expect(validator.validate({ payment: { card: 1, b: 2, c: 3 } }).valid).toBe(
      true
    );
    const result = validator.validate({ payment: { card: 1 } });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "objectDependentSchemas",
    ]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      'The schema required by "card" did not match',
    ]);
  });

  it("treats an explicit undefined trigger as absent", () => {
    expect(validator.validate({ payment: { card: undefined } }).valid).toBe(
      true
    );
  });

  it("passes a non-object through", () => {
    // The plugin itself objects to nothing; the slot reports the type.
    expect(
      validator.validate({ payment: [1] }).issues.map((issue) => issue.code)
    ).toEqual(["objectType"]);
  });
});

const triggeredRule = objectDependentSchemasPlugin.build(
  createRuleBuildContext({
    pluginName: "objectDependentSchemas",
    messageFactory: (context) => `[${context.trigger}]`,
  }),
  { card: [] }
);
const REFUSING_RUNNER: BranchRunner = Object.freeze({
  label: "card",
  run: () => ({ ok: false as const, detail: {} }),
});

describe("objectDependentSchemas: the rule itself", () => {
  it("answers PASS for anything that is not a plain object", () => {
    if (triggeredRule.kind !== "composite") {
      throw new Error("expected a composite");
    }
    const execute = triggeredRule.combine([REFUSING_RUNNER]);
    for (const value of NOT_A_PLAIN_OBJECT) {
      expect(execute(value, RULE_CONTEXT).ok).toBe(true);
    }
  });
});
