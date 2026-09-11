// The message fromContext reports when the check rejects the value.
//
// A check is allowed to reject without naming a reason, so three sources are
// consulted in order: the message the check returned, the configured
// errorMessage, then the plugin's own default. Each step is pinned separately,
// because the one string that comes out is all a caller ever sees.
import { Builder } from "../../../../src/index";
import { fromContextPlugin } from "../../../../src/plugins/from-context/index";
import type { FromContextOutcome } from "../../../../src/plugins/from-context/index";

interface Signup {
  readonly email: string;
}

const SIGNUP: Signup = { email: "ada@example.com" };
const WITH_CONTEXT = { external: { takenEmails: "ada@example.com" } };

function rejectionMessage(
  outcome: FromContextOutcome,
  errorMessage?: string
): string {
  const validator = Builder()
    .use(fromContextPlugin)
    .for<Signup>()
    .v("email", (b) =>
      b.string.fromContext({ check: () => outcome, errorMessage })
    )
    .build();
  const validationResult = validator.validate(SIGNUP, WITH_CONTEXT);
  expect(validationResult.valid).toBe(false);
  const issue = validationResult.issues[0];
  if (issue === undefined) throw new Error("expected a rejection");
  return issue.message;
}

describe("fromContext: a check that rejects without naming a reason", () => {
  it("reports the configured errorMessage", () => {
    expect(rejectionMessage({ valid: false }, "email is not usable")).toBe(
      "email is not usable"
    );
  });

  it("reports the plugin's own default when nothing was configured", () => {
    expect(rejectionMessage({ valid: false })).toBe(
      "Context validation failed"
    );
  });

  it("keeps an empty message the check chose, instead of falling through", () => {
    expect(rejectionMessage({ valid: false, message: "" }, "not this")).toBe(
      ""
    );
  });
});
