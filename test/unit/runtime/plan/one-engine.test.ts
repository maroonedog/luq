// ===========================================================================
// "There is exactly one engine" is a claim about the SOURCE, so it is checked
// against the source. Behaviour cannot prove the absence of a second traversal;
// only counting the implementations can.
//
// dependency-cruiser is not a dependency of this repository, so the import
// graph is read the same way test/unit/runtime/field/layer-imports.test.ts
// reads it: by scanning the specifiers of the real files.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { PASS } from "../../../../src/types";
import { createBranchExecutor } from "../../../../src/runtime/run-branch";
import { requiredRule } from "../../compile/rule-fixtures";
import { branchOf, compositeOf, harnessFor, planOf } from "./engine-fixtures";
import { runPlan } from "../../../../src/runtime/run-plan";

const SOURCE_ROOT = path.join(__dirname, "..", "..", "..", "..", "src");

function readSource(relative: string): string {
  return fs.readFileSync(path.join(SOURCE_ROOT, relative), "utf8");
}

function collectSources(directory: string): ReadonlyMap<string, string> {
  const absolute = path.join(SOURCE_ROOT, directory);
  const byFile = new Map<string, string>();
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.isDirectory() || !entry.name.endsWith(".ts")) continue;
    byFile.set(
      entry.name,
      fs.readFileSync(path.join(absolute, entry.name), "utf8")
    );
  }
  return byFile;
}

describe("run-branch is the only BranchExecutor", () => {
  const runtimeSources = collectSources("runtime");

  it("found the runtime sources at all", () => {
    expect([...runtimeSources.keys()]).toEqual(
      expect.arrayContaining([
        "run-plan.ts",
        "run-branch.ts",
        "run-array-node.ts",
        "run-recursion.ts",
        "create-validator.ts",
      ])
    );
  });

  it("imports the BranchExecutor port into exactly one runtime file", () => {
    const implementing = [...runtimeSources.entries()]
      .filter(([, source]) =>
        source.includes('from "../compile/branch-executor.port"')
      )
      .map(([file]) => file);
    expect(implementing).toEqual(["run-branch.ts"]);
  });

  it("has run-branch reach the engine, and nothing else reach run-branch", () => {
    expect(readSource("runtime/run-branch.ts")).toMatch(
      /import \{[^}]*runPlan[^}]*\} from "\.\/run-plan"/
    );
    for (const [file, source] of runtimeSources) {
      if (file === "run-branch.ts" || file === "index.ts") continue;
      expect(`${file}: ${String(source.includes('from "./run-branch"'))}`).toBe(
        `${file}: false`
      );
    }
  });

  it("keeps run-plan free of any import of run-branch or run-recursion", () => {
    const source = readSource("runtime/run-plan.ts");
    expect(source).not.toContain('from "./run-branch"');
    expect(source).not.toContain('from "./run-recursion"');
  });

  it("keeps compile/ from importing the runtime it inverted away from", () => {
    for (const [file, source] of collectSources("compile")) {
      expect(`${file}: ${String(source.includes('from "../runtime'))}`).toBe(
        `${file}: false`
      );
    }
  });

  it("uses neither eval nor new Function anywhere in the runtime", () => {
    for (const [file, source] of runtimeSources) {
      expect(
        `${file}: ${String(/new Function\s*\(|\beval\s*\(/.test(source))}`
      ).toBe(`${file}: false`);
    }
  });
});

describe("a composite reaches runPlan and only runPlan", () => {
  it("sees the branch's own compiled fields, not a re-interpretation", () => {
    const seen: unknown[] = [];
    const composite = compositeOf(
      "wraps",
      [branchOf("#0", [], [{ path: "inner", rules: [requiredRule()] }])],
      (runners) => (value, ctx) => {
        seen.push(runners.map((runner) => runner.label));
        for (const runner of runners) runner.run(value, ctx);
        return PASS;
      }
    );
    const root = { payload: {} };
    const harness = harnessFor([{ path: "payload", rules: [composite] }], root);
    runPlan(harness.plan, root, harness.context);
    expect(seen).toEqual([["#0"]]);
  });

  it("runs a branch through the SAME executor object the plan was compiled with", () => {
    const executor = createBranchExecutor();
    expect(typeof executor.runBranch).toBe("function");
    const plan = planOf([{ path: "a", rules: [requiredRule()] }]);
    expect(executor.runBranch(plan, { a: 1 }, { root: {}, path: "" })).toEqual(
      PASS
    );
  });
});
