// ===========================================================================
// The pass-through nothing else checks.
//
// ValidateOptions.external is the ONE channel a pre-resolved async context
// arrives on. L5 puts it on the RuleContext it hands to a rule; if any
// compiled layer rebuilds that object, `external` is dropped and ./async goes
// silently dead — no type error anywhere, because a RuleContext without
// `external` is a perfectly legal RuleContext (the member is optional).
//
// L4 is where such a rebuild would be introduced, so L4 is where it is
// forbidden: every user function a plan holds is stored BY IDENTITY and is
// called with the RuleContext verbatim.
// ===========================================================================
import type { RuleContext } from "../../../../src/types";
import { PASS } from "../../../../src/types";
import type { ValidateOptions } from "../../../../src/types/validation-result.types";
import { parseFieldPath } from "../../../../src/path/parse-field-path";
import { compileField } from "../../../../src/compile/compile-field";
import {
  eraseCompositeToCheck,
  makeCheck,
  makeComposite,
  makeGate,
  makeTransform,
  refuseComposite,
  unresolvablePlanRef,
} from "../rule-fixtures";

type MutuallyAssignable<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;

/**
 * Compile-time half: narrowing either end of the channel (say, retyping
 * RuleContext.external to Record<string, string>) makes this `false` and the
 * suite stops compiling. The runtime half below then proves the value moves.
 */
const externalChannelIsShared: MutuallyAssignable<
  NonNullable<ValidateOptions["external"]>,
  NonNullable<RuleContext["external"]>
> = true;

const externalContext = Object.freeze({ token: "resolved-by-async" });

function contextWithExternal(): RuleContext {
  return {
    root: { name: "ada" },
    path: "name",
    external: externalContext,
  };
}

function compile(rules: Parameters<typeof compileField>[0]["rules"]) {
  return compileField({
    template: parseFieldPath("name"),
    rules,
    fieldPath: "name",
    defaultOf: null,
    applyDefaultToNull: true,
    normalize: null,
    planRef: unresolvablePlanRef(),
    eraseComposite: refuseComposite(),
  });
}

describe("ValidateOptions.external reaches RuleContext.external", () => {
  it("declares one channel, not two", () => {
    expect(externalChannelIsShared).toBe(true);
  });

  it("hands a compiled check the RuleContext verbatim", () => {
    const seen: RuleContext[] = [];
    const field = compile([
      makeCheck("hasToken", (_value, ctx) => {
        seen.push(ctx);
        return PASS;
      }),
    ]);
    const ctx = contextWithExternal();
    field.checks[0]?.run("ada", ctx);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(ctx);
    expect(seen[0]?.external).toBe(externalContext);
    expect(seen[0]?.external?.["token"]).toBe("resolved-by-async");
  });

  it("hands a compiled gate the RuleContext verbatim", () => {
    const seen: RuleContext[] = [];
    const field = compile([
      makeGate("whenTokenPresent", (_value, ctx) => {
        seen.push(ctx);
        return true;
      }),
    ]);
    const ctx = contextWithExternal();
    field.gates[0]?.shouldRun("ada", ctx);
    expect(seen[0]?.external).toBe(externalContext);
  });

  it("hands a compiled transform the RuleContext verbatim", () => {
    const seen: RuleContext[] = [];
    const field = compile([
      makeTransform((value, ctx) => {
        seen.push(ctx);
        return value;
      }),
    ]);
    const ctx = contextWithExternal();
    field.transforms[0]?.apply("ada", ctx);
    expect(seen[0]?.external).toBe(externalContext);
  });

  it("hands an ERASED composite the RuleContext verbatim", () => {
    const seen: RuleContext[] = [];
    const field = compileField({
      template: parseFieldPath("name"),
      rules: [makeComposite("oneOf")],
      fieldPath: "name",
      defaultOf: null,
      applyDefaultToNull: true,
      normalize: null,
      planRef: unresolvablePlanRef(),
      eraseComposite: (rule) => ({
        ...eraseCompositeToCheck(rule),
        run: (_value, ctx) => {
          seen.push(ctx);
          return PASS;
        },
      }),
    });
    const ctx = contextWithExternal();
    field.checks[0]?.run("ada", ctx);
    expect(seen[0]?.external).toBe(externalContext);
  });

  it("does not require external to be present", () => {
    const seen: RuleContext[] = [];
    const field = compile([
      makeCheck("plain", (_value, ctx) => {
        seen.push(ctx);
        return PASS;
      }),
    ]);
    field.checks[0]?.run("ada", { root: {}, path: "name" });
    expect(seen[0]?.external).toBeUndefined();
  });
});
