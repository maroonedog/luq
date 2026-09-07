import { resolveFieldDefault } from "../../../src/builder/resolve-field-default";
import { APPLIES_DEFAULT_TO_NULL_BY_DEFAULT } from "../../../src/compile/compile-field";

describe("resolveFieldDefault", () => {
  it("answers 'no default' when there are no options at all", () => {
    const policy = resolveFieldDefault(undefined);
    expect(policy.defaultOf).toBeNull();
    expect(policy.applyDefaultToNull).toBe(APPLIES_DEFAULT_TO_NULL_BY_DEFAULT);
  });

  it("shares one frozen policy for every field that declares nothing", () => {
    expect(resolveFieldDefault(undefined)).toBe(resolveFieldDefault({}));
    expect(Object.isFrozen(resolveFieldDefault(undefined))).toBe(true);
  });

  it("wraps a literal default into a factory ONCE", () => {
    const policy = resolveFieldDefault<string>({ default: "en" });
    expect(policy.defaultOf?.({})).toBe("en");
    expect(policy.defaultOf?.({ other: 1 })).toBe("en");
  });

  it("keeps a factory default and hands it the root", () => {
    const policy = resolveFieldDefault<string>({
      default: (root) => `from:${String(Object(root).seed)}`,
    });
    expect(policy.defaultOf?.({ seed: 7 })).toBe("from:7");
  });

  it("reads `default: undefined` as 'no default'", () => {
    expect(resolveFieldDefault<string>({ default: undefined }).defaultOf).toBe(
      null
    );
  });

  it("carries applyDefaultToNull even when no default is declared", () => {
    const policy = resolveFieldDefault<string>({ applyDefaultToNull: false });
    expect(policy.defaultOf).toBeNull();
    expect(policy.applyDefaultToNull).toBe(false);
  });

  it("carries applyDefaultToNull alongside a default", () => {
    const policy = resolveFieldDefault<string>({
      default: "en",
      applyDefaultToNull: false,
    });
    expect(policy.defaultOf?.({})).toBe("en");
    expect(policy.applyDefaultToNull).toBe(false);
  });

  it("treats a falsy literal as a real default", () => {
    expect(resolveFieldDefault<number>({ default: 0 }).defaultOf?.({})).toBe(0);
    expect(resolveFieldDefault<string>({ default: "" }).defaultOf?.({})).toBe(
      ""
    );
    expect(
      resolveFieldDefault<boolean>({ default: false }).defaultOf?.({})
    ).toBe(false);
    expect(
      resolveFieldDefault<string | null>({ default: null }).defaultOf?.({})
    ).toBeNull();
  });
});
