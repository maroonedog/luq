// ===========================================================================
// objectPlugin is deprecated and, in a chain, unreachable: entering `b.object`
// seeds the same check under `objectType`, and the seed runs first.
//
// These tests are in two halves on purpose. The first asserts what a CALLER
// sees, which is the slot's verdict — that is the behaviour that has to keep
// working while the plugin is on its way out. The second builds the rule
// directly and asserts it still decides what it always decided, so the export
// cannot rot silently in the meantime.
// ===========================================================================
import { Builder } from "../../../../src/index";
import { objectPlugin } from "../../../../src/plugins/object";
import { DEFAULT_GLOBAL_CONFIG } from "../../../../src/types/global-config";

type Bag = { readonly config: Record<string, unknown> };

const validator = Builder()
  .use(objectPlugin)
  .for<Bag>()
  .v("config", (b) => b.object.object())
  .build();

describe("object, through a chain", () => {
  it("accepts a plain object", () => {
    expect(validator.validate({ config: {} }).valid).toBe(true);
    expect(validator.validate({ config: { a: 1 } }).valid).toBe(true);
  });

  it("rejects an array, which typeof calls an object", () => {
    const result = validator.validate({ config: [] });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Value must be an object",
    ]);
  });

  it("rejects a primitive", () => {
    expect(validator.validate({ config: "x" }).valid).toBe(false);
    expect(validator.validate({ config: 1 }).valid).toBe(false);
  });

  it("reports the slot's code, because the slot decided first", () => {
    // It was `object` while the slot seeded nothing. The verdict is the same;
    // the code is the one the slot reports for every object field, declared or
    // not, which is the point of moving the decision there.
    expect(
      validator.validate({ config: 1 }).issues.map((issue) => issue.code)
    ).toEqual(["objectType"]);
  });

  it("reports it once, not once per rule", () => {
    expect(
      validator.validate(
        { config: 1 },
        { abortEarly: false, abortEarlyOnEachField: false }
      ).issues
    ).toHaveLength(1);
  });

  // required / optional / nullable own absence: a check never sees undefined.
  it("leaves an absent value to the presence rules", () => {
    expect(validator.validate({}).valid).toBe(true);
    expect(validator.validate({ config: null }).valid).toBe(true);
  });
});

describe("the deprecated rule itself", () => {
  const rule = objectPlugin.build({
    pluginName: "object",
    code: "object",
    severity: DEFAULT_GLOBAL_CONFIG.defaultSeverity,
    messageFactory: undefined,
    config: DEFAULT_GLOBAL_CONFIG,
    fieldPath: "config",
    declaredSiblingKeys: [],
  });
  const context = { root: {}, path: "config" };

  it("is inert: it answers PASS for everything, including what it used to reject", () => {
    // Deprecated means inert, not second opinion. Answering again would give a
    // caller collecting every issue TWO for one bad value, which is the
    // duplication the slot exists to prevent.
    if (rule.kind !== "check") throw new Error("expected a check rule");
    for (const value of [{}, { a: 1 }, [], "x", 1, true]) {
      expect(rule.run(value, context).ok).toBe(true);
    }
  });
});
