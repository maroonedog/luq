// ===========================================================================
// The shapes real input actually takes. Every case here crashed, hung or
// silently skipped validation in the legacy tree at least once.
// ===========================================================================
import { fail } from "../../../../src/types";
import { createValidator } from "../../../../src/runtime/create-validator";
import type { FieldDeclaration } from "../../../../src/compile/validation-plan.types";
import {
  makeRecursive,
  makeTransform,
  requiredRule,
} from "../../compile/rule-fixtures";
import { makeDetailedCheck } from "../runtime-fixtures";
import { planOf } from "./engine-fixtures";

function validatorFor(declarations: readonly FieldDeclaration[]) {
  return createValidator(planOf(declarations));
}

describe("cycles", () => {
  it("terminates on a self-referential object", () => {
    const cyclic: Record<string, unknown> = { name: "a" };
    cyclic.child = cyclic;
    const outcome = validatorFor([
      { path: "name", rules: [requiredRule()] },
      { path: "child", rules: [makeRecursive("recursively", 10)] },
    ]).validate(cyclic, { abortEarly: false });
    expect(outcome.issues).toEqual([]);
    expect(outcome.valid).toBe(true);
  });

  it("terminates on a cycle through an array element", () => {
    const node: Record<string, unknown> = { name: "a" };
    node.children = [node];
    const outcome = validatorFor([
      { path: "name", rules: [requiredRule()] },
      {
        path: "children",
        rules: [makeRecursive("recursivelyEach", 10, "element")],
      },
    ]).validate(node, { abortEarly: false });
    expect(outcome.issues).toEqual([]);
    expect(outcome.valid).toBe(true);
  });
});

describe("deep nesting", () => {
  function chainOf(levels: number): Record<string, unknown> {
    let current: Record<string, unknown> = { name: "leaf" };
    for (let i = 0; i < levels; i += 1) current = { name: "n", child: current };
    return current;
  }

  it("stops a 1000-level chain at maxDepth instead of running away", () => {
    const outcome = validatorFor([
      { path: "name", rules: [requiredRule()] },
      { path: "child", rules: [makeRecursive("recursively", 10)] },
    ]).validate(chainOf(1000));
    expect(outcome.issues).toHaveLength(1);
    expect(outcome.issues[0]?.code).toBe("recursively");
    expect(outcome.issues[0]?.path).toBe(
      Array.from({ length: 11 }, () => "child").join(".")
    );
  });

  it("walks a 400-level chain when the limit allows it", () => {
    const outcome = validatorFor([
      { path: "name", rules: [requiredRule()] },
      { path: "child", rules: [makeRecursive("recursively", 5000)] },
    ]).validate(chainOf(400), { abortEarly: false });
    expect(outcome.issues).toEqual([]);
    expect(outcome.valid).toBe(true);
  });

  it("reads a 1000-deep DECLARED path without recursion at all", () => {
    let leaf: Record<string, unknown> = { name: undefined };
    for (let i = 0; i < 1000; i += 1) leaf = { child: leaf };
    const path = `${Array.from({ length: 1000 }, () => "child").join(".")}.name`;
    const outcome = validatorFor([{ path, rules: [requiredRule()] }]).validate(
      leaf
    );
    expect(outcome.valid).toBe(false);
    expect(outcome.issues[0]?.path).toBe(path);
  });

  it("reports the deepest broken level with its full path", () => {
    const root = {
      name: "n",
      child: { name: "n", child: { name: undefined } },
    };
    const outcome = validatorFor([
      { path: "name", rules: [requiredRule()] },
      { path: "child", rules: [makeRecursive("recursively", 10)] },
    ]).validate(root, { abortEarly: false });
    expect(outcome.issues.map((issue) => issue.path)).toEqual([
      "child.child.name",
    ]);
  });
});

describe("hostile objects", () => {
  it("reads a null-prototype object", () => {
    const bare = Object.create(null) as Record<string, unknown>;
    bare.name = "ada";
    const outcome = validatorFor([
      { path: "name", rules: [requiredRule()] },
    ]).validate(bare);
    expect(outcome.valid).toBe(true);
  });

  it("does not see an inherited property as present", () => {
    const parent = { name: "inherited" };
    const child = Object.create(parent) as Record<string, unknown>;
    const outcome = validatorFor([
      { path: "name", rules: [requiredRule()] },
    ]).validate(child);
    expect(outcome.valid).toBe(false);
    expect(outcome.issues[0]?.path).toBe("name");
  });

  it("does not treat a prototype method as a declared value", () => {
    const outcome = validatorFor([
      { path: "toString", rules: [requiredRule()] },
    ]).validate({ name: "ada" });
    expect(outcome.valid).toBe(false);
  });
});

describe("arrays", () => {
  it("treats a HOLE in a sparse array as absent", () => {
    const sparse: unknown[] = [1, 2, 3];
    delete sparse[1];
    const outcome = validatorFor([
      { path: "items[*]", rules: [requiredRule()] },
    ]).validate({ items: sparse }, { abortEarly: false });
    expect(outcome.issues.map((issue) => issue.path)).toEqual(["items[1]"]);
  });

  it("validates 10k elements and reports the one that is broken", () => {
    const items = Array.from({ length: 10000 }, (_unused, index) => ({
      id: index,
    }));
    items[7777] = { id: undefined as unknown as number };
    const outcome = validatorFor([
      { path: "items[*].id", rules: [requiredRule()] },
    ]).validate({ items }, { abortEarly: false });
    expect(outcome.issues.map((issue) => issue.path)).toEqual([
      "items[7777].id",
    ]);
  });

  it("rebuilds a 10k array copy-on-write without touching the input", () => {
    const items = Array.from({ length: 10000 }, (_unused, index) => index);
    const input = { items };
    const outcome = validatorFor([
      { path: "items[*]", rules: [makeTransform((v) => Number(v) + 1)] },
    ]).parse(input);
    expect(outcome.valid).toBe(true);
    if (!outcome.valid) return;
    expect((outcome.data as { items: number[] }).items[9999]).toBe(10000);
    expect(items[9999]).toBe(9999);
  });

  it("is vacuous at every level when the container is not an array", () => {
    const outcome = validatorFor([
      { path: "matrix[*][*]", rules: [requiredRule()] },
    ]).validate({ matrix: [null, "x", [undefined]] }, { abortEarly: false });
    expect(outcome.issues.map((issue) => issue.path)).toEqual(["matrix[2][0]"]);
  });
});

describe("a rule that misbehaves", () => {
  it("lets a throwing check escape rather than reporting a false success", () => {
    expect(() =>
      validatorFor([
        {
          path: "name",
          rules: [
            makeDetailedCheck({
              code: "explodes",
              run: () => {
                throw new TypeError("boom");
              },
            }),
          ],
        },
      ]).validate({ name: "ada" })
    ).toThrow(TypeError);
  });

  it("falls back to a generic message when a message factory throws", () => {
    const outcome = validatorFor([
      {
        path: "name",
        rules: [
          makeDetailedCheck({
            code: "custom",
            run: () => fail({}),
            describe: () => {
              throw new Error("bad factory");
            },
          }),
        ],
      },
    ]).validate({ name: "ada" });
    expect(outcome.valid).toBe(false);
    expect(outcome.issues[0]?.message).toBe("Validation failed for name");
  });
});
