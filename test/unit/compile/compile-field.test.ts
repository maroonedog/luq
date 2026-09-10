import { PathSyntaxError } from "../../../src/path/reserved-segment";
import { parseFieldPath } from "../../../src/path/parse-field-path";
import {
  APPLIES_DEFAULT_TO_NULL_BY_DEFAULT,
  compileField,
  compileFieldDeclaration,
} from "../../../src/compile/compile-field";
import { OPEN_PRESENCE_CODE } from "../../../src/compile/resolve-presence";
import { ConflictingRecursionError } from "../../../src/compile/resolve-recursion";
import type { CompiledCheck } from "../../../src/compile/validation-plan.types";
import type { Rule } from "../../../src/plugin-kit/compiled-rule";
import {
  EMPTY_PLAN,
  eraseCompositeToCheck,
  makeCheck,
  makeComposite,
  makeGate,
  makePresence,
  makeRecursive,
  makeTransform,
  planRefTo,
  refuseComposite,
  requiredRule,
  unresolvablePlanRef,
} from "./rule-fixtures";

function compileAt(path: string, rules: readonly Rule[]) {
  return compileFieldDeclaration(
    { path, rules },
    unresolvablePlanRef(),
    refuseComposite()
  );
}

function codesOf(checks: readonly CompiledCheck[]): readonly string[] {
  return checks.map((check) => check.code);
}

describe("compileField separates the rules by kind", () => {
  it("keeps each kind in its own array, in declaration order", () => {
    const field = compileAt("profile.name", [
      makeCheck("minLength"),
      requiredRule(),
      makeGate("validateIf"),
      makeCheck("pattern"),
      makeTransform(),
    ]);
    expect(codesOf(field.checks)).toEqual(["minLength", "pattern"]);
    expect(field.gates.map((gate) => gate.code)).toEqual(["validateIf"]);
    expect(field.transforms).toHaveLength(1);
    expect(field.presence.code).toBe("required");
  });

  it("erases a composite into checks IN DECLARATION ORDER", () => {
    const field = compileFieldDeclaration(
      {
        path: "name",
        rules: [makeCheck("first"), makeComposite("oneOf"), makeCheck("last")],
      },
      unresolvablePlanRef(),
      eraseCompositeToCheck
    );
    expect(codesOf(field.checks)).toEqual(["first", "oneOf", "last"]);
  });

  it("calls eraseComposite exactly once per composite", () => {
    let calls = 0;
    compileFieldDeclaration(
      { path: "name", rules: [makeComposite("a"), makeComposite("b")] },
      unresolvablePlanRef(),
      (rule) => {
        calls += 1;
        return eraseCompositeToCheck(rule);
      }
    );
    expect(calls).toBe(2);
  });

  it("compiles a composite that declares NO branches", () => {
    const field = compileFieldDeclaration(
      { path: "name", rules: [makeComposite("emptyOneOf", [])] },
      unresolvablePlanRef(),
      eraseCompositeToCheck
    );
    expect(codesOf(field.checks)).toEqual(["emptyOneOf"]);
    expect(field.checks[0]?.run("ada", { root: {}, path: "name" })).toEqual({
      ok: true,
    });
  });

  it("carries the rule severity onto the compiled check", () => {
    const field = compileAt("name", [
      makeCheck("soft", () => ({ ok: true }), "warning"),
    ]);
    expect(field.checks[0]?.severity).toBe("warning");
  });

  it("carries the presence severity onto the policy", () => {
    const field = compileAt("name", [
      makePresence("required", false, false, true, "info"),
    ]);
    expect(field.presence.severity).toBe("info");
  });
});

describe("compileField decides the writer at build time", () => {
  it("write === null when the field has neither transform nor default", () => {
    const field = compileAt("name", [makeCheck("minLength"), requiredRule()]);
    expect(field.write).toBeNull();
  });

  it("write is a function when the field declares a transform", () => {
    const field = compileAt("name", [makeTransform()]);
    expect(typeof field.write).toBe("function");
  });

  it("write is a function when the field declares only a default", () => {
    const field = compileFieldDeclaration(
      { path: "name", rules: [], defaultOf: () => "anon" },
      unresolvablePlanRef(),
      refuseComposite()
    );
    expect(typeof field.write).toBe("function");
  });

  it("the writer is copy-on-write and returns the NEW root", () => {
    const field = compileFieldDeclaration(
      { path: "profile.name", rules: [makeTransform()] },
      unresolvablePlanRef(),
      refuseComposite()
    );
    const root = { profile: { name: "ada" }, other: { kept: true } };
    const written = field.write?.(root, "grace");
    expect(written).toEqual({
      profile: { name: "grace" },
      other: { kept: true },
    });
    expect(root.profile.name).toBe("ada");
    expect((written as typeof root).other).toBe(root.other);
  });
});

