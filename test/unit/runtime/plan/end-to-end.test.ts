// ===========================================================================
// One schema that uses every rule kind at once, validated and parsed. Each of
// the pieces has its own unit test; what this file proves is that they compose
// — that presence, gates, checks, a composite, transforms, defaults, arrays and
// recursion all reach the same value in the documented order.
// ===========================================================================
import { PASS, fail } from "../../../../src/types";
import type { MessageContext, RuleContext } from "../../../../src/types";
import { createValidator } from "../../../../src/runtime/create-validator";
import type { FieldDeclaration } from "../../../../src/compile/validation-plan.types";
import {
  makeGate,
  makeRecursive,
  makeTransform,
  optionalRule,
  requiredRule,
} from "../../compile/rule-fixtures";
import { makeDetailedCheck } from "../runtime-fixtures";
import { branchOf, compositeOf, planOf } from "./engine-fixtures";

const minLength = (limit: number) =>
  makeDetailedCheck({
    code: "stringMin",
    run: (value) =>
      String(value).length >= limit
        ? PASS
        : fail({ expected: limit, actual: String(value).length }),
    describe: (detail, ctx: MessageContext) =>
      `${ctx.path} must be at least ${String(detail.expected)} characters, got ${String(detail.actual)}`,
  });

const matchesOneBranch = (
  runners: readonly { run(v: unknown, c: RuleContext): { ok: boolean } }[]
) => runners;

const SCHEMA: readonly FieldDeclaration[] = [
  { path: "name", rules: [requiredRule(), minLength(3)] },
  { path: "nickname", rules: [optionalRule(), minLength(3)] },
  { path: "role", rules: [requiredRule()], defaultOf: () => "member" },
  {
    path: "bio",
    rules: [
      makeGate("validateIf", (value) => value !== ""),
      minLength(10),
      makeTransform((value) => String(value).trim()),
    ],
  },
  {
    path: "kind",
    rules: [
      compositeOf(
        "oneOfSchema",
        [
          branchOf("#0", [], [{ path: "tag", rules: [requiredRule()] }]),
          branchOf("#1", [], [{ path: "code", rules: [requiredRule()] }]),
        ],
        (runners) => (value, ctx) => {
          const matched = matchesOneBranch(runners).filter(
            (runner) => runner.run(value, ctx).ok
          ).length;
          return matched === 1 ? PASS : fail({ expected: 1, actual: matched });
        }
      ),
    ],
  },
  {
    path: "tags[*]",
    rules: [requiredRule(), makeTransform((v) => String(v).toLowerCase())],
  },
  { path: "teams[*].members[*].email", rules: [requiredRule(), minLength(5)] },
  { path: "manager", rules: [makeRecursive("recursively", 3)] },
];

const validator = createValidator(planOf(SCHEMA));

const GOOD = {
  name: "ada",
  role: undefined,
  bio: "  a long enough biography  ",
  kind: { tag: "person" },
  tags: ["Alpha", "BETA"],
  teams: [{ members: [{ email: "a@b.co" }] }],
  manager: { name: "grace", kind: { code: 7 }, role: "boss" },
};

describe("the whole schema, valid input", () => {
  it("validates without a single issue", () => {
    const outcome = validator.validate(GOOD, { abortEarly: false });
    expect(outcome.issues).toEqual([]);
    expect(outcome.valid).toBe(true);
  });

  it("validate hands back the input by identity", () => {
    const outcome = validator.validate(GOOD);
    expect(outcome.valid).toBe(true);
    if (!outcome.valid) return;
    expect(outcome.data).toBe(GOOD);
  });

  it("parse applies the default, the transforms and the element transforms", () => {
    const outcome = validator.parse(GOOD);
    expect(outcome.valid).toBe(true);
    if (!outcome.valid) return;
    expect(outcome.data).toEqual({
      ...GOOD,
      role: "member",
      bio: "a long enough biography",
      tags: ["alpha", "beta"],
    });
  });

  it("parse leaves the caller's object exactly as it was", () => {
    validator.parse(GOOD);
    expect(GOOD.tags).toEqual(["Alpha", "BETA"]);
    expect(GOOD.bio).toBe("  a long enough biography  ");
    expect(GOOD.role).toBe(undefined);
  });

  it("parse keeps untouched branches at their original identity", () => {
    const outcome = validator.parse(GOOD);
    expect(outcome.valid).toBe(true);
    if (!outcome.valid) return;
    expect((outcome.data as typeof GOOD).teams).toBe(GOOD.teams);
  });
});

describe("the whole schema, broken input", () => {
  const BAD = {
    name: "a",
    nickname: "x",
    bio: "short",
    kind: {},
    tags: ["ok", undefined],
    teams: [{ members: [{ email: "a@b" }, {}] }],
    manager: { name: "x" },
  };

  it("reports every field, each under its own path and code", () => {
    const outcome = validator.validate(BAD, { abortEarly: false });
    expect(outcome.valid).toBe(false);
    expect(
      outcome.issues.map((issue) => `${issue.path}:${issue.code}`)
    ).toEqual([
      "name:stringMin",
      "nickname:stringMin",
      "bio:stringMin",
      "kind:oneOfSchema",
      "manager.name:stringMin",
      "tags[1]:required",
      "teams[0].members[0].email:stringMin",
      "teams[0].members[1].email:required",
    ]);
  });

  it("does not report `role`, because its default satisfied required()", () => {
    const outcome = validator.validate(BAD, { abortEarly: false });
    expect(outcome.issues.some((issue) => issue.path === "role")).toBe(false);
    const withoutDefault = createValidator(
      planOf([{ path: "role", rules: [requiredRule()] }])
    ).validate(BAD, { abortEarly: false });
    expect(withoutDefault.issues.map((issue) => issue.path)).toEqual(["role"]);
  });

  it("renders each message once, from the rule that failed", () => {
    const outcome = validator.validate(BAD, { abortEarly: false });
    expect(outcome.issues[0]?.message).toBe(
      "name must be at least 3 characters, got 1"
    );
  });

  it("stops at the first failing field with the default options", () => {
    const outcome = validator.validate(BAD);
    expect(outcome.issues.map((issue) => issue.path)).toEqual(["name"]);
  });

  it("parse rejects and produces no data at all", () => {
    const outcome = validator.parse(BAD);
    expect(outcome.valid).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(outcome, "data")).toBe(false);
  });

  it("skips the gated field when the gate is closed", () => {
    const outcome = validator.validate(
      { ...BAD, bio: "" },
      { abortEarly: false }
    );
    expect(outcome.issues.some((issue) => issue.path === "bio")).toBe(false);
  });

  it("skips a permitted absence rather than running its length rule", () => {
    const outcome = validator.validate(
      { ...BAD, nickname: undefined },
      { abortEarly: false }
    );
    expect(outcome.issues.some((issue) => issue.path === "nickname")).toBe(
      false
    );
  });
});
