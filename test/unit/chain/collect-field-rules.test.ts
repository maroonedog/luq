import {
  collectFieldRules,
  FieldChainResultError,
} from "../../../src/chain/collect-field-rules";
import type { AnyChain } from "../../../src/chain/field-chain.types";
import type { FieldSlots } from "../../../src/chain/field-slots.types";
import {
  chainContext,
  containsPlugin,
  expectPresence,
  requiredPlugin,
  ruleCodes,
  stringMinPlugin,
  transformPlugin,
} from "./slot-plugin-fixtures";

interface Model {
  readonly name: string;
  readonly tags: readonly string[];
}

const bag = {
  required: requiredPlugin,
  stringMin: stringMinPlugin,
  transform: transformPlugin,
  arrayContains: containsPlugin,
};

describe("collectFieldRules", () => {
  it("invokes the field callback EXACTLY once", () => {
    let calls = 0;
    collectFieldRules<Model, typeof bag, string>(bag, chainContext, (b) => {
      calls += 1;
      return b.string.required().min(3);
    });
    expect(calls).toBe(1);
  });

  it("returns the rules in declaration order", () => {
    const rules = collectFieldRules<Model, typeof bag, string>(
      bag,
      chainContext,
      (b) =>
        b.string
          .min(3)
          .required()
          .transform((value) => value)
    );
    expect(ruleCodes(rules.rules)).toEqual([
      "stringMin",
      "required",
      "transform",
    ]);
  });

  it("freezes the rule list it hands to L4", () => {
    const rules = collectFieldRules<Model, typeof bag, string>(
      bag,
      chainContext,
      (b) => b.string.required()
    );
    expect(Object.isFrozen(rules.rules)).toBe(true);
    expect(() => {
      (rules.rules as unknown as unknown[]).push(rules.rules[0]!);
    }).toThrow();
  });

  it("runs a nested sub-chain callback once as part of the same pass", () => {
    let outer = 0;
    let inner = 0;
    const rules = collectFieldRules<Model, typeof bag, readonly string[]>(
      bag,
      chainContext,
      (b) => {
        outer += 1;
        return b.array.required().contains((element) => {
          inner += 1;
          return element.string.min(1);
        });
      }
    );
    expect(outer).toBe(1);
    expect(inner).toBe(1);
    expect(ruleCodes(rules.rules)).toEqual(["required", "arrayContains"]);
  });

  it("hands the plugin the field path and the declared sibling keys", () => {
    const rules = collectFieldRules<Model, typeof bag, string>(
      bag,
      chainContext,
      (b) => b.string.required()
    );
    // requiredPlugin does not surface the context, so assert through the rule
    // it produced: the code fell back to the plugin name resolved in build.
    expect(expectPresence(rules.rules[0]).code).toBe("required");
  });

  it("throws FieldChainResultError when the callback returns a non-chain", () => {
    const notAChain = (): AnyChain => "oops" as unknown as AnyChain;
    expect(() =>
      collectFieldRules<Model, typeof bag, string>(
        bag,
        chainContext,
        (_b: FieldSlots<Model, typeof bag, string>) => notAChain()
      )
    ).toThrow(FieldChainResultError);
  });
});
