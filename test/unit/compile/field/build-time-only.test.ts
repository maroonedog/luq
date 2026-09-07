// ===========================================================================
// build() pre-computes; it does not execute.
//
// The whole performance design is "decide at build time, run assembled
// functions at validation time". A compile step that called a user's check
// even once would both break that and run a side effect the user expects to
// see per validation, so it is asserted rather than assumed.
// ===========================================================================
import { PASS } from "../../../../src/types";
import { compileFieldDeclaration } from "../../../../src/compile/compile-field";
import {
  eraseCompositeToCheck,
  makeCheck,
  makeComposite,
  makeGate,
  makeRecursive,
  makeTransform,
  unresolvablePlanRef,
} from "../rule-fixtures";

describe("compiling a field runs nothing the user wrote", () => {
  it("calls no check, gate, transform or describe", () => {
    const calls: string[] = [];
    const field = compileFieldDeclaration(
      {
        path: "profile.name",
        rules: [
          makeCheck("minLength", () => {
            calls.push("check");
            return PASS;
          }),
          makeGate("validateIf", () => {
            calls.push("gate");
            return true;
          }),
          makeTransform((value) => {
            calls.push("transform");
            return value;
          }),
          makeRecursive("recursively"),
        ],
        defaultOf: () => {
          calls.push("default");
          return "anon";
        },
      },
      unresolvablePlanRef(),
      eraseCompositeToCheck
    );
    expect(calls).toEqual([]);
    field.checks[0]?.run("ada", { root: {}, path: "profile.name" });
    expect(calls).toEqual(["check"]);
  });

  it("stores the user's functions BY IDENTITY", () => {
    const check = makeCheck("minLength");
    const gate = makeGate("validateIf");
    const transform = makeTransform();
    const field = compileFieldDeclaration(
      { path: "name", rules: [check, gate, transform] },
      unresolvablePlanRef(),
      eraseCompositeToCheck
    );
    expect(field.checks[0]).toBe(check);
    expect(field.gates[0]).toBe(gate);
    expect(field.transforms[0]).toBe(transform);
  });

  it("never resolves the PlanRef while compiling", () => {
    expect(() =>
      compileFieldDeclaration(
        { path: "node", rules: [makeRecursive("recursively")] },
        unresolvablePlanRef(),
        eraseCompositeToCheck
      )
    ).not.toThrow();
  });

  it("never calls a composite's combine: that is compile-composite's job", () => {
    let combined = 0;
    const composite = makeComposite("oneOf");
    const withCounter = {
      ...composite,
      combine: () => {
        combined += 1;
        return () => PASS;
      },
    };
    compileFieldDeclaration(
      { path: "name", rules: [withCounter] },
      unresolvablePlanRef(),
      eraseCompositeToCheck
    );
    expect(combined).toBe(0);
  });
});
