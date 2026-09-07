// ===========================================================================
// Plan assembly, asserted on the PLAN.
//
// The two things that cannot be seen in the types are here: that the PlanRef a
// recursive field holds resolves to the plan that CONTAINS it (back-patching),
// and that everything the plan needs was allocated once, at build time.
// ===========================================================================
import { PathSyntaxError } from "../../../../src/path";
import { compileSchema } from "../../../../src/compile/compile-schema";
import type {
  ArrayNode,
  FieldDeclaration,
  ValidationPlan,
} from "../../../../src/compile/validation-plan.types";
import type {
  CompositeBranch,
  CompositeRule,
} from "../../../../src/plugin-kit/compiled-rule";
import { PASS, fail } from "../../../../src/types";
import {
  makeCheck,
  makeRecursive,
  makeTransform,
  requiredRule,
} from "../rule-fixtures";
import {
  ROOT_CONTEXT,
  branchOf,
  createRecordingExecutor,
  createRefusingExecutor,
} from "./plan-fixtures";

function compile(declarations: readonly FieldDeclaration[]): ValidationPlan {
  return compileSchema(declarations, createRefusingExecutor());
}

function allOf(branches: readonly CompositeBranch[]): CompositeRule {
  return {
    kind: "composite",
    code: "allOf",
    severity: "error",
    branches,
    combine: (runners) => (value, ruleContext) =>
      runners.every((runner) => runner.run(value, ruleContext).ok)
        ? PASS
        : fail({ actual: value }),
    describe: () => "allOf failed",
  };
}

describe("the plan splits fields from array nodes", () => {
  const plan = compile([
    { path: "name", rules: [requiredRule()] },
    { path: "items[*].label", rules: [makeCheck("isLabel")] },
    { path: "age", rules: [makeCheck("isAge")] },
    { path: "items[*].price", rules: [makeCheck("isPrice")] },
  ]);

  it("keeps the direct fields in declaration order", () => {
    expect(
      plan.fields.map((field) => field.checks.map((check) => check.code))
    ).toEqual([[], ["isAge"]]);
  });

  it("folds both element fields into ONE array node", () => {
    expect(plan.arrays).toHaveLength(1);
    expect(
      plan.arrays[0]?.elementFields.map((field) => field.checks[0]?.code)
    ).toEqual(["isLabel", "isPrice"]);
  });

  it("freezes the plan and both of its lists", () => {
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.fields)).toBe(true);
    expect(Object.isFrozen(plan.arrays)).toBe(true);
  });

  it("compiles an empty schema to an empty plan", () => {
    const empty = compile([]);
    expect(empty.fields).toEqual([]);
    expect(empty.arrays).toEqual([]);
    expect(empty.hasTransforms).toBe(false);
    expect(empty.hasDefaults).toBe(false);
  });
});

describe("hasTransforms and hasDefaults cover the WHOLE plan", () => {
  it("are false when nothing writes", () => {
    const plan = compile([{ path: "name", rules: [makeCheck("isName")] }]);
    expect(plan.hasTransforms).toBe(false);
    expect(plan.hasDefaults).toBe(false);
    expect(plan.fields[0]?.write).toBeNull();
  });

  it("sees a transform declared on an ARRAY ELEMENT field", () => {
    const plan = compile([
      { path: "name", rules: [makeCheck("isName")] },
      { path: "items[*].label", rules: [makeTransform()] },
    ]);
    expect(plan.hasTransforms).toBe(true);
    expect(plan.fields[0]?.write).toBeNull();
    expect(plan.arrays[0]?.elementFields[0]?.write).not.toBeNull();
  });

  it("sees a default declared on a NESTED array element field", () => {
    const plan = compile([
      {
        path: "items[*].sub[*].x",
        rules: [],
        defaultOf: () => 0,
      },
    ]);
    expect(plan.hasDefaults).toBe(true);
    expect(plan.hasTransforms).toBe(false);
  });

  it("applies the documented applyDefaultToNull fallback", () => {
    const plan = compile([
      { path: "name", rules: [], defaultOf: () => "anon" },
    ]);
    expect(plan.fields[0]?.applyDefaultToNull).toBe(true);
    const explicit = compile([
      {
        path: "name",
        rules: [],
        defaultOf: () => "anon",
        applyDefaultToNull: false,
      },
    ]);
    expect(explicit.fields[0]?.applyDefaultToNull).toBe(false);
  });
});

