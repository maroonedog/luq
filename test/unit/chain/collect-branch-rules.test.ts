import {
  buildSlotSurface,
  createFieldSlots,
} from "../../../src/chain/create-field-slots";
import { readChainRules } from "../../../src/chain/create-chain-node";
import {
  collectBranchRules,
  SubChainResultError,
} from "../../../src/chain/collect-branch-rules";
import type { Rule } from "../../../src/plugin-kit/compiled-rule";
import { PASS } from "../../../src/types";
import {
  builderPlugin,
  chainContext,
  declaredRules,
  containsPlugin,
  expectComposite,
  expectGate,
  expectTransform,
  guardPlugin,
  patternPropertiesPlugin,
  requiredPlugin,
  ruleCodes,
  ruleContext,
  stringMinPlugin,
  transformPlugin,
  validateIfPlugin,
} from "./slot-plugin-fixtures";

interface Model {
  readonly tags: readonly string[];
  readonly pair: readonly [string, string];
  readonly meta: { readonly alpha: string };
  readonly mixed: string | number;
}

const bag = {
  required: requiredPlugin,
  stringMin: stringMinPlugin,
  transform: transformPlugin,
  validateIf: validateIfPlugin,
  arrayContains: containsPlugin,
  unionGuard: guardPlugin,
  tupleBuilder: builderPlugin,
  objectPatternProperties: patternPropertiesPlugin,
};

function rulesOf(chain: unknown): readonly Rule[] {
  const rules = readChainRules(chain);
  if (rules === undefined) throw new Error("not a chain");
  // Without the type check the slot seeds, so `[0]` is the rule the method
  // under test built. slot-type-guard.test.ts asserts the seed.
  return declaredRules(rules);
}

describe("collectBranchRules", () => {
  it("runs a sub-chain callback exactly once and freezes the rules", () => {
    let calls = 0;
    const rules = collectBranchRules(
      bag,
      chainContext,
      (slots) => {
        calls += 1;
        const surface = slots as Record<string, { required(): unknown }>;
        return surface["string"]!.required();
      },
      buildSlotSurface
    );
    expect(calls).toBe(1);
    expect(ruleCodes(rules)).toEqual(["required"]);
    expect(Object.isFrozen(rules)).toBe(true);
  });

  it("throws SubChainResultError when the callback returns a non-chain", () => {
    expect(() =>
      collectBranchRules(bag, chainContext, () => 42, buildSlotSurface)
    ).toThrow(SubChainResultError);
  });
});

