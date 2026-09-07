// ===========================================================================
// END TO END: a declaration list in, a ValidationResult out. This is the first
// point in the build where `valid`, `issues` and `data` can be observed
// together, so the contracts that only exist at that level live here.
// ===========================================================================
import { PASS, fail } from "../../../src/types";
import type { MessageContext } from "../../../src/types";
import {
  ROOT_MISSING_CODE,
  ROOT_MISSING_MESSAGE,
  createValidator,
} from "../../../src/runtime/create-validator";
import type { FieldDeclaration } from "../../../src/compile/validation-plan.types";
import {
  makeGate,
  makeTransform,
  optionalRule,
  requiredRule,
} from "../compile/rule-fixtures";
import { makeDetailedCheck } from "./runtime-fixtures";
import { planOf } from "./plan/engine-fixtures";

function validatorFor(declarations: readonly FieldDeclaration[]) {
  return createValidator(planOf(declarations));
}

const failing = (code: string) =>
  makeDetailedCheck({ code, run: () => fail({}) });

describe("valid, issues and data", () => {
  it("reports success with the input as data and no issue", () => {
    const input = { name: "ada" };
    const outcome = validatorFor([
      { path: "name", rules: [requiredRule()] },
    ]).validate(input);
    expect(outcome.valid).toBe(true);
    expect(outcome.issues).toEqual([]);
    if (!outcome.valid) return;
    expect(outcome.data).toBe(input);
  });

  it("reports failure with the path, code, message and severity", () => {
    const outcome = validatorFor([
      {
        path: "user.email",
        rules: [
          makeDetailedCheck({
            code: "stringEmail",
            run: () => fail({ expected: "an email" }),
            describe: (detail, ctx: MessageContext) =>
              `${ctx.path} must be ${String(detail.expected)}`,
          }),
        ],
      },
    ]).validate({ user: { email: "nope" } });
    expect(outcome.valid).toBe(false);
    expect(outcome.issues).toEqual([
      {
        path: "user.email",
        code: "stringEmail",
        message: "user.email must be an email",
        severity: "error",
      },
    ]);
  });

  it("has no `data` member at all on the failure branch", () => {
    const outcome = validatorFor([
      { path: "name", rules: [requiredRule()] },
    ]).validate({});
    expect(outcome.valid).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(outcome, "data")).toBe(false);
  });

  it("stays VALID when the only issue is a warning", () => {
    const outcome = validatorFor([
      {
        path: "name",
        rules: [
          makeDetailedCheck({
            code: "deprecated",
            severity: "warning",
            run: () => fail({}),
          }),
        ],
      },
    ]).validate({ name: "ada" });
    expect(outcome.valid).toBe(true);
    expect(outcome.issues.map((issue) => issue.severity)).toEqual(["warning"]);
  });

  it("short-circuits a null or undefined root to one REQUIRED issue", () => {
    const validator = validatorFor([{ path: "name", rules: [optionalRule()] }]);
    for (const missing of [null, undefined]) {
      const outcome = validator.validate(missing);
      expect(outcome.valid).toBe(false);
      expect(outcome.issues).toEqual([
        {
          path: "",
          code: ROOT_MISSING_CODE,
          message: ROOT_MISSING_MESSAGE,
          severity: "error",
        },
      ]);
    }
    expect(validator.parse(null).valid).toBe(false);
  });
});

describe("the user's callbacks run exactly once", () => {
  it("calls run once and the message factory once, on the failure path", () => {
    let runs = 0;
    let renders = 0;
    const outcome = validatorFor([
      {
        path: "name",
        rules: [
          makeDetailedCheck({
            code: "custom",
            run: () => {
              runs += 1;
              return fail({});
            },
            describe: () => {
              renders += 1;
              return "no";
            },
          }),
        ],
      },
    ]).validate({ name: "ada" });
    expect(runs).toBe(1);
    expect(renders).toBe(1);
    expect(outcome.issues).toHaveLength(1);
  });

  it("never renders a message on the success path", () => {
    let renders = 0;
    validatorFor([
      {
        path: "name",
        rules: [
          makeDetailedCheck({
            code: "custom",
            run: () => PASS,
            describe: () => {
              renders += 1;
              return "no";
            },
          }),
        ],
      },
    ]).validate({ name: "ada" });
    expect(renders).toBe(0);
  });

  it("does not swallow a check that throws", () => {
    expect(() =>
      validatorFor([
        {
          path: "name",
          rules: [
            makeDetailedCheck({
              code: "explodes",
              run: () => {
                throw new Error("plugin bug");
              },
            }),
          ],
        },
      ]).validate({ name: "ada" })
    ).toThrow("plugin bug");
  });
});

