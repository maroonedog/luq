// ===========================================================================
// runField: default, presence, gates, checks — the part that decides whether a
// user's rule runs at all.
//
// Fields are compiled by the real compileFieldDeclaration, so nothing here can
// pass against a hand-shaped plan the compiler would never produce.
// ===========================================================================
import { PASS, fail } from "../../../src/types";
import type { RuleContext } from "../../../src/types";
import {
  makeGate,
  makePresence,
  makeTransform,
  nullableRule,
  optionalRule,
  requiredRule,
} from "../compile/rule-fixtures";
import { runField } from "../../../src/runtime/run-field";
import {
  compileFieldAt,
  createRunContext,
  createSink,
  makeDetailedCheck,
  makePassingCheck,
} from "./runtime-fixtures";

describe("presence decides whether anything else runs", () => {
  it("reports a forbidden absence once, under the presence rule's code", () => {
    const sink = createSink({ abortEarlyOnEachField: false });
    let checkRuns = 0;
    const field = compileFieldAt({
      path: "name",
      rules: [
        requiredRule(),
        makeDetailedCheck({
          code: "minLength",
          run: () => {
            checkRuns += 1;
            return fail({});
          },
        }),
      ],
    });
    runField(field, {}, createRunContext({ sink }));
    expect(sink.issues).toEqual([
      {
        path: "name",
        code: "required",
        message: "required policy",
        severity: "error",
      },
    ]);
    expect(checkRuns).toBe(0);
  });

  it("skips a permitted absence in silence: no issue, no check", () => {
    const sink = createSink({ abortEarlyOnEachField: false });
    let checkRuns = 0;
    const field = compileFieldAt({
      path: "nickname",
      rules: [
        optionalRule(),
        makeDetailedCheck({
          code: "minLength",
          run: () => {
            checkRuns += 1;
            return PASS;
          },
        }),
      ],
    });
    runField(field, {}, createRunContext({ sink }));
    expect(sink.count).toBe(0);
    expect(checkRuns).toBe(0);
  });

  it("treats null under .nullable() as absent and under nothing else as an issue", () => {
    const permitted = createSink();
    runField(
      compileFieldAt({ path: "bio", rules: [nullableRule()] }),
      { bio: null },
      createRunContext({ sink: permitted })
    );
    expect(permitted.count).toBe(0);

    const forbidden = createSink();
    runField(
      compileFieldAt({ path: "bio", rules: [requiredRule()] }),
      { bio: null },
      createRunContext({ sink: forbidden })
    );
    expect(forbidden.issues.map((issue) => issue.code)).toEqual(["required"]);
  });

  it("treats an empty string as missing only when the policy says so", () => {
    const strict = createSink();
    runField(
      compileFieldAt({ path: "name", rules: [requiredRule()] }),
      { name: "" },
      createRunContext({ sink: strict })
    );
    expect(strict.issues.map((issue) => issue.code)).toEqual(["required"]);

    const lenient = createSink();
    let sawValue: unknown = "not seen";
    runField(
      compileFieldAt({
        path: "name",
        rules: [
          makePresence("filled", false, false, false),
          makeDetailedCheck({
            code: "any",
            run: (value) => {
              sawValue = value;
              return PASS;
            },
          }),
        ],
      }),
      { name: "" },
      createRunContext({ sink: lenient })
    );
    expect(lenient.count).toBe(0);
    expect(sawValue).toBe("");
  });

  it("stays silent on a missing field that declared NO presence rule", () => {
    const sink = createSink();
    let checkRuns = 0;
    runField(
      compileFieldAt({
        path: "name",
        rules: [
          makeDetailedCheck({
            code: "minLength",
            run: () => {
              checkRuns += 1;
              return fail({});
            },
          }),
        ],
      }),
      {},
      createRunContext({ sink })
    );
    expect(sink.count).toBe(0);
    expect(checkRuns).toBe(0);
  });

  it("carries the presence rule's own severity onto the issue", () => {
    const sink = createSink();
    runField(
      compileFieldAt({
        path: "name",
        rules: [makePresence("required", false, false, true, "warning")],
      }),
      {},
      createRunContext({ sink })
    );
    expect(sink.issues[0]?.severity).toBe("warning");
  });
});

