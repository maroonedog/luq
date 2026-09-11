import { compileDeclarations } from "../../../src/builder/compile-declarations";
import { createPlanBackedValidator } from "../../../src/builder/create-plan-validator";
import type { FieldEntry } from "../../../src/builder/field-entry.types";
import { presence, transform } from "../../../src/plugin-kit/create-rule";
import type { Rule } from "../../../src/plugin-kit/compiled-rule";

function entryOf(
  path: string,
  rules: readonly Rule[],
  defaultOf: ((root: unknown) => unknown) | null = null
): FieldEntry {
  return {
    path,
    defaultOf,
    applyDefaultToNull: true,
    normalize: null,
    collectRules: () => ({ rules, calls: [] }),
  };
}

const requiredRule = (): Rule =>
  presence({
    // A code this fixture invents, deliberately not the library's own: the
    // two were the same string, which is how a stale assertion on the root
    // code went on looking right.
    code: "fixtureRequired",
    severity: "error",
    allowUndefined: false,
    allowNull: false,
    emptyStringIsMissing: true,
    describe: () => "Value is required",
    buildMessageContext: () => ({}),
  });

const upperCaseRule = (): Rule =>
  transform((value) => String(value).toUpperCase());

const validatorOf = (entries: readonly FieldEntry[]) => {
  // The config comes back from the same call that produced the plan: the root
  // short-circuit reports wording that is settled at build time, so the two
  // travel together rather than the validator resolving a second copy.
  const compiled = compileDeclarations(entries, undefined);
  return createPlanBackedValidator(compiled.plan, compiled.config);
};

describe("createPlanBackedValidator", () => {
  it("returns a frozen object with the four documented members", () => {
    const validator = validatorOf([entryOf("name", [requiredRule()])]);
    expect(Object.isFrozen(validator)).toBe(true);
    expect(Object.keys(validator).sort()).toEqual([
      "parse",
      "pick",
      "pickAll",
      "validate",
    ]);
  });

  it("rejects a null or undefined subject before the plan runs", () => {
    const validator = validatorOf([entryOf("name", [requiredRule()])]);
    for (const subject of [null, undefined]) {
      const outcome = validator.validate(subject);
      expect(outcome.valid).toBe(false);
      // `required`, the spelling a missing FIELD reports. It was "REQUIRED"
      // here, carried over from 1.x, so the same condition had two spellings
      // depending on how much of the value was absent.
      expect(outcome.issues.map((issue) => issue.code)).toEqual(["required"]);
      expect(outcome.issues.map((issue) => issue.path)).toEqual([""]);
    }
  });

  it("hands back the caller's object by identity when nothing is written", () => {
    const validator = validatorOf([entryOf("name", [requiredRule()])]);
    const subject = { name: "Ada" };
    const validated = validator.validate(subject);
    const parsed = validator.parse(subject);
    expect(validated.valid && validated.data).toBe(subject);
    expect(parsed.valid && parsed.data).toBe(subject);
  });

  it("keeps validate() free of the transform parse() applies", () => {
    const validator = validatorOf([
      entryOf("name", [requiredRule(), upperCaseRule()]),
    ]);
    expect(validator.validate({ name: "ada" })).toMatchObject({
      valid: true,
      data: { name: "ada" },
    });
    expect(validator.parse({ name: "ada" })).toMatchObject({
      valid: true,
      data: { name: "ADA" },
    });
  });

  it("writes a default only in parse(), and judges it in both", () => {
    const validator = validatorOf([
      entryOf("language", [requiredRule()], () => "en"),
    ]);
    expect(validator.validate({})).toMatchObject({ valid: true, data: {} });
    expect(validator.parse({})).toMatchObject({
      valid: true,
      data: { language: "en" },
    });
  });

  it("builds a NEW pick() per call, pre-resolved to its path", () => {
    const validator = validatorOf([entryOf("name", [requiredRule()])]);
    const first = validator.pick("name");
    expect(validator.pick("name")).not.toBe(first);
    expect(first.path).toBe("name");
    expect(first.validate("Ada").valid).toBe(true);
    expect(first.validate("").valid).toBe(false);
  });

  it("builds a pickAll() carrying the paths it was given", () => {
    const validator = validatorOf([
      entryOf("name", [requiredRule()]),
      entryOf("city", [requiredRule()]),
    ]);
    expect(validator.pickAll(["name", "city"]).paths).toEqual(["name", "city"]);
  });
});