describe("validate never transforms and never mutates", () => {
  const declarations: readonly FieldDeclaration[] = [
    { path: "name", rules: [makeTransform((v) => String(v).toUpperCase())] },
    { path: "role", rules: [], defaultOf: () => "guest" },
    { path: "tags[*]", rules: [makeTransform((v) => `#${String(v)}`)] },
  ];

  it("hands back the very object it was given", () => {
    const input = { name: "ada", tags: ["x"] };
    const before = JSON.stringify(input);
    const outcome = validatorFor(declarations).validate(input);
    expect(outcome.valid).toBe(true);
    if (!outcome.valid) return;
    expect(outcome.data).toBe(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("still judges the DEFAULTED value, so validate and parse agree", () => {
    const outcome = validatorFor([
      {
        path: "role",
        rules: [requiredRule()],
        defaultOf: () => "guest",
      },
    ]).validate({});
    expect(outcome.valid).toBe(true);
  });
});

describe("parse transforms in declaration order, copy-on-write", () => {
  it("applies the transforms and leaves the input untouched", () => {
    const input = { name: "  ada  ", tags: ["x", "y"], keep: { deep: 1 } };
    const outcome = validatorFor([
      {
        path: "name",
        rules: [
          makeTransform((v) => String(v).trim()),
          makeTransform((v) => String(v).toUpperCase()),
        ],
      },
      { path: "tags[*]", rules: [makeTransform((v) => `#${String(v)}`)] },
    ]).parse(input);
    expect(outcome.valid).toBe(true);
    if (!outcome.valid) return;
    expect(outcome.data).toEqual({
      name: "ADA",
      tags: ["#x", "#y"],
      keep: { deep: 1 },
    });
    expect(input).toEqual({
      name: "  ada  ",
      tags: ["x", "y"],
      keep: { deep: 1 },
    });
  });

  it("keeps untouched siblings at their original identity", () => {
    const keep = { deep: 1 };
    const input = { name: "ada", keep };
    const outcome = validatorFor([
      { path: "name", rules: [makeTransform(() => "ADA")] },
    ]).parse(input);
    expect(outcome.valid).toBe(true);
    if (!outcome.valid) return;
    expect(outcome.data).not.toBe(input);
    expect((outcome.data as { keep: unknown }).keep).toBe(keep);
  });

  it("writes the field default", () => {
    const outcome = validatorFor([
      { path: "role", rules: [], defaultOf: () => "guest" },
    ]).parse({ name: "ada" });
    expect(outcome.valid).toBe(true);
    if (!outcome.valid) return;
    expect(outcome.data).toEqual({ name: "ada", role: "guest" });
  });

  it("skips the writer ENTIRELY when the plan writes nothing", () => {
    const input = { name: "ada", items: [{ a: 1 }] };
    const outcome = validatorFor([
      { path: "name", rules: [requiredRule()] },
      { path: "items[*].a", rules: [requiredRule()] },
    ]).parse(input);
    expect(outcome.valid).toBe(true);
    if (!outcome.valid) return;
    expect(outcome.data).toBe(input);
  });

  it("does not transform a field whose check failed", () => {
    let applied = 0;
    const outcome = validatorFor([
      {
        path: "name",
        rules: [
          failing("tooShort"),
          makeTransform(() => {
            applied += 1;
            return "X";
          }),
        ],
      },
    ]).parse({ name: "a" });
    expect(applied).toBe(0);
    expect(outcome.valid).toBe(false);
  });

  it("does not transform behind a closed gate", () => {
    const outcome = validatorFor([
      {
        path: "name",
        rules: [makeGate("validateIf", () => false), makeTransform(() => "X")],
      },
    ]).parse({ name: "ada" });
    expect(outcome.valid).toBe(true);
    if (!outcome.valid) return;
    expect(outcome.data).toEqual({ name: "ada" });
  });
});

describe("options reach the run", () => {
  it("honours abortEarly and abortEarlyOnEachField", () => {
    const validator = validatorFor([
      { path: "a", rules: [failing("a1"), failing("a2")] },
      { path: "b", rules: [failing("b1")] },
    ]);
    const input = { a: 1, b: 2 };
    expect(validator.validate(input).issues.map((i) => i.code)).toEqual(["a1"]);
    expect(
      validator.validate(input, { abortEarly: false }).issues.map((i) => i.code)
    ).toEqual(["a1", "b1"]);
    expect(
      validator
        .validate(input, { abortEarly: false, abortEarlyOnEachField: false })
        .issues.map((i) => i.code)
    ).toEqual(["a1", "a2", "b1"]);
  });

  it("forwards `external` to RuleContext.external unchanged", () => {
    const seen: unknown[] = [];
    const external = { tenant: "acme" };
    validatorFor([
      {
        path: "name",
        rules: [
          makeDetailedCheck({
            code: "observe",
            run: (_value, ctx) => {
              seen.push(ctx.external);
              return PASS;
            },
          }),
        ],
      },
    ]).validate({ name: "ada" }, { external });
    expect(seen).toEqual([external]);
  });
});

describe("the two closures are built once", () => {
  it("allocates no closure per call: the pair is stable across runs", () => {
    const validator = validatorFor([{ path: "name", rules: [requiredRule()] }]);
    const first = validator.validate;
    validator.validate({ name: "ada" });
    validator.validate({ name: "ada" });
    expect(validator.validate).toBe(first);
  });

  it("gives the same answer however many times it is run", () => {
    const validator = validatorFor([{ path: "name", rules: [requiredRule()] }]);
    const first = validator.validate({});
    const second = validator.validate({});
    expect(second).toEqual(first);
  });
});
