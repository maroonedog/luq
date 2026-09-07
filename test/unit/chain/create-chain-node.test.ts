import { createFieldSlots } from "../../../src/chain/create-field-slots";
import { readChainRules } from "../../../src/chain/create-chain-node";
import type { ChainBuildContext } from "../../../src/chain/create-chain-node";
import { DEFAULT_GLOBAL_CONFIG } from "../../../src/types/global-config";
import {
  chainContext,
  compareFieldPlugin,
  expectCheck,
  numberMinPlugin,
  requiredPlugin,
  ruleCodes,
  stringMinPlugin,
  transformPlugin,
} from "./slot-plugin-fixtures";

interface Model {
  readonly name: string;
  readonly other: string;
}

const bag = {
  stringMin: stringMinPlugin,
  numberMin: numberMinPlugin,
  required: requiredPlugin,
  compareField: compareFieldPlugin,
  transform: transformPlugin,
};

function slots(context: ChainBuildContext = chainContext) {
  return createFieldSlots<Model, typeof bag, string>(bag, context);
}

function rulesOf(chain: unknown) {
  const rules = readChainRules(chain);
  if (rules === undefined) throw new Error("not a chain");
  return rules;
}

describe("createChainNode", () => {
  it("records rules in declaration order", () => {
    const chain = slots().string.required().min(3).compareField("other", "eq");
    expect(ruleCodes(rulesOf(chain))).toEqual([
      "required",
      "stringMin",
      "compareField",
    ]);
  });

  it("returns a NEW frozen node per step and never mutates the receiver", () => {
    const start = slots().string;
    const afterRequired = start.required();
    expect(afterRequired).not.toBe(start);
    expect(Object.isFrozen(afterRequired)).toBe(true);
    expect(rulesOf(start)).toHaveLength(0);
  });

  it("keeps two chains branched from one node apart", () => {
    const start = slots().string.required();
    const left = start.min(3);
    const right = start.compareField("other", "eq");
    expect(ruleCodes(rulesOf(start))).toEqual(["required"]);
    expect(ruleCodes(rulesOf(left))).toEqual(["required", "stringMin"]);
    expect(ruleCodes(rulesOf(right))).toEqual(["required", "compareField"]);
  });

  it("keeps two chains branched from one `b` apart", () => {
    const shared = slots();
    const left = shared.string.required();
    const right = shared.string.min(1);
    expect(ruleCodes(rulesOf(left))).toEqual(["required"]);
    expect(ruleCodes(rulesOf(right))).toEqual(["stringMin"]);
  });

  it("defaults code to the plugin name and severity to the config", () => {
    const rule = expectCheck(rulesOf(slots().string.min(3))[0]);
    expect(rule.code).toBe("stringMin");
    expect(rule.severity).toBe(DEFAULT_GLOBAL_CONFIG.defaultSeverity);
  });

  it("reads code, severity and messageFactory out of the trailing options", () => {
    const chain = slots().string.min(3, {
      code: "NAME_TOO_SHORT",
      severity: "warning",
      messageFactory: () => "custom message",
    });
    const rule = expectCheck(rulesOf(chain)[0]);
    expect(rule.code).toBe("NAME_TOO_SHORT");
    expect(rule.severity).toBe("warning");
    expect(
      rule.describe(
        { expected: 3, actual: 1 },
        { path: "profile.name", value: "a", code: "NAME_TOO_SHORT" }
      )
    ).toBe("custom message");
  });

  it("takes the default severity from the builder's own config", () => {
    const chain = createFieldSlots<Model, typeof bag, string>(bag, {
      ...chainContext,
      config: { ...DEFAULT_GLOBAL_CONFIG, defaultSeverity: "info" },
    }).string.min(3);
    expect(expectCheck(rulesOf(chain)[0]).severity).toBe("info");
  });

  it("separates a DECLARED second argument from the options argument", () => {
    // compareField declares (other, operator); build must receive "gt", and the
    // rule code must stay the plugin name because no options were passed.
    const chain = slots().string.compareField("other", "gt");
    const rule = expectCheck(rulesOf(chain)[0]);
    expect(rule.code).toBe("compareField");
    expect(rule.run("b", { root: { other: "a" }, path: "name" }).ok).toBe(true);
    expect(rule.run("a", { root: { other: "b" }, path: "name" }).ok).toBe(
      false
    );

    const withOptions = slots().string.compareField("other", "gt", {
      code: "CMP",
    });
    expect(expectCheck(rulesOf(withOptions)[0]).code).toBe("CMP");
  });

  it("passes the field path and declared sibling keys into build", () => {
    // stringMin throws PluginArgumentError naming ctx.pluginName on a bad arg.
    expect(() => slots().string.min(-1)).toThrow(/stringMin/);
  });

  it("switches slot on refine* while keeping the rules recorded so far", () => {
    // The JSON Schema `type: ["string","number"]` case: ONE linear chain that
    // carries string keywords and then number keywords. refine* moves the SLOT
    // and leaves the value type where it was.
    const mixed = createFieldSlots<Model, typeof bag, string | number>(
      bag,
      chainContext
    );
    const chain = mixed.any
      .required()
      .refineString()
      .min(3)
      .refineNumber()
      .min(2);
    expect(ruleCodes(rulesOf(chain))).toEqual([
      "required",
      "stringMin",
      "numberMin",
    ]);
  });

  it("readChainRules returns undefined for anything that is not a node", () => {
    expect(readChainRules(undefined)).toBeUndefined();
    expect(readChainRules(null)).toBeUndefined();
    expect(readChainRules({})).toBeUndefined();
    expect(readChainRules("chain")).toBeUndefined();
  });
});
