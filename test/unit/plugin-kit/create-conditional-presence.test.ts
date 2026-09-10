// The constructor for a conditional presence rule. Two things: that it wraps
// the predicate in nothing, and that its message path is identical to every
// other rule kind's.
import {
  PERMITS_ABSENCE,
  REQUIRES_A_VALUE,
  conditionalPresence,
} from "../../../src/plugin-kit/create-conditional-presence";

const MESSAGE_CONTEXT = { path: "email", value: undefined, code: "optionalIf" };

function makeRule(
  messageFactory?: (context: { path: string; condition: boolean }) => string
) {
  return conditionalPresence<{ condition: boolean }>({
    code: "optionalIf",
    messageFactory,
    severity: "error",
    when: (root) => root === true,
    whenMet: PERMITS_ABSENCE,
    whenUnmet: REQUIRES_A_VALUE,
    describe: () => "Field is optional when condition is met",
    buildMessageContext: () => ({ condition: false }),
  });
}

describe("conditionalPresence", () => {
  it("carries the conditionalPresence kind, which is what sorts it", () => {
    expect(makeRule().kind).toBe("conditionalPresence");
  });

  it("keeps the predicate by identity", () => {
    const when = (): boolean => true;
    const rule = conditionalPresence({
      code: "requiredIf",
      severity: "error",
      when,
      whenMet: REQUIRES_A_VALUE,
      whenUnmet: null,
      describe: () => "x",
      buildMessageContext: () => ({}),
    });
    expect(rule.when).toBe(when);
  });

  it("emits describe's own string when there is no messageFactory", () => {
    expect(makeRule().describe(MESSAGE_CONTEXT)).toBe(
      "Field is optional when condition is met"
    );
  });

  it("hands messageFactory the message context merged with the extra one", () => {
    const rule = makeRule(
      (context) => `${context.path} condition=${String(context.condition)}`
    );
    expect(rule.describe(MESSAGE_CONTEXT)).toBe("email condition=false");
  });

  it("carries both sides' allowances through unchanged", () => {
    const rule = makeRule();
    expect(rule.whenMet).toBe(PERMITS_ABSENCE);
    expect(rule.whenUnmet).toBe(REQUIRES_A_VALUE);
  });

  it("has REQUIRES_A_VALUE count undefined, null and the empty string as absent", () => {
    expect(REQUIRES_A_VALUE).toEqual({
      allowUndefined: false,
      allowNull: false,
      emptyStringIsMissing: true,
    });
  });

  it("has PERMITS_ABSENCE leave the empty string counting as present", () => {
    expect(PERMITS_ABSENCE).toEqual({
      allowUndefined: true,
      allowNull: true,
      emptyStringIsMissing: false,
    });
  });

  it("freezes the shared allowances", () => {
    expect(Object.isFrozen(REQUIRES_A_VALUE)).toBe(true);
    expect(Object.isFrozen(PERMITS_ABSENCE)).toBe(true);
  });
});
