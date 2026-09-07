import {
  attachSlotMethods,
  CHAIN_BUILT_IN_OWNER,
  PluginMethodCollisionError,
} from "../../../src/chain/attach-slot-methods";
import type { AnyPlugin } from "../../../src/plugin-kit/plugin-definition";
import type { PluginBag } from "../../../src/chain/plugin-bag.types";
import {
  numberMinPlugin,
  requiredPlugin,
  stringMinPlugin,
} from "./slot-plugin-fixtures";

function installedNames(
  bag: PluginBag,
  slot: Parameters<typeof attachSlotMethods>[2]
): string[] {
  const target: Record<string, unknown> = {};
  attachSlotMethods(target, bag, slot, () => () => undefined);
  return Object.keys(target).sort();
}

describe("attachSlotMethods", () => {
  it("installs a method only for the plugins that serve the slot", () => {
    const bag = { stringMin: stringMinPlugin, numberMin: numberMinPlugin };
    expect(installedNames(bag, "string")).toEqual(["min"]);
    expect(installedNames(bag, "number")).toEqual(["min"]);
    expect(installedNames(bag, "boolean")).toEqual([]);
  });

  it("does not treat the same method on two different slots as a clash", () => {
    // stringMin and numberMin BOTH publish `min`; they never meet on one slot.
    const bag = {
      stringMin: stringMinPlugin,
      numberMin: numberMinPlugin,
      required: requiredPlugin,
    };
    expect(installedNames(bag, "string")).toEqual(["min", "required"]);
    expect(installedNames(bag, "date")).toEqual(["required"]);
  });

  it("hands the installed method the plugin it belongs to", () => {
    const seen: string[] = [];
    const target: Record<string, unknown> = {};
    attachSlotMethods(
      target,
      { stringMin: stringMinPlugin, required: requiredPlugin },
      "string",
      (plugin) => {
        seen.push(plugin.name);
        return () => undefined;
      }
    );
    expect(seen.sort()).toEqual(["required", "stringMin"]);
  });

  it("throws PluginMethodCollisionError naming BOTH plugins", () => {
    const duplicate: AnyPlugin = { ...stringMinPlugin, name: "stringMinAlias" };
    const bag = { stringMin: stringMinPlugin, stringMinAlias: duplicate };
    let thrown: unknown;
    try {
      installedNames(bag, "string");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(PluginMethodCollisionError);
    const collision = thrown as PluginMethodCollisionError;
    expect(collision.methodName).toBe("min");
    expect(collision.slot).toBe("string");
    expect(
      [collision.firstPluginName, collision.secondPluginName].sort()
    ).toEqual(["stringMin", "stringMinAlias"]);
    expect(collision.message).toContain("stringMin");
    expect(collision.message).toContain("stringMinAlias");
  });

  it("protects the eight built-in refine* names from a plugin", () => {
    const intruder: AnyPlugin = {
      ...stringMinPlugin,
      name: "intruder",
      method: "refineString",
    };
    expect(() => installedNames({ intruder }, "string")).toThrow(
      PluginMethodCollisionError
    );
    try {
      installedNames({ intruder }, "string");
    } catch (error) {
      const collision = error as PluginMethodCollisionError;
      expect(collision.firstPluginName).toBe(CHAIN_BUILT_IN_OWNER);
      expect(collision.secondPluginName).toBe("intruder");
    }
  });
});