describe("compileField compiles the reader from the template", () => {
  it("reads a nested own property", () => {
    const field = compileAt("profile.name", [makeCheck("minLength")]);
    expect(field.read({ profile: { name: "ada" } })).toBe("ada");
  });

  it("does not walk the prototype chain", () => {
    const field = compileAt("toString", [makeCheck("minLength")]);
    expect(field.read({})).toBeUndefined();
  });
});

describe("compileField rejects a malformed path at BUILD time", () => {
  it("throws PathSyntaxError naming the path", () => {
    expect(() => compileAt("profile..name", [])).toThrow(PathSyntaxError);
    expect(() => compileAt("profile..name", [])).toThrow(/profile\.\.name/);
  });

  it("__proto__ を含むパスも受け付ける（汚染は書き込み側で閉じている）", () => {
    expect(() => compileAt("__proto__.polluted", [])).not.toThrow();
  });

  it("refuses a wildcard template: a single value cannot come from many", () => {
    expect(() =>
      compileField({
        template: parseFieldPath("items[*]"),
        rules: [],
        fieldPath: "items[*]",
        defaultOf: null,
        applyDefaultToNull: true,
        normalize: null,
        planRef: unresolvablePlanRef(),
        eraseComposite: refuseComposite(),
      })
    ).toThrow(PathSyntaxError);
  });
});

describe("compileField resolves recursion and defaults", () => {
  it("recursion === null on an ordinary field", () => {
    const field = compileAt("name", [makeCheck("minLength"), requiredRule()]);
    expect(field.recursion).toBeNull();
  });

  it("does not resolve the plan reference during compilation", () => {
    expect(() =>
      compileAt("node", [makeRecursive("recursively")])
    ).not.toThrow();
  });

  it("builds a RecursionPolicy that resolves to the plan LATER", () => {
    const field = compileFieldDeclaration(
      { path: "node", rules: [makeRecursive("recursively", 7, "element")] },
      planRefTo(EMPTY_PLAN),
      refuseComposite()
    );
    expect(field.recursion?.maxDepth).toBe(7);
    expect(field.recursion?.target).toBe("element");
    expect(field.recursion?.severity).toBe("warning");
    expect(field.recursion?.plan.resolve()).toBe(EMPTY_PLAN);
  });

  it("refuses two recursive rules on one field, naming it", () => {
    expect(() =>
      compileAt("node", [makeRecursive("a"), makeRecursive("b")])
    ).toThrow(ConflictingRecursionError);
    expect(() =>
      compileAt("node", [makeRecursive("a"), makeRecursive("b")])
    ).toThrow(/"node"/);
  });

  it("a field with no presence rule forbids nothing", () => {
    const field = compileAt("name", [makeCheck("minLength")]);
    expect(field.presence.code).toBe(OPEN_PRESENCE_CODE);
    expect(field.presence.allowUndefined).toBe(true);
    expect(field.presence.allowNull).toBe(true);
  });

  it("applyDefaultToNull defaults to the documented true", () => {
    const field = compileAt("name", []);
    expect(field.applyDefaultToNull).toBe(APPLIES_DEFAULT_TO_NULL_BY_DEFAULT);
    expect(field.applyDefaultToNull).toBe(true);
    expect(field.defaultOf).toBeNull();
  });

  it("keeps an explicit applyDefaultToNull false", () => {
    const field = compileFieldDeclaration(
      {
        path: "name",
        rules: [],
        defaultOf: () => "anon",
        applyDefaultToNull: false,
      },
      unresolvablePlanRef(),
      refuseComposite()
    );
    expect(field.applyDefaultToNull).toBe(false);
    expect(field.defaultOf?.({})).toBe("anon");
  });
});

describe("the compiled field is frozen", () => {
  it("freezes the field and its rule arrays", () => {
    const field = compileAt("name", [makeCheck("minLength"), makeGate("gate")]);
    expect(Object.isFrozen(field)).toBe(true);
    expect(Object.isFrozen(field.checks)).toBe(true);
    expect(Object.isFrozen(field.gates)).toBe(true);
    expect(Object.isFrozen(field.transforms)).toBe(true);
    expect(() => {
      (field.checks as unknown as CompiledCheck[]).push(field.checks[0]!);
    }).toThrow(TypeError);
  });
});
