// ===========================================================================
// The one thing that separates a registry from a builder: use() is IMMUTABLE.
// Every assertion here is about branching a shared base without contamination,
// and the mutable half — Builder.use() returning its receiver — is asserted in
// the same file so the contrast cannot silently drift.
// ===========================================================================
import { Builder } from "../../../src/builder/field-builder.types";
import type { AnyChain } from "../../../src/chain/field-chain.types";
import { NamelessPluginError } from "../../../src/builder/create-builder";
import { createPluginRegistry } from "../../../src/field-rule/create-plugin-registry";
import {
  numberMinPlugin,
  stringMinPlugin,
} from "../../../src/plugins/check-plugins";
import { requiredPlugin } from "../../../src/plugins/presence-plugins";

const base = () => createPluginRegistry().use(requiredPlugin);

/** `any` deliberately: it reaches a method the bag may not carry, and the
 *  point of the test is what happens at RUNTIME when it does not. */
// eslint-disable-next-line -eslint/no-explicit-any
const usesStringMin = (b: any): AnyChain => b.string.required().min(3);

describe("registry.use() is immutable, builder.use() is not", () => {
  it("returns a NEW registry and leaves the receiver alone", () => {
    const start = base();
    const grown = start.use(stringMinPlugin);
    expect(grown).not.toBe(start);
    expect(Object.keys(start.getPlugins())).toEqual(["required"]);
    expect(Object.keys(grown.getPlugins())).toEqual(["required", "stringMin"]);
  });

  it("Builder.use() MUTATES and hands back the very same object", () => {
    const builder = Builder().use(requiredPlugin);
    expect(builder.use(stringMinPlugin)).toBe(builder);
  });

  it("two branches off one base cannot see each other's plugins", () => {
    const start = base();
    const left = start.use(stringMinPlugin);
    const right = start.use(numberMinPlugin);
    expect(Object.keys(left.getPlugins())).toEqual(["required", "stringMin"]);
    expect(Object.keys(right.getPlugins())).toEqual(["required", "numberMin"]);
  });

  it("the base registry still has no .min() at RUNTIME after a branch", () => {
    const start = base();
    start.use(stringMinPlugin);
    expect(() =>
      start.createFieldRule<string>((b) => usesStringMin(b))
    ).toThrow(TypeError);
  });
});

describe("toBuilder()", () => {
  it("hands out a FRESH builder every call, so mutating one is contained", () => {
    const registry = base().use(stringMinPlugin);
    const first = registry.toBuilder();
    expect(registry.toBuilder()).not.toBe(first);
    first.use(numberMinPlugin);
    expect(Object.keys(registry.getPlugins())).toEqual([
      "required",
      "stringMin",
    ]);
  });
});

describe("registration", () => {
  it("throws NamelessPluginError EAGERLY, at use()", () => {
    expect(() =>
      createPluginRegistry().use({
        name: "",
        method: "x",
        slots: [],
        build: () => {
          throw new Error("unreachable");
        },
      })
    ).toThrow(NamelessPluginError);
  });

  it("drops a duplicate name first-wins", () => {
    const twice = base().use(requiredPlugin);
    expect(Object.keys(twice.getPlugins())).toEqual(["required"]);
    expect(twice.getPlugins()["required"]).toBe(requiredPlugin);
  });
});