describe("a malformed declaration fails at BUILD time, naming the path", () => {
  it("rejects a double dot", () => {
    expect(() => compile([{ path: "user..name", rules: [] }])).toThrow(
      PathSyntaxError
    );
    expect(() => compile([{ path: "user..name", rules: [] }])).toThrow(
      /user\.\.name/
    );
  });

  it("rejects a reserved segment inside an array element path", () => {
    expect(() => compile([{ path: "items[*].__proto__", rules: [] }])).toThrow(
      PathSyntaxError
    );
  });
});

describe("PlanRef back-patching", () => {
  it("resolves a recursive field's ref to the plan that contains it", () => {
    const plan = compile([
      { path: "node", rules: [makeRecursive("recursively")] },
    ]);
    const recursion = plan.fields[0]?.recursion;
    expect(recursion).not.toBeNull();
    expect(recursion?.plan.resolve()).toBe(plan);
  });

  it("gives an array element field the SAME root plan ref", () => {
    const plan = compile([
      { path: "children[*]", rules: [makeRecursive("recursively")] },
    ]);
    const node: ArrayNode | undefined = plan.arrays[0];
    expect(node?.elementFields[0]?.recursion?.plan.resolve()).toBe(plan);
  });

  it("needs no forward declaration: compiling never resolves the ref", () => {
    expect(() =>
      compile([{ path: "node", rules: [makeRecursive("recursively")] }])
    ).not.toThrow();
  });

  it("gives a BRANCH field the branch's own plan, not the enclosing one", () => {
    const probe = createRecordingExecutor();
    const plan = compileSchema(
      [
        {
          path: "subject",
          rules: [
            allOf([
              branchOf(
                "inner",
                [],
                [{ path: "child", rules: [makeRecursive("recursively")] }]
              ),
            ]),
          ],
        },
      ],
      probe.executor
    );
    plan.fields[0]?.checks[0]?.run({ child: {} }, ROOT_CONTEXT);
    const branchPlan = probe.plansSeen[0];
    expect(branchPlan).toBeDefined();
    expect(branchPlan).not.toBe(plan);
    expect(branchPlan?.fields[0]?.recursion?.plan.resolve()).toBe(branchPlan);
  });
});

describe("the BranchExecutor is required", () => {
  it("does not typecheck when it is omitted", () => {
    // @ts-expect-error compile/ must not grow a second traversal: branch
    // execution is L5's single engine, so there is no default executor.
    compileSchema([]);
    expect(compileSchema.length).toBe(2);
  });
});

/**
 * The cost property: every closure the plan runs on was allocated during
 * compilation. Running the plan cannot mint new ones, so the identity graph
 * taken before and after two executions must be element-for-element the same.
 * A lazily rebuilt reader, or a composite re-combined per run, changes it.
 */
function collectCompiledParts(plan: ValidationPlan): readonly unknown[] {
  const parts: unknown[] = [];
  for (const field of plan.fields) {
    parts.push(field.read, field.write, field.presence, field.recursion);
    for (const check of field.checks) parts.push(check, check.run);
  }
  for (const node of plan.arrays) {
    parts.push(node, node.read);
    parts.push(
      ...collectCompiledParts({
        fields: node.elementFields,
        arrays: node.nested,
        hasTransforms: false,
        hasDefaults: false,
      })
    );
  }
  return parts;
}

describe("running the plan allocates no compiled part", () => {
  it("has the same identity graph after two runs as after none", () => {
    const probe = createRecordingExecutor();
    const plan = compileSchema(
      [
        { path: "name", rules: [makeCheck("isName")] },
        { path: "items[*].label", rules: [makeCheck("isLabel")] },
        {
          path: "shape",
          rules: [
            allOf([
              branchOf(
                "inner",
                [],
                [{ path: "child", rules: [makeCheck("isChild")] }]
              ),
            ]),
          ],
        },
      ],
      probe.executor
    );
    const before = collectCompiledParts(plan);
    const subject = {
      name: "ada",
      items: [{ label: "a" }, { label: "b" }],
      shape: { child: 1 },
    };
    for (let run = 0; run < 2; run += 1) {
      probe.executor.runBranch(plan, subject, ROOT_CONTEXT);
    }
    const after = collectCompiledParts(plan);
    expect(after).toHaveLength(before.length);
    before.forEach((part, index) => {
      expect(after[index]).toBe(part);
    });
  });
});
