// ===========================================================================
// One issue, one message, one render call.
//
// severity is the point of this file. It is not type-checked into place
// anywhere: ValidationIssue.severity is `IssueSeverity`, and so is
// CompiledCheck.severity, so a createIssue that hard-coded "error" would
// compile perfectly and silently discard every override the chain resolved.
// Only running it can tell.
// ===========================================================================
import type { IssueSeverity, MessageContext } from "../../../src/types";
import {
  createIssue,
  renderFallbackMessage,
} from "../../../src/runtime/create-issue";

const SEVERITIES: readonly IssueSeverity[] = ["error", "warning", "info"];

describe("createIssue builds the issue the consumer reads", () => {
  it("carries path, code, message and severity", () => {
    const issue = createIssue({
      path: "items[0].name",
      code: "minLength",
      severity: "error",
      value: "ab",
      render: (ctx) => `${ctx.path} is too short`,
    });
    expect(issue).toEqual({
      path: "items[0].name",
      code: "minLength",
      message: "items[0].name is too short",
      severity: "error",
    });
  });

  it.each(SEVERITIES)("copies the rule's severity %p verbatim", (severity) => {
    const issue = createIssue({
      path: "name",
      code: "custom",
      severity,
      value: 1,
      render: () => "failed",
    });
    expect(issue.severity).toBe(severity);
  });

  it("hands the plugin a MessageContext of path, value and code", () => {
    const seen: MessageContext[] = [];
    createIssue({
      path: "profile.age",
      code: "numberMin",
      severity: "warning",
      value: 3,
      render: (ctx) => {
        seen.push(ctx);
        return "too small";
      },
    });
    expect(seen).toEqual([
      { path: "profile.age", value: 3, code: "numberMin" },
    ]);
  });

  it("renders the message EXACTLY once", () => {
    let renders = 0;
    const issue = createIssue({
      path: "name",
      code: "required",
      severity: "error",
      value: undefined,
      render: () => {
        renders += 1;
        return "required";
      },
    });
    expect(renders).toBe(1);
    expect(issue.message).toBe("required");
  });

  it("freezes the issue it hands out", () => {
    const issue = createIssue({
      path: "name",
      code: "required",
      severity: "error",
      value: undefined,
      render: () => "required",
    });
    expect(Object.isFrozen(issue)).toBe(true);
  });
});

describe("a throwing message factory does not take validation down", () => {
  it("falls back to the documented wording", () => {
    const issue = createIssue({
      path: "user.email",
      code: "stringEmail",
      severity: "error",
      value: "nope",
      render: () => {
        throw new Error("the plugin's formatter is broken");
      },
    });
    expect(issue.message).toBe(renderFallbackMessage("user.email"));
    expect(issue.message).toBe("Validation failed for user.email");
  });

  it("still reports the failing rule's own code and severity", () => {
    const issue = createIssue({
      path: "",
      code: "stringEmail",
      severity: "warning",
      value: "nope",
      render: () => {
        throw new Error("broken");
      },
    });
    expect(issue.code).toBe("stringEmail");
    expect(issue.severity).toBe("warning");
    expect(issue.path).toBe("");
  });
});
