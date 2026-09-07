// ===========================================================================
// ONE issue-path grammar, asserted as a table, end to end through the real
// validator. `.` between members, `[n]` attached with no leading dot, adjacent
// brackets for nested arrays, `].` before an element's member, `""` for a
// root-level failure. (docs/legacy-spec/result-and-errors.md, must-preserve
// "Error path grammar".)
//
// The declaration grammar's `[*]` must never appear in an issue. That was the
// legacy defect: two different index-threading mechanisms, one of which fell
// back to the pattern string.
// ===========================================================================
import { createValidator } from "../../../../src/runtime/create-validator";
import { matchPathPattern } from "../../../../src/path/match-path-pattern";
import type { FieldDeclaration } from "../../../../src/compile/validation-plan.types";
import { requiredRule } from "../../compile/rule-fixtures";
import { planOf } from "./engine-fixtures";

interface PathCase {
  readonly declared: string;
  readonly input: unknown;
  readonly expected: readonly string[];
}

const CASES: readonly PathCase[] = [
  { declared: "a", input: {}, expected: ["a"] },
  { declared: "a.b", input: { a: {} }, expected: ["a.b"] },
  {
    declared: "user.profile.email",
    input: { user: { profile: {} } },
    expected: ["user.profile.email"],
  },
  {
    declared: "items[*]",
    input: { items: [undefined, undefined] },
    expected: ["items[0]", "items[1]"],
  },
  {
    declared: "items[*].name",
    input: { items: [{}, {}] },
    expected: ["items[0].name", "items[1].name"],
  },
  {
    declared: "grid[*][*]",
    input: { grid: [[undefined], [1, undefined]] },
    expected: ["grid[0][0]", "grid[1][1]"],
  },
  {
    declared: "cube[*][*][*]",
    input: { cube: [[[1, undefined]]] },
    expected: ["cube[0][0][1]"],
  },
  {
    declared: "data[*].nested.inner",
    input: { data: [{ nested: {} }, { nested: {} }] },
    expected: ["data[0].nested.inner", "data[1].nested.inner"],
  },
  {
    declared: "users[*].scores[*][*]",
    input: { users: [{ scores: [[1, undefined]] }] },
    expected: ["users[0].scores[0][1]"],
  },
];

function issuePathsFor(declared: string, input: unknown): readonly string[] {
  const declarations: readonly FieldDeclaration[] = [
    { path: declared, rules: [requiredRule()] },
  ];
  return createValidator(planOf(declarations))
    .validate(input, { abortEarly: false })
    .issues.map((issue) => issue.path);
}

describe("the issue-path grammar", () => {
  it.each(CASES)(
    "renders $declared as $expected",
    ({ declared, input, expected }) => {
      expect(issuePathsFor(declared, input)).toEqual(expected);
    }
  );

  it("never leaks the declaration wildcard into an issue", () => {
    for (const testCase of CASES) {
      for (const rendered of issuePathsFor(testCase.declared, testCase.input)) {
        expect(rendered).not.toContain("[*]");
      }
    }
  });

  it("renders a path that the ONE matcher recognises as the declaration's", () => {
    for (const testCase of CASES) {
      for (const rendered of issuePathsFor(testCase.declared, testCase.input)) {
        expect(`${testCase.declared} ~ ${rendered}`).toBe(
          `${testCase.declared} ~ ${matchPathPattern(testCase.declared, rendered) ? rendered : "NO MATCH"}`
        );
      }
    }
  });

  it("uses the empty path for a root-level failure", () => {
    const outcome = createValidator(
      planOf([{ path: "a", rules: [requiredRule()] }])
    ).validate(null);
    expect(outcome.issues.map((issue) => issue.path)).toEqual([""]);
  });
});
