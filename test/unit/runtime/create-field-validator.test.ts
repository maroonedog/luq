// ===========================================================================
// pick(): one declared path, on the same plan. The two legacy defects this
// closes are asserted directly — an unrelated field's failure must not hide
// the picked one, and a wildcard path must actually reach its rules.
// ===========================================================================
import { fail } from "../../../src/types";
import { createFieldValidator } from "../../../src/runtime/create-field-validator";
import { PathSyntaxError } from "../../../src/path/reserved-segment";
import type { FieldDeclaration } from "../../../src/compile/validation-plan.types";
import { makeCheck, requiredRule } from "../compile/rule-fixtures";
import { makeDetailedCheck } from "./runtime-fixtures";
import { planOf } from "./plan/engine-fixtures";

const tooShort = (code: string) =>
  makeDetailedCheck({
    code,
    run: (value) =>
      String(value).length < 3 ? fail({ actual: value }) : { ok: true },
  });

const SCHEMA: readonly FieldDeclaration[] = [
  { path: "name", rules: [requiredRule(), tooShort("stringMin")] },
  { path: "email", rules: [requiredRule()] },
  { path: "employees[*].name", rules: [requiredRule(), tooShort("stringMin")] },
];

function pick(path: string) {
  return createFieldValidator(planOf(SCHEMA), path);
}

describe("one path, judged on its own", () => {
  it("carries the path it was picked by", () => {
    expect(pick("name").path).toBe("name");
  });

  it("accepts a value that satisfies the field's rules", () => {
    const outcome = pick("name").validate("ada");
    expect(outcome.valid).toBe(true);
    if (!outcome.valid) return;
    expect(outcome.data).toBe("ada");
  });

  it("rejects with only the picked field's issues", () => {
    const outcome = pick("name").validate("ad");
    expect(outcome.valid).toBe(false);
    expect(outcome.issues).toHaveLength(1);
    expect(outcome.issues[0]?.path).toBe("name");
    expect(outcome.issues[0]?.code).toBe("stringMin");
  });

  it("does NOT report the other declared fields", () => {
    const outcome = pick("name").validate("ada");
    expect(outcome.valid).toBe(true);
    expect(outcome.issues).toEqual([]);
  });

  it("is not hidden by an unrelated field failing first", () => {
    const declarations: readonly FieldDeclaration[] = [
      { path: "first", rules: [requiredRule()] },
      { path: "second", rules: [requiredRule()] },
    ];
    const outcome = createFieldValidator(
      planOf(declarations),
      "second"
    ).validate(undefined);
    expect(outcome.valid).toBe(false);
    expect(outcome.issues.map((issue) => issue.path)).toEqual(["second"]);
  });
});

describe("siblings", () => {
  it("lets a cross-field rule read the rest of the object", () => {
    const seen: unknown[] = [];
    const declarations: readonly FieldDeclaration[] = [
      {
        path: "confirm",
        rules: [
          makeCheck("compareField", (value, ctx) => {
            seen.push(ctx.root);
            return value === (ctx.root as { password?: unknown }).password
              ? { ok: true }
              : fail({ expected: "password" });
          }),
        ],
      },
    ];
    const validator = createFieldValidator(planOf(declarations), "confirm");
    expect(validator.validate("s3cret", { password: "s3cret" }).valid).toBe(
      true
    );
    expect(validator.validate("other", { password: "s3cret" }).valid).toBe(
      false
    );
    expect(seen[0]).toEqual({ password: "s3cret", confirm: "s3cret" });
  });

  it("does not destroy the siblings it was handed", () => {
    const siblings = { email: "a@b.c" };
    pick("name").validate("ada", siblings);
    expect(siblings).toEqual({ email: "a@b.c" });
  });

  it("keeps a sibling that shares the picked field's parent", () => {
    const declarations: readonly FieldDeclaration[] = [
      {
        path: "user.name",
        rules: [
          makeCheck("seesSibling", (_value, ctx) => {
            const root = ctx.root as { user?: { age?: unknown } };
            return root.user?.age === 30 ? { ok: true } : fail({});
          }),
        ],
      },
    ];
    const outcome = createFieldValidator(
      planOf(declarations),
      "user.name"
    ).validate("ada", { user: { age: 30 } });
    expect(outcome.valid).toBe(true);
  });
});

describe("a wildcard path", () => {
  it("reaches the element rules and reports at index 0", () => {
    const outcome = pick("employees[*].name").validate("ad");
    expect(outcome.valid).toBe(false);
    expect(outcome.issues.map((issue) => issue.path)).toEqual([
      "employees[0].name",
    ]);
  });

  it("accepts a value the element rules allow", () => {
    expect(pick("employees[*].name").validate("ada").valid).toBe(true);
  });

  it("reports nothing from the sibling top-level fields", () => {
    const outcome = pick("employees[*].name").validate("ada");
    expect(outcome.issues).toEqual([]);
  });
});

describe("a malformed path", () => {
  it("throws at PICK time, naming the path", () => {
    expect(() => pick("a..b")).toThrow(PathSyntaxError);
    expect(() => pick("__proto__.x")).toThrow(PathSyntaxError);
  });
});
