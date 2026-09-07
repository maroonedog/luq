import {
  buildSlotSurface,
  createFieldSlots,
} from "../../../src/chain/create-field-slots";
import { PluginMethodCollisionError } from "../../../src/chain/attach-slot-methods";
import type { AnyPlugin } from "../../../src/plugin-kit/plugin-definition";
import {
  chainContext,
  numberMinPlugin,
  requiredPlugin,
  stringMinPlugin,
} from "./slot-plugin-fixtures";

interface Model {
  readonly name: string;
}

const bag = {
  stringMin: stringMinPlugin,
  numberMin: numberMinPlugin,
  required: requiredPlugin,
};

describe("createFieldSlots", () => {
  it("offers exactly the nine slots", () => {
    const surface = buildSlotSurface(bag, chainContext);
    expect(Object.keys(surface).sort()).toEqual(
      [
        "any",
        "array",
        "boolean",
        "date",
        "number",
        "object",
        "string",
        "tuple",
        "union",
      ].sort()
    );
  });

  it("gives a plugin a runtime method only on the slots it declares", () => {
    const surface = buildSlotSurface(bag, chainContext);
    const stringSlot = surface["string"];
    const booleanSlot = surface["boolean"];
    expect(typeof stringSlot).toBe("object");
    expect(Object.keys(stringSlot as object).sort()).toContain("min");
    // numberMin's `min` is NOT on the boolean slot, and neither is stringMin's.
    expect(Object.keys(booleanSlot as object)).not.toContain("min");
    expect(Object.keys(booleanSlot as object)).toContain("required");
  });

  it("gives every chain the eight refine* methods", () => {
    const surface = buildSlotSurface(bag, chainContext);
    const keys = Object.keys(surface["boolean"] as object);
    expect(keys).toEqual(
      expect.arrayContaining([
        "refineString",
        "refineNumber",
        "refineBoolean",
        "refineDate",
        "refineArray",
        "refineTuple",
        "refineObject",
        "refineUnion",
      ])
    );
  });

  it("hands out a fresh frozen chain on every slot read", () => {
    const surface = buildSlotSurface(bag, chainContext);
    const first = surface["string"];
    const second = surface["string"];
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("is typed as FieldSlots and builds a real chain through it", () => {
    const slots = createFieldSlots<Model, typeof bag, string>(
      bag,
      chainContext
    );
    const chain = slots.string.required().min(3);
    expect(typeof chain).toBe("object");
  });

  it("reports a colliding bag when the affected slot is touched", () => {
    const duplicate: AnyPlugin = { ...stringMinPlugin, name: "stringMinAlias" };
    const surface = buildSlotSurface(
      { stringMin: stringMinPlugin, stringMinAlias: duplicate },
      chainContext
    );
    expect(() => surface["string"]).toThrow(PluginMethodCollisionError);
  });
});