describe("sub-chain arguments through a chain method", () => {
  it("hands the plugin an EAGER frozen Rule[], not a thunk, after ONE call", () => {
    let calls = 0;
    const slots = createFieldSlots<Model, typeof bag, readonly string[]>(
      bag,
      chainContext
    );
    const chain = slots.array.contains((element) => {
      calls += 1;
      return element.string.required().min(2);
    });
    expect(calls).toBe(1);

    const composite = expectComposite(rulesOf(chain)[0]);
    const branch = composite.branches[0]!;
    expect(branch.label).toBe("contains");
    expect(Array.isArray(branch.rules)).toBe(true);
    expect(Object.isFrozen(branch.rules)).toBe(true);
    expect(ruleCodes(branch.rules)).toEqual(["required", "stringMin"]);
  });

  it("does NOT convert an ordinary function argument into rules", () => {
    let seenRoot: unknown;
    const slots = createFieldSlots<Model, typeof bag, readonly string[]>(
      bag,
      chainContext
    );
    const chain = slots.array.validateIf((root) => {
      seenRoot = root;
      return true;
    });
    const gate = expectGate(rulesOf(chain)[0]);
    expect(seenRoot).toBeUndefined();
    expect(gate.shouldRun([], { root: { marker: 1 }, path: "tags" })).toBe(
      true
    );
    expect(seenRoot).toEqual({ marker: 1 });
  });

  it("leaves a transform's map callback untouched and unrun until validation", () => {
    let calls = 0;
    const slots = createFieldSlots<Model, typeof bag, readonly string[]>(
      bag,
      chainContext
    );
    const chain = slots.array.transform((value) => {
      calls += 1;
      return value;
    });
    expect(calls).toBe(0);
    const rule = expectTransform(rulesOf(chain)[0]);
    rule.apply(["a"], ruleContext);
    expect(calls).toBe(1);
  });

  it("separates a declared optional argument from the trailing options", () => {
    const slots = createFieldSlots<Model, typeof bag, readonly string[]>(
      bag,
      chainContext
    );
    const withBounds = slots.array.contains(
      (element) => element.string.required(),
      { min: 2 }
    );
    const bounded = expectComposite(rulesOf(withBounds)[0]);
    expect(bounded.code).toBe("arrayContains");
    const execute = bounded.combine([
      {
        label: "contains",
        run: (value) => (value === "x" ? PASS : { ok: false, detail: {} }),
      },
    ]);
    // min came through as a DECLARED argument, so one match is not enough.
    expect(execute(["x"], ruleContext).ok).toBe(false);
    expect(execute(["x", "x"], ruleContext).ok).toBe(true);

    const withOptions = slots.array.contains(
      (element) => element.string.required(),
      { min: 2 },
      { code: "NEEDS_TWO" }
    );
    expect(expectComposite(rulesOf(withOptions)[0]).code).toBe("NEEDS_TWO");
  });

  it("resolves a LIST of sub-chains and an omitted optional one", () => {
    const calls: string[] = [];
    const slots = createFieldSlots<
      Model,
      typeof bag,
      readonly [string, string]
    >(bag, chainContext);
    const chain = slots.tuple.builder([
      (element) => {
        calls.push("0");
        return element.string.required();
      },
      (element) => {
        calls.push("1");
        return element.string.min(4);
      },
    ]);
    expect(calls).toEqual(["0", "1"]);
    const composite = expectComposite(rulesOf(chain)[0]);
    expect(composite.branches.map((entry) => entry.label)).toEqual([
      "position:0",
      "position:1",
    ]);
    expect(ruleCodes(composite.branches[0]!.rules)).toEqual(["required"]);
    expect(ruleCodes(composite.branches[1]!.rules)).toEqual(["stringMin"]);
  });

  it("resolves a KEYED set of sub-chains", () => {
    const slots = createFieldSlots<
      Model,
      typeof bag,
      { readonly alpha: string }
    >(bag, chainContext);
    const chain = slots.object.patternProperties({
      "^a": (property) => property.string.required(),
      "^b": (property) => property.string.min(2),
    });
    const composite = expectComposite(rulesOf(chain)[0]);
    expect(composite.branches.map((entry) => entry.label)).toEqual([
      "^a",
      "^b",
    ]);
    expect(ruleCodes(composite.branches[0]!.rules)).toEqual(["required"]);
    expect(ruleCodes(composite.branches[1]!.rules)).toEqual(["stringMin"]);
  });

  it("runs the guard's sub-builder once against slots from the SAME bag", () => {
    let calls = 0;
    let slotNames: readonly string[] = [];
    const slots = createFieldSlots<Model, typeof bag, string | number>(
      bag,
      chainContext
    );
    const chain = slots.union.guard(
      (value): value is string => typeof value === "string",
      (narrowed) => {
        calls += 1;
        slotNames = Object.keys(narrowed);
        return narrowed.string.required().min(2);
      }
    );
    expect(calls).toBe(1);
    expect([...slotNames].sort()).toEqual([
      "any",
      "array",
      "boolean",
      "date",
      "number",
      "object",
      "string",
      "tuple",
      "union",
    ]);

    const composite = expectComposite(rulesOf(chain)[0]);
    expect(composite.branches[0]!.label).toBe("guard");
    expect(ruleCodes(composite.branches[0]!.rules)).toEqual([
      "required",
      "stringMin",
    ]);

    // Argument 1 stayed a predicate: the composite skips a non-string.
    const execute = composite.combine([
      { label: "guard", run: () => ({ ok: false, detail: {} }) },
    ]);
    expect(execute(7, ruleContext).ok).toBe(true);
    expect(execute("hi", ruleContext).ok).toBe(false);
  });
});
