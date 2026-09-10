import { compileDeclarations } from "../../../src/builder/compile-declarations";
import { createSubsetValidator } from "../../../src/builder/create-subset-validator";
import type { FieldEntry } from "../../../src/builder/field-entry.types";
import { check, presence } from "../../../src/plugin-kit/create-rule";
import type { Rule } from "../../../src/plugin-kit/compiled-rule";
import type { ValidationPlan } from "../../../src/compile/validation-plan.types";
import { PASS, fail, isString } from "../../../src/types";

const requiredRule = (): Rule =>
  presence({
    code: "REQUIRED",
    severity: "error",
    allowUndefined: false,
    allowNull: false,
    emptyStringIsMissing: true,
    describe: () => "Value is required",
    buildMessageContext: () => ({}),
  });

const nonEmptyRule = (): Rule =>
  check({
    code: "NON_EMPTY",
    severity: "error",
    run: (value) =>
      isString(value) && value.length > 0
        ? PASS
        : fail({ expected: 1, actual: 0 }),
    describe: () => "must not be empty",
    buildMessageContext: () => ({}),
  });

function entryOf(path: string, rules: readonly Rule[]): FieldEntry {
  return {
    path,
    defaultOf: null,
    applyDefaultToNull: true,
    normalize: null,
    collectRules: () => ({ rules, calls: [] }),
  };
}

const planOf = (): ValidationPlan =>
  compileDeclarations(
    [
      entryOf("title", [requiredRule(), nonEmptyRule()]),
      entryOf("owner.name", [requiredRule(), nonEmptyRule()]),
      entryOf("employees[*].name", [requiredRule(), nonEmptyRule()]),
    ],
    undefined
  ).plan;

describe("createSubsetValidator", () => {
  it("carries a frozen copy of the paths it was asked for", () => {
    const subset = createSubsetValidator(planOf(), ["title"]);
    expect(subset.paths).toEqual(["title"]);
    expect(Object.isFrozen(subset.paths)).toBe(true);
    expect(Object.isFrozen(subset)).toBe(true);
  });

  it("keys the projected data by the DECLARED path string", () => {
    const subset = createSubsetValidator(planOf(), [
      "title",
      "owner.name",
      "employees[*].name",
    ]);
    const outcome = subset.validate({
      title: "Acme",
      owner: { name: "Ada" },
      employees: [{ name: "Bob" }, { name: "Cy" }],
    });
    expect(outcome.valid && outcome.data).toEqual({
      title: "Acme",
      "owner.name": "Ada",
      "employees[*].name": ["Bob", "Cy"],
    });
  });

  it("reports only the issues on the picked paths", () => {
    const subset = createSubsetValidator(planOf(), ["owner.name"]);
    const outcome = subset.validate({
      title: "",
      owner: { name: "" },
      employees: [],
    });
    expect(outcome.valid).toBe(false);
    expect(outcome.issues.map((issue) => issue.path)).toEqual(["owner.name"]);
  });

  it("matches a wildcard pattern against the indexed issue path", () => {
    const subset = createSubsetValidator(planOf(), ["employees[*].name"]);
    const outcome = subset.validate({
      title: "Acme",
      owner: { name: "Ada" },
      employees: [{ name: "Bob" }, { name: "" }],
    });
    expect(outcome.issues.map((issue) => issue.path)).toEqual([
      "employees[1].name",
    ]);
  });

  it("succeeds when every issue belongs to a path it did not pick", () => {
    const subset = createSubsetValidator(planOf(), ["title"]);
    const outcome = subset.validate({
      title: "Acme",
      owner: {},
      employees: [{}],
    });
    expect(outcome.valid).toBe(true);
    expect(outcome.issues).toEqual([]);
  });

  it("ignores the caller's abortEarly so a picked field is always reached", () => {
    const subset = createSubsetValidator(planOf(), ["employees[*].name"]);
    const outcome = subset.validate(
      { title: "", owner: {}, employees: [{ name: "" }] },
      { abortEarly: true }
    );
    expect(outcome.issues.map((issue) => issue.path)).toEqual([
      "employees[0].name",
    ]);
  });

  it("projects undefined for a path the subject does not carry", () => {
    const subset = createSubsetValidator(planOf(), ["title"]);
    const outcome = subset.validate({ title: "Acme" });
    expect(outcome.valid && Object.keys(Object(outcome.data))).toEqual([
      "title",
    ]);
  });
});