describe("a default is substituted before presence looks at the value", () => {
  it("satisfies a required field and reaches the check", () => {
    const sink = createSink();
    let seen: unknown = "not seen";
    const field = compileFieldAt({
      path: "role",
      rules: [
        requiredRule(),
        makeDetailedCheck({
          code: "literal",
          run: (value) => {
            seen = value;
            return PASS;
          },
        }),
      ],
      defaultOf: () => "guest",
    });
    const outcome = runField(field, {}, createRunContext({ sink }));
    expect(sink.count).toBe(0);
    expect(seen).toBe("guest");
    expect(outcome).toEqual({ hasWriteBack: true, value: "guest" });
  });

  it("reads the ROOT, not the subject it was read from", () => {
    const root = { fallback: "from-root" };
    const field = compileFieldAt({
      path: "role",
      rules: [],
      defaultOf: (given) => (given as { fallback: string }).fallback,
    });
    const outcome = runField(field, {}, createRunContext({ root }));
    expect(outcome).toEqual({ hasWriteBack: true, value: "from-root" });
  });

  it("replaces null only while applyDefaultToNull holds", () => {
    const replaced = runField(
      compileFieldAt({ path: "role", rules: [], defaultOf: () => "guest" }),
      { role: null },
      createRunContext()
    );
    expect(replaced).toEqual({ hasWriteBack: true, value: "guest" });

    const sink = createSink();
    const kept = runField(
      compileFieldAt({
        path: "role",
        rules: [requiredRule()],
        defaultOf: () => "guest",
        applyDefaultToNull: false,
      }),
      { role: null },
      createRunContext({ sink })
    );
    expect(kept).toEqual({ hasWriteBack: false });
    expect(sink.issues.map((issue) => issue.code)).toEqual(["required"]);
  });
});

describe("a closed gate ends the field successfully", () => {
  it("runs no check and no transform, and records nothing", () => {
    const sink = createSink();
    let checkRuns = 0;
    let transformRuns = 0;
    const field = compileFieldAt({
      path: "name",
      rules: [
        makeGate("validateIf", () => false),
        makeDetailedCheck({
          code: "minLength",
          run: () => {
            checkRuns += 1;
            return fail({});
          },
        }),
        makeTransform(() => {
          transformRuns += 1;
          return "transformed";
        }),
      ],
    });
    const outcome = runField(
      field,
      { name: "ada" },
      createRunContext({ sink, shouldApplyTransforms: true })
    );
    expect(sink.count).toBe(0);
    expect(checkRuns).toBe(0);
    expect(transformRuns).toBe(0);
    expect(outcome).toEqual({ hasWriteBack: false });
  });

  it("stops at the FIRST closed gate and sees the value and the context", () => {
    const opened: string[] = [];
    const contexts: RuleContext[] = [];
    const field = compileFieldAt({
      path: "name",
      rules: [
        makeGate("first", (value, ctx) => {
          opened.push(`first:${String(value)}`);
          contexts.push(ctx);
          return false;
        }),
        makeGate("second", () => {
          opened.push("second");
          return true;
        }),
      ],
    });
    runField(field, { name: "ada" }, createRunContext());
    expect(opened).toEqual(["first:ada"]);
    expect(contexts[0]?.path).toBe("name");
  });
});

describe("checks run in declaration order, once each", () => {
  it("invokes the user's check exactly once and renders once", () => {
    const sink = createSink();
    let runs = 0;
    let describes = 0;
    const field = compileFieldAt({
      path: "name",
      rules: [
        makeDetailedCheck({
          code: "minLength",
          run: () => {
            runs += 1;
            return fail({ actual: 2 });
          },
          describe: () => {
            describes += 1;
            return "too short";
          },
        }),
      ],
    });
    runField(field, { name: "ab" }, createRunContext({ sink }));
    expect(runs).toBe(1);
    expect(describes).toBe(1);
    expect(sink.issues[0]?.message).toBe("too short");
  });

  it("keeps declaration order across a passing check", () => {
    const sink = createSink({ abortEarlyOnEachField: false });
    const field = compileFieldAt({
      path: "name",
      rules: [
        makeDetailedCheck({ code: "first" }),
        makePassingCheck("passes"),
        makeDetailedCheck({ code: "last" }),
      ],
    });
    runField(field, { name: "ada" }, createRunContext({ sink }));
    expect(sink.issues.map((issue) => issue.code)).toEqual(["first", "last"]);
  });

  it("does NOT swallow a throwing check", () => {
    const field = compileFieldAt({
      path: "name",
      rules: [
        makeDetailedCheck({
          code: "custom",
          run: () => {
            throw new Error("the user's predicate exploded");
          },
        }),
      ],
    });
    expect(() => runField(field, { name: "ada" }, createRunContext())).toThrow(
      "the user's predicate exploded"
    );
  });
});

describe("the RuleContext a plugin receives", () => {
  it("carries the real root, the rendered path, item and external verbatim", () => {
    const root = { name: "ada" };
    const external = Object.freeze({ session: "abc" });
    const item = { index: 4, item: "ada", array: ["ada"] };
    const seen: RuleContext[] = [];
    const field = compileFieldAt({
      path: "name",
      rules: [
        makeDetailedCheck({
          code: "custom",
          run: (_value, ctx) => {
            seen.push(ctx);
            return PASS;
          },
        }),
      ],
    });
    runField(field, root, createRunContext({ root, external, item }));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.root).toBe(root);
    expect(seen[0]?.external).toBe(external);
    expect(seen[0]?.item).toBe(item);
    expect(seen[0]?.path).toBe("name");
  });
});
