// ===========================================================================
// What a failing rule gets to say about itself.
//
// ValidationIssue carries path / code / message / severity and nothing else,
// so expected, actual, branch, index and causes reach the consumer through the
// message the rule renders. This file proves the whole IssueDetail arrives at
// describe() unchanged — a runtime that rebuilt the detail, or passed only
// `actual`, would compile and would silently flatten every composite failure.
//
// severity is the other half. Nothing type-checks it into place: both sides
// are `IssueSeverity`, so a createIssue that hard-coded "error" compiles.
// ===========================================================================
import { fail } from "../../../../src/types";
import type {
  IssueDetail,
  IssueSeverity,
  MessageContext,
  ValidationIssue,
} from "../../../../src/types";
import { runField } from "../../../../src/runtime/run-field";
import { makePresence } from "../../compile/rule-fixtures";
import {
  compileFieldAt,
  createRunContext,
  createSink,
  makeDetailedCheck,
} from "../runtime-fixtures";

const CAUSE: ValidationIssue = {
  path: "value.kind",
  code: "literal",
  message: "expected 'circle'",
  severity: "error",
};

const FULL_DETAIL: IssueDetail = {
  expected: "circle",
  actual: "square",
  branch: "circleBranch",
  index: 2,
  causes: [CAUSE],
};

describe("the IssueDetail a check produced reaches its describe()", () => {
  it("arrives BY IDENTITY, with every member intact", () => {
    const seen: IssueDetail[] = [];
    const field = compileFieldAt({
      path: "shape",
      rules: [
        makeDetailedCheck({
          code: "oneOf",
          run: () => fail(FULL_DETAIL),
          describe: (detail) => {
            seen.push(detail);
            return "no branch matched";
          },
        }),
      ],
    });
    runField(
      field,
      { shape: "square" },
      createRunContext({ sink: createSink() })
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(FULL_DETAIL);
    expect(seen[0]).toEqual({
      expected: "circle",
      actual: "square",
      branch: "circleBranch",
      index: 2,
      causes: [CAUSE],
    });
  });

  it("renders expected, actual, branch, index and causes into the message", () => {
    const sink = createSink();
    const field = compileFieldAt({
      path: "shape",
      rules: [
        makeDetailedCheck({
          code: "oneOf",
          run: () => fail(FULL_DETAIL),
          describe: (detail, ctx) =>
            `${ctx.path}: expected ${String(detail.expected)}, got ` +
            `${String(detail.actual)} (branch ${String(detail.branch)}, ` +
            `index ${String(detail.index)}, ${detail.causes?.length ?? 0} cause)`,
        }),
      ],
    });
    runField(field, { shape: "square" }, createRunContext({ sink }));
    expect(sink.issues[0]?.message).toBe(
      "shape: expected circle, got square (branch circleBranch, index 2, 1 cause)"
    );
  });

  it("gives describe a MessageContext of the FAILING value, path and code", () => {
    const seen: MessageContext[] = [];
    const field = compileFieldAt({
      path: "profile.age",
      rules: [
        makeDetailedCheck({
          code: "numberMin",
          run: () => fail({ expected: 18, actual: 3 }),
          describe: (_detail, ctx) => {
            seen.push(ctx);
            return "too small";
          },
        }),
      ],
    });
    runField(field, { profile: { age: 3 } }, createRunContext());
    expect(seen).toEqual([
      { path: "profile.age", value: 3, code: "numberMin" },
    ]);
  });

  it("renders the message exactly once per issue, on the failure path only", () => {
    let describes = 0;
    const sink = createSink({ abortEarlyOnEachField: false });
    const field = compileFieldAt({
      path: "name",
      rules: [
        makeDetailedCheck({
          code: "passes",
          run: () => ({ ok: true }) as const,
          describe: () => {
            describes += 1;
            return "never";
          },
        }),
        makeDetailedCheck({
          code: "fails",
          run: () => fail({}),
          describe: () => {
            describes += 1;
            return "once";
          },
        }),
      ],
    });
    runField(field, { name: "ada" }, createRunContext({ sink }));
    expect(describes).toBe(1);
    expect(sink.issues.map((issue) => issue.message)).toEqual(["once"]);
  });
});

describe("severity lands on the issue exactly as the rule resolved it", () => {
  const severities: readonly IssueSeverity[] = ["error", "warning", "info"];

  it.each(severities)("a check declaring %p emits %p", (severity) => {
    const sink = createSink();
    runField(
      compileFieldAt({
        path: "name",
        rules: [
          makeDetailedCheck({ code: "custom", severity, run: () => fail({}) }),
        ],
      }),
      { name: "ada" },
      createRunContext({ sink })
    );
    expect(sink.issues[0]?.severity).toBe(severity);
  });

  it.each(severities)("a presence policy declaring %p emits %p", (severity) => {
    const sink = createSink();
    runField(
      compileFieldAt({
        path: "name",
        rules: [makePresence("required", false, false, true, severity)],
      }),
      {},
      createRunContext({ sink })
    );
    expect(sink.issues[0]?.severity).toBe(severity);
  });

  it("keeps two rules' severities apart within one field", () => {
    const sink = createSink({ abortEarlyOnEachField: false });
    runField(
      compileFieldAt({
        path: "name",
        rules: [
          makeDetailedCheck({
            code: "hard",
            severity: "error",
            run: () => fail({}),
          }),
          makeDetailedCheck({
            code: "soft",
            severity: "warning",
            run: () => fail({}),
          }),
        ],
      }),
      { name: "ada" },
      createRunContext({ sink })
    );
    expect(sink.issues.map((issue) => issue.severity)).toEqual([
      "error",
      "warning",
    ]);
  });
});
